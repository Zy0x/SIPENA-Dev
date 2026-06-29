import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getSupabaseClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function sha256(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signToken(sessionData: Record<string, unknown>, secret: string): Promise<string> {
  const dataStr = JSON.stringify(sessionData);
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(dataStr);
  const secretBytes = encoder.encode(secret);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBytes = await crypto.subtle.sign("HMAC", key, dataBytes);
  const signatureHex = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return btoa(dataStr) + "." + signatureHex;
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const dataStr = atob(parts[0]);
    const signatureHex = parts[1];

    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(dataStr);
    const secretBytes = encoder.encode(secret);

    const key = await crypto.subtle.importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, dataBytes);
    if (!isValid) return false;

    const decoded = JSON.parse(dataStr);
    return decoded.authenticated && decoded.expires > Date.now();
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, password, token } = await req.json();
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
        const sessionData = {
          authenticated: true,
          timestamp: Date.now(),
          expires: Date.now() + (15 * 60 * 1000), // 15 menit
          seed: crypto.randomUUID(),
        };
        
        const sessionToken = await signToken(sessionData, ADMIN_PASSWORD);
        const tokenHash = await sha256(sessionToken);

        const supabaseAdmin = getSupabaseClient();
        const { error: dbError } = await supabaseAdmin
          .from("admin_sessions")
          .insert({
            token_hash: tokenHash,
            expires_at: new Date(sessionData.expires).toISOString(),
          });

        if (dbError) {
          console.error("DB error creating admin session:", dbError);
          // Return 500 to require strict database sync
          return new Response(
            JSON.stringify({
              success: false,
              error: "Gagal menyinkronkan sesi ke database: " + dbError.message,
            }),
            { 
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500
            }
          );
        }

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
      // 1. Verifikasi lokal tanda tangan token
      const isValidSig = await verifyToken(token, ADMIN_PASSWORD);
      if (!isValidSig) {
        return new Response(
          JSON.stringify({
            success: true,
            valid: false,
            error: "Token expired or signature invalid",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2. Verifikasi stateful di database
      const tokenHash = await sha256(token);
      const supabaseAdmin = getSupabaseClient();
      const { data: session, error: dbError } = await supabaseAdmin
        .from("admin_sessions")
        .select("*")
        .eq("token_hash", tokenHash)
        .maybeSingle();

      if (dbError || !session) {
        return new Response(
          JSON.stringify({
            success: true,
            valid: false,
            error: "Sesi tidak ditemukan di database (telah di-revoke/logout)",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 3. Cek kedaluwarsa waktu database
      const expiresAt = new Date(session.expires_at).getTime();
      if (expiresAt <= Date.now()) {
        await supabaseAdmin.from("admin_sessions").delete().eq("token_hash", tokenHash);
        return new Response(
          JSON.stringify({
            success: true,
            valid: false,
            error: "Sesi telah kedaluwarsa di database",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          valid: true,
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // === ACTION: REFRESH / MANUAL EXTEND SESSION ===
    if (action === "refresh") {
      const isValidSig = await verifyToken(token, ADMIN_PASSWORD);
      if (!isValidSig) {
        return new Response(
          JSON.stringify({ success: false, error: "Sesi tidak valid atau telah kedaluwarsa" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      const oldTokenHash = await sha256(token);
      const supabaseAdmin = getSupabaseClient();
      const { data: session, error: dbError } = await supabaseAdmin
        .from("admin_sessions")
        .select("*")
        .eq("token_hash", oldTokenHash)
        .maybeSingle();

      if (dbError || !session || new Date(session.expires_at).getTime() <= Date.now()) {
        return new Response(
          JSON.stringify({ success: false, error: "Sesi tidak ditemukan atau telah kedaluwarsa" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
        );
      }

      const newSessionData = {
        authenticated: true,
        timestamp: Date.now(),
        expires: Date.now() + (15 * 60 * 1000), // perpanjang 15 menit
        seed: crypto.randomUUID(),
      };

      const newSessionToken = await signToken(newSessionData, ADMIN_PASSWORD);
      const newTokenHash = await sha256(newSessionToken);

      const { error: updateError } = await supabaseAdmin
        .from("admin_sessions")
        .update({
          token_hash: newTokenHash,
          expires_at: new Date(newSessionData.expires).toISOString(),
          last_active_at: new Date().toISOString(),
        })
        .eq("token_hash", oldTokenHash);

      if (updateError) {
        console.error("DB error extending session:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Gagal memperbarui sesi di database" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          token: newSessionToken,
          message: "Sesi berhasil diperpanjang",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === ACTION: LOGOUT ===
    if (action === "logout") {
      const tokenHash = await sha256(token);
      const supabaseAdmin = getSupabaseClient();
      await supabaseAdmin.from("admin_sessions").delete().eq("token_hash", tokenHash);

      return new Response(
        JSON.stringify({ success: true, message: "Berhasil logout secara stateful" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Action tidak valid" 
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