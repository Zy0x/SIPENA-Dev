import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-session-token",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Metode tidak didukung" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const expectedPassword = Deno.env.get("ADMIN_DB_PASSWORD");
    if (!expectedPassword || body.password !== expectedPassword) return json({ success: false, error: "Kredensial admin tidak valid" }, 401);

    const sessionToken = req.headers.get("x-admin-session-token") || "";
    if (!sessionToken) return json({ success: false, error: "Sesi admin diperlukan" }, 401);

    const url = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Konfigurasi service role belum tersedia");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const tokenHash = await sha256(sessionToken);
    const { data: session } = await admin.from("admin_sessions").select("expires_at").eq("token_hash", tokenHash).maybeSingle();
    if (!session || new Date(session.expires_at).getTime() <= Date.now()) return json({ success: false, error: "Sesi admin tidak valid atau kedaluwarsa" }, 401);

    const action = String(body.action || "list");
    if (action === "list") {
      const { data, error } = await admin.from("admin_event_notifications").select("id,event_type,title,message,provider,metadata,read,created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ success: true, notifications: data || [] });
    }

    if (action === "mark-read" || action === "delete") {
      const id = String(body.id || "");
      if (!id) return json({ success: false, error: "ID notifikasi diperlukan" }, 400);
      const query = action === "delete"
        ? admin.from("admin_event_notifications").delete().eq("id", id)
        : admin.from("admin_event_notifications").update({ read: true }).eq("id", id);
      const { error } = await query;
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "mark-all-read") {
      const { error } = await admin.from("admin_event_notifications").update({ read: true }).eq("read", false);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ success: false, error: "Aksi tidak dikenal" }, 400);
  } catch (error) {
    console.error("[admin-event-notifications] request failed", error instanceof Error ? error.message : "unknown");
    return json({ success: false, error: "Notifikasi admin tidak dapat diproses" }, 500);
  }
});
