import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// External Supabase Configuration - uses external project exclusively
const EXTERNAL_SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://jdncrsmjvbweyxcbtnou.supabase.co";
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("SBASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Known system tables to exclude from backup/restore
const EXCLUDED_TABLES = new Set([
  "schema_migrations",
  "supabase_migrations",
  "buckets",
  "objects",
  "s3_multipart_uploads",
  "s3_multipart_uploads_parts",
  "hooks",
  "http_request_queue",
  "secrets",
  "key",
  "migrations",
]);

interface BackupData {
  version: string;
  schemaVersion: string;
  exportedAt: string;
  sourceUrl: string;
  tables: Record<string, any[]>;
  metadata: {
    tableCount: number;
    totalRecords: number;
    recordsByTable: Record<string, number>;
    userIds: string[];
    discoveredTables: string[];
  };
}

function verifyAdminPassword(password: string): boolean {
  const envPassword = Deno.env.get("ADMIN_DB_PASSWORD");
  if (!envPassword) {
    console.error("ADMIN_DB_PASSWORD not configured");
    return false;
  }
  return password === envPassword;
}

function disabledV2PromotionResponse() {
  return new Response(
    JSON.stringify({
      error: "V2_TO_PRODUCTION_PROMOTION_DISABLED",
      message:
        "Merge data Presensi V2 ke tabel produksi lama dinonaktifkan untuk menjaga data presensi lama tetap aman. Gunakan jalur migrasi idempotent yang sudah tervalidasi sebelum cutover.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// Dynamically discover all public tables in the database
async function discoverTables(supabase: any): Promise<string[]> {
  try {
    // Query pg_catalog to get all public tables
    const { data, error } = await supabase.rpc("get_all_public_tables");
    
    if (error) {
      // Fallback: use a hardcoded list if RPC doesn't exist
      console.log("RPC not available, using static table discovery");
      return await discoverTablesManually(supabase);
    }
    
    if (data && Array.isArray(data)) {
      return data
        .map((t: any) => t.table_name || t.tablename || t)
        .filter((name: string) => !EXCLUDED_TABLES.has(name));
    }
    
    return await discoverTablesManually(supabase);
  } catch (e) {
    console.error("Table discovery error:", e);
    return await discoverTablesManually(supabase);
  }
}

// Manual table discovery by trying known tables
async function discoverTablesManually(supabase: any): Promise<string[]> {
  const potentialTables = [
    "academic_years",
    "semesters",
    "classes",
    "students",
    "subjects",
    "chapters",
    "assignments",
    "grades",
    "grade_formula_settings",
    "attendance",
    "user_preferences",
    "guest_users",
    "shared_links",
    "guest_audit_logs",
    "activity_logs",
    "notifications",
    "password_reset_tokens",
    "account_deletion_requests",
    "team_profiles",
    "profiles",
    "user_roles",
  ];
  
  const existingTables: string[] = [];
  
  for (const tableName of potentialTables) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });
      
      if (!error) {
        existingTables.push(tableName);
      }
    } catch {
      // Table doesn't exist, skip
    }
  }
  
  return existingTables;
}

// Sort tables by foreign key dependencies (parents first for backup, reverse for delete)
function sortTablesByDependency(tables: string[]): string[] {
  // Known dependency order (parents first)
  const priorityOrder = [
    "academic_years",
    "semesters",
    "classes",
    "students",
    "subjects",
    "chapters",
    "assignments",
    "grades",
    "grade_formula_settings",
    "attendance",
    "user_preferences",
    "profiles",
    "user_roles",
    "guest_users",
    "shared_links",
    "guest_audit_logs",
    "activity_logs",
    "notifications",
    "password_reset_tokens",
    "account_deletion_requests",
    "team_profiles",
  ];
  
  // Sort tables: known order first, then alphabetically
  return tables.sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a);
    const bIndex = priorityOrder.indexOf(b);
    
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return a.localeCompare(b);
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, password, tables, backupData, sourceUrl, customUrl, customServiceKey, table, page, pageSize, classId, month, workDayFormat } = body;

    // Verify admin password for all operations
    if (!verifyAdminPassword(password)) {
      return new Response(
        JSON.stringify({ error: "Invalid admin password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use custom URL/key if provided, otherwise use defaults
    const supabaseUrl = customUrl || EXTERNAL_SUPABASE_URL;
    const serviceRoleKey = customServiceKey || EXTERNAL_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Service role key not configured. Please set SUPABASE_SERVICE_ROLE_KEY in Supabase secrets or provide customServiceKey." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client (bypasses RLS) - targets external Supabase
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      { auth: { persistSession: false } }
    );

    switch (action) {
      case "backup": {
        return await handleBackup(supabaseAdmin, sourceUrl);
      }
      case "restore": {
        return await handleRestore(supabaseAdmin, backupData);
      }
      case "delete": {
        return await handleDelete(supabaseAdmin, tables);
      }
      case "stats": {
        return await handleStats(supabaseAdmin);
      }
      case "test-connection": {
        return await handleTestConnection(supabaseAdmin);
      }
      case "discover-tables": {
        return await handleDiscoverTables(supabaseAdmin);
      }
      case "v2-pending-list": {
        return disabledV2PromotionResponse();
      }
      case "v2-promote": {
        return disabledV2PromotionResponse();
      }
      case "table-detail": {
        if (!table || typeof table !== "string") {
          return new Response(
            JSON.stringify({ error: "Table name required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(pageSize) || 50;
        const start = (pageNum - 1) * limitNum;
        const end = start + limitNum - 1;

        try {
          // Get exact total count first
          const { count, error: countError } = await supabaseAdmin
            .from(table)
            .select("*", { count: "exact", head: true });

          if (countError) throw countError;

          // Fetch paginated rows
          const { data, error } = await supabaseAdmin
            .from(table)
            .select("*")
            .order("created_at", { ascending: false })
            .range(start, end);
          
          if (error) {
            // Try without ordering if created_at doesn't exist
            const { data: data2, error: error2 } = await supabaseAdmin
              .from(table)
              .select("*")
              .range(start, end);
            
            if (error2) throw error2;
            return new Response(
              JSON.stringify({ success: true, data: data2 || [], totalCount: count || 0 }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          return new Response(
            JSON.stringify({ success: true, data: data || [], totalCount: count || 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ success: false, error: e.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Admin database error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleDiscoverTables(supabase: any): Promise<Response> {
  const tables = await discoverTables(supabase);
  const sortedTables = sortTablesByDependency(tables);
  
  return new Response(
    JSON.stringify({ 
      success: true, 
      tables: sortedTables,
      count: sortedTables.length
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleTestConnection(supabase: any): Promise<Response> {
  try {
    // Discover tables and use first available one for testing
    const tables = await discoverTables(supabase);
    
    if (tables.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Koneksi berhasil, tetapi tidak ada tabel ditemukan",
          tableCount: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count from first available table
    const { count, error } = await supabase
      .from(tables[0])
      .select("*", { count: "exact", head: true });

    if (error) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          message: "Koneksi gagal: " + error.message
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Koneksi berhasil ke Supabase eksternal (${tables.length} tabel ditemukan)`,
        tableCount: tables.length,
        tables: tables
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: e.message,
        message: "Koneksi gagal: " + e.message
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

async function handleBackup(supabase: any, sourceUrl: string): Promise<Response> {
  // Dynamically discover all tables
  const discoveredTables = await discoverTables(supabase);
  const sortedTables = sortTablesByDependency(discoveredTables);
  
  const exportData: Record<string, any[]> = {};
  const errors: string[] = [];
  const recordsByTable: Record<string, number> = {};
  const userIds = new Set<string>();

  // Fetch all discovered tables
  for (const tableName of sortedTables) {
    try {
      // Use range to bypass 1000 row limit - fetch in chunks
      let allData: any[] = [];
      let offset = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .range(offset, offset + limit - 1);

        if (error) {
          errors.push(`${tableName}: ${error.message}`);
          break;
        }

        if (data && data.length > 0) {
          allData = allData.concat(data);
          offset += limit;
          hasMore = data.length === limit;
        } else {
          hasMore = false;
        }
      }

      exportData[tableName] = allData;
      recordsByTable[tableName] = allData.length;

      // Collect user IDs for reference
      allData.forEach((row: any) => {
        if (row.user_id) userIds.add(row.user_id);
        if (row.id && tableName === "guest_users") userIds.add(row.id);
      });
    } catch (e) {
      errors.push(`${tableName}: Failed to fetch - ${e}`);
    }
  }

  const backupDataResult: BackupData = {
    version: "2.2",
    schemaVersion: "2024.2",
    exportedAt: new Date().toISOString(),
    sourceUrl: sourceUrl || "",
    tables: exportData,
    metadata: {
      tableCount: Object.keys(exportData).length,
      totalRecords: Object.values(exportData).reduce((sum, arr) => sum + arr.length, 0),
      recordsByTable,
      userIds: Array.from(userIds),
      discoveredTables: sortedTables,
    },
  };

  return new Response(
    JSON.stringify({ 
      success: true, 
      data: backupDataResult, 
      errors: errors.length > 0 ? errors : undefined 
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleRestore(supabase: any, backupData: BackupData): Promise<Response> {
  if (!backupData?.tables || typeof backupData.tables !== "object") {
    return new Response(
      JSON.stringify({ error: "Invalid backup data structure" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: Record<string, { success: number; errors: string[] }> = {};
  
  // Get tables from backup and sort them
  const backupTables = Object.keys(backupData.tables);
  const sortedTables = sortTablesByDependency(backupTables);

  // Import in priority order (respecting FK dependencies)
  for (const tableName of sortedTables) {
    const tableData = backupData.tables[tableName];
    if (!Array.isArray(tableData) || tableData.length === 0) {
      results[tableName] = { success: 0, errors: [] };
      continue;
    }

    const tableResults = { success: 0, errors: [] as string[] };

    // Clean data - remove any null IDs
    const cleanData = tableData.filter((row) => row.id);
    
    if (cleanData.length === 0) {
      results[tableName] = tableResults;
      continue;
    }

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < cleanData.length; i += batchSize) {
      const batch = cleanData.slice(i, i + batchSize);

      try {
        const { error } = await supabase
          .from(tableName)
          .upsert(batch, { 
            onConflict: "id",
            ignoreDuplicates: false,
          });

        if (error) {
          tableResults.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          tableResults.success += batch.length;
        }
      } catch (e: any) {
        tableResults.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${e.message || "Unknown error"}`);
      }
    }

    results[tableName] = tableResults;
  }

  const totalSuccess = Object.values(results).reduce((sum, r) => sum + r.success, 0);
  const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);

  return new Response(
    JSON.stringify({ 
      success: true, 
      results,
      summary: {
        totalSuccess,
        totalErrors,
      }
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleDelete(supabase: any, tablesToDelete: string[]): Promise<Response> {
  if (!Array.isArray(tablesToDelete) || tablesToDelete.length === 0) {
    return new Response(
      JSON.stringify({ error: "No tables specified for deletion" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const results: Record<string, { success: boolean; deletedCount: number; error?: string }> = {};

  // Sort and reverse for deletion (children first, parents last)
  const sortedTables = sortTablesByDependency(tablesToDelete).reverse();

  for (const tableName of sortedTables) {
    try {
      // First, get count of existing records
      const { count: existingCount } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

      // Delete all rows - using multiple approaches for reliability
      let { error } = await supabase
        .from(tableName)
        .delete()
        .gte("created_at", "1900-01-01");

      // If that didn't work, try neq on id
      if (error) {
        const result = await supabase
          .from(tableName)
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        error = result.error;
      }

      if (error) {
        // Last resort: select all IDs and delete by ID
        const { data: allRows } = await supabase
          .from(tableName)
          .select("id");

        if (allRows && allRows.length > 0) {
          const ids = allRows.map((r: any) => r.id);
          const deleteResult = await supabase
            .from(tableName)
            .delete()
            .in("id", ids);
          
          if (deleteResult.error) {
            results[tableName] = { 
              success: false, 
              deletedCount: 0, 
              error: deleteResult.error.message 
            };
            continue;
          }
        }
      }

      results[tableName] = { 
        success: true, 
        deletedCount: existingCount || 0 
      };
    } catch (e: any) {
      results[tableName] = { 
        success: false, 
        deletedCount: 0, 
        error: e.message || "Unknown error" 
      };
    }
  }

  const successCount = Object.values(results).filter((r) => r.success).length;
  const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.deletedCount, 0);

  return new Response(
    JSON.stringify({ 
      success: true, 
      results,
      summary: {
        tablesProcessed: sortedTables.length,
        tablesSucceeded: successCount,
        totalRecordsDeleted: totalDeleted,
      }
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function discoverTablesSecurity(supabase: any): Promise<{ table_name: string; rls_enabled: boolean }[]> {
  try {
    const { data, error } = await supabase.rpc("get_public_tables_security");
    if (error) {
      console.log("RPC get_public_tables_security not available, falling back to basic table discovery");
      const tables = await discoverTables(supabase);
      return tables.map((t: string) => ({ table_name: t, rls_enabled: true }));
    }
    return data || [];
  } catch (e) {
    console.error("Table security discovery error, falling back:", e);
    const tables = await discoverTables(supabase);
    return tables.map((t: string) => ({ table_name: t, rls_enabled: true }));
  }
}

async function handleStats(supabase: any): Promise<Response> {
  // Dynamically discover ALL public tables with security status
  const tableSecurities = await discoverTablesSecurity(supabase);
  const discoveredTables = tableSecurities.map((t) => t.table_name);
  const rlsStatuses: Record<string, boolean> = {};
  tableSecurities.forEach((t) => {
    rlsStatuses[t.table_name] = t.rls_enabled;
  });

  const stats: Record<string, number> = {};
  const errors: string[] = [];

  // Use parallel counting for speed
  const countPromises = discoveredTables.map(async (tableName) => {
    try {
      // Use exact count with service role (bypasses RLS completely)
      const { count, error } = await supabase
        .from(tableName)
        .select("*", { count: "exact", head: true });

      if (error) {
        errors.push(`${tableName}: ${error.message}`);
        // Fallback: try counting via range fetch
        try {
          let total = 0;
          let offset = 0;
          const batchSize = 1000;
          let hasMore = true;
          while (hasMore) {
            const { data } = await supabase
              .from(tableName)
              .select("id")
              .range(offset, offset + batchSize - 1);
            if (data && data.length > 0) {
              total += data.length;
              offset += batchSize;
              hasMore = data.length === batchSize;
            } else {
              hasMore = false;
            }
          }
          return { tableName, count: total };
        } catch {
          return { tableName, count: 0 };
        }
      }

      return { tableName, count: count || 0 };
    } catch (e: any) {
      errors.push(`${tableName}: ${e.message || "Unknown error"}`);
      return { tableName, count: 0 };
    }
  });

  const results = await Promise.all(countPromises);
  for (const { tableName, count } of results) {
    stats[tableName] = count;
  }

  const totalRecords = Object.values(stats).reduce((sum, c) => sum + c, 0);

  return new Response(
    JSON.stringify({ 
      success: true, 
      stats,
      totalRecords,
      discoveredTables,
      rlsStatuses,
      errors: errors.length > 0 ? errors : undefined
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

