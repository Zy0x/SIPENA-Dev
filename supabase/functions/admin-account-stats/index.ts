import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Get secrets from environment
const ADMIN_PASSWORD = Deno.env.get("ADMIN_DB_PASSWORD");
const EXTERNAL_SUPABASE_URL = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function verifyAdminPassword(password: string): boolean {
  return ADMIN_PASSWORD ? password === ADMIN_PASSWORD : false;
}

// Tables to count for account stats
const USER_DATA_TABLES = [
  "academic_years",
  "semesters",
  "classes",
  "students",
  "subjects",
  "chapters",
  "assignments",
  "grades",
  "grade_formula_settings",
  "user_preferences",
  "shared_links",
  "activity_logs",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, password, userId, tables, page, pageSize, search, filter, sort } = await req.json();

    // Verify admin password
    if (!verifyAdminPassword(password)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid admin password" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!EXTERNAL_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Service role key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(
      EXTERNAL_SUPABASE_URL!,
      EXTERNAL_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    switch (action) {
      case "get-account-stats": {
        const pageNum = parseInt(page) || 1;
        const limitNum = parseInt(pageSize) || 10;
        const searchStr = typeof search === "string" ? search.trim() : "";

        // Create client pointing to "auth" schema for direct querying if possible
        const supabaseAuthAdmin = createClient(
          EXTERNAL_SUPABASE_URL!,
          EXTERNAL_SERVICE_ROLE_KEY,
          { db: { schema: "auth" }, auth: { persistSession: false } }
        );

        let query = supabaseAuthAdmin
          .from("users")
          .select("id, email, created_at, last_sign_in_at, email_confirmed_at", { count: "exact" });

        if (searchStr) {
          query = query.ilike("email", `%${searchStr}%`);
        }

        // Apply filters
        if (filter === "verified") {
          query = query.not("email_confirmed_at", "is", null);
        } else if (filter === "unverified") {
          query = query.is("email_confirmed_at", null);
        }

        // Apply sorting
        if (sort === "email-asc") {
          query = query.order("email", { ascending: true });
        } else if (sort === "email-desc") {
          query = query.order("email", { ascending: false });
        } else {
          query = query.order("created_at", { ascending: false });
        }

        const start = (pageNum - 1) * limitNum;
        const end = start + limitNum - 1;
        query = query.range(start, end);

        const { data: users, count, error: fetchError } = await query;

        if (fetchError) {
          console.error("Error listing users from auth schema:", fetchError);
          // Fallback to standard GoTrue listUsers pagination (default 100 limit)
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
          if (authError) {
            return new Response(
              JSON.stringify({ success: false, error: authError.message }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          // Map users from listUsers
          const mappedUsers = authData.users.map((user) => ({
            userId: user.id,
            email: user.email,
            createdAt: user.created_at,
            lastSignInAt: user.last_sign_in_at,
            emailConfirmed: !!user.email_confirmed_at,
            stats: null, // Loaded on-demand
          }));

          return new Response(
            JSON.stringify({
              success: true,
              stats: mappedUsers,
              totalAccounts: authData.users.length,
              isFallback: true,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Map users from direct query
        const mappedUsers = (users || []).map((user: any) => ({
          userId: user.id,
          email: user.email,
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at,
          emailConfirmed: !!user.email_confirmed_at,
          stats: null, // Loaded on-demand
        }));

        return new Response(
          JSON.stringify({
            success: true,
            stats: mappedUsers,
            totalAccounts: count || 0,
            isFallback: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get-single-user-stats": {
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing userId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const counts = {
          academicYears: 0,
          classes: 0,
          students: 0,
          subjects: 0,
          grades: 0,
          assignments: 0,
          total: 0,
        };

        // Count academic years
        const { count: academicYearsCount } = await supabaseAdmin
          .from("academic_years")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        counts.academicYears = academicYearsCount || 0;

        // Count classes
        const { count: classesCount } = await supabaseAdmin
          .from("classes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        counts.classes = classesCount || 0;

        // Count students
        const { count: studentsCount } = await supabaseAdmin
          .from("students")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        counts.students = studentsCount || 0;

        // Count subjects
        const { count: subjectsCount } = await supabaseAdmin
          .from("subjects")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        counts.subjects = subjectsCount || 0;

        // Count grades
        const { count: gradesCount } = await supabaseAdmin
          .from("grades")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        counts.grades = gradesCount || 0;

        // Count assignments
        const { count: assignmentsCount } = await supabaseAdmin
          .from("assignments")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);
        counts.assignments = assignmentsCount || 0;

        counts.total = 
          counts.academicYears + 
          counts.classes + 
          counts.students + 
          counts.subjects + 
          counts.grades + 
          counts.assignments;

        return new Response(
          JSON.stringify({
            success: true,
            stats: counts,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete-user-data": {
        if (!userId || !tables || !Array.isArray(tables)) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing userId or tables" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        let deletedCount = 0;

        for (const table of tables) {
          if (USER_DATA_TABLES.includes(table)) {
            const { count, error } = await supabaseAdmin
              .from(table)
              .delete({ count: "exact" })
              .eq("user_id", userId);

            if (!error && count) {
              deletedCount += count;
            }
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            deletedCount,
            message: `Deleted ${deletedCount} records from ${tables.length} tables`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete-entire-user": {
        if (!userId) {
          return new Response(
            JSON.stringify({ success: false, error: "Missing userId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete all user data from all tables first
        for (const table of USER_DATA_TABLES) {
          await supabaseAdmin
            .from(table)
            .delete()
            .eq("user_id", userId);
        }

        // Delete from auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
          console.error("Error deleting auth user:", authError);
          return new Response(
            JSON.stringify({ success: false, error: authError.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: "User and all data deleted successfully",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Admin account stats error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
