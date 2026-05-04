import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// External Supabase Configuration
const EXTERNAL_SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://jdncrsmjvbweyxcbtnou.supabase.co";
const EXTERNAL_SERVICE_ROLE_KEY = Deno.env.get("SBASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function looksLikeBcryptHash(value: string): boolean {
  // bcrypt hashes usually start with $2a$, $2b$, or $2y$
  return value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$");
}

async function verifyAdminPassword(password: string | undefined): Promise<boolean> {
  const envPassword = Deno.env.get("ADMIN_DB_PASSWORD");
  if (!envPassword) {
    console.error("ADMIN_DB_PASSWORD not configured");
    return false;
  }
  if (!password) return false;

  // Support plain-text secret AND bcrypt-hashed secret
  if (looksLikeBcryptHash(envPassword)) {
    try {
      return await bcrypt.compare(password, envPassword);
    } catch (e) {
      console.error("Failed to compare bcrypt password:", e);
      return false;
    }
  }

  return password === envPassword;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, password, userId, customUrl, customServiceKey } = await req.json();

     // Verify admin password for all operations
     if (!(await verifyAdminPassword(password))) {
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
        JSON.stringify({ error: "Service role key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    switch (action) {
      case "delete-user": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "userId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Delete user from auth
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (error) {
          console.error("Error deleting auth user:", error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Auth user ${userId} deleted successfully` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list-users": {
        // List all auth users
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        
        if (error) {
          console.error("Error listing auth users:", error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Map to simpler format
        const users = data.users.map(user => ({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          email_confirmed_at: user.email_confirmed_at,
          phone: user.phone,
        }));

        return new Response(
          JSON.stringify({ 
            success: true, 
            users,
            count: users.length 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get-user": {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: "userId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            user: {
              id: data.user.id,
              email: data.user.email,
              full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
              created_at: data.user.created_at,
              last_sign_in_at: data.user.last_sign_in_at,
              email_confirmed_at: data.user.email_confirmed_at,
              phone: data.user.phone,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "count-users": {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        
        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: error.message, count: 0 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            count: data.users.length 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: delete-user, list-users, get-user, count-users" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("Delete auth user error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
