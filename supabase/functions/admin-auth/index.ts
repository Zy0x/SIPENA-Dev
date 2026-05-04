import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, password, token } = await req.json();

    // Ambil ADMIN_DB_PASSWORD dari Supabase Secrets
    const ADMIN_PASSWORD = Deno.env.get("ADMIN_DB_PASSWORD");

    if (!ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "ADMIN_DB_PASSWORD secret belum di-set di Supabase Dashboard" 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 500 
        }
      );
    }

    // === ACTION: LOGIN ===
    if (action === "login") {
      if (password === ADMIN_PASSWORD) {
        // Generate session token
        const sessionData = {
          authenticated: true,
          timestamp: Date.now(),
          expires: Date.now() + (24 * 60 * 60 * 1000), // 24 jam
        };
        
        const sessionToken = btoa(JSON.stringify(sessionData));

        return new Response(
          JSON.stringify({
            success: true,
            token: sessionToken,
            message: "Login berhasil",
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Password salah",
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 401 
          }
        );
      }
    }

    // === ACTION: VERIFY TOKEN ===
    if (action === "verify") {
      try {
        const decoded = JSON.parse(atob(token));
        
        if (decoded.authenticated && decoded.expires > Date.now()) {
          return new Response(
            JSON.stringify({
              success: true,
              valid: true,
            }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        } else {
          return new Response(
            JSON.stringify({
              success: true,
              valid: false,
              error: "Token expired",
            }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" } 
            }
          );
        }
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: true,
            valid: false,
            error: "Invalid token format",
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
    }

    // === ACTION: VALIDATE PASSWORD (untuk backend functions lain) ===
    if (action === "validate-password") {
      return new Response(
        JSON.stringify({
          success: true,
          valid: password === ADMIN_PASSWORD,
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Action tidak dikenal
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Invalid action. Allowed: login, verify, validate-password" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 400 
      }
    );

  } catch (error: unknown) {
    console.error("Error in admin-auth function:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});