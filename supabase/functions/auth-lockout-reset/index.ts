import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUTO_APPROVE_HOURS = 24;
const MIN_RESET_LOCKOUT_LEVEL = 6;
const MIN_RESET_FAILURE_COUNT = 18;

type RequestStatus = "pending" | "approved" | "rejected" | "auto_approved";

type RequestBody = {
  action:
    | "request"
    | "check"
    | "admin_list"
    | "admin_approve"
    | "admin_reject"
    | "process_expired"
    | "admin_update_settings";
  email?: string;
  reason?: string;
  captchaToken?: string | null;
  lockoutLevel?: number;
  failureCount?: number;
  lockedUntil?: string | null;
  requestId?: string;
  adminPassword?: string;
  adminResponse?: string;
  autoApproveEnabled?: boolean;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function verifyRecaptcha(token: string | null | undefined, req: Request): Promise<boolean> {
  const secretKey = Deno.env.get("RECAPTCHA_V2_SECRET_KEY");
  if (!secretKey) {
    console.warn("[auth-lockout-reset] RECAPTCHA_V2_SECRET_KEY missing, rejecting public request");
    return false;
  }

  if (!token) return false;

  const formData = new URLSearchParams();
  formData.append("secret", secretKey);
  formData.append("response", token);

  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip");
  if (clientIp) formData.append("remoteip", clientIp);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    body: formData,
  });
  const data = await response.json();
  return data?.success === true;
}

async function verifyAdminPassword(providedPassword: string | undefined): Promise<boolean> {
  const adminPassword = Deno.env.get("ADMIN_DB_PASSWORD");
  return Boolean(adminPassword && providedPassword && providedPassword === adminPassword);
}

function publicErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/auth_lockout_reset_(requests|settings)|relation .* does not exist/i.test(message)) {
    return "Fitur request reset waiting time belum siap. Hubungi admin untuk menyelesaikan pembaruan sistem.";
  }
  if (/duplicate key|violates unique constraint/i.test(message)) {
    return "Request serupa sudah tercatat. Cek status request sebelumnya.";
  }
  if (/check constraint|violates check constraint/i.test(message)) {
    return "Data request belum memenuhi syarat reset waiting time.";
  }
  return "Gagal memproses request reset waiting time. Silakan coba lagi.";
}

async function getSettings(supabaseAdmin: ReturnType<typeof createClient>) {
  const { data, error } = await supabaseAdmin
    .from("auth_lockout_reset_settings")
    .select("auto_approve_enabled, auto_approve_hours")
    .eq("id", "global")
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const fallback = { auto_approve_enabled: true, auto_approve_hours: AUTO_APPROVE_HOURS };
  const { error: upsertError } = await supabaseAdmin
    .from("auth_lockout_reset_settings")
    .upsert({ id: "global", ...fallback }, { onConflict: "id" });
  if (upsertError) throw upsertError;
  return fallback;
}

async function autoApproveExpired(supabaseAdmin: ReturnType<typeof createClient>) {
  const settings = await getSettings(supabaseAdmin);
  if (!settings.auto_approve_enabled) return { processed: 0, settings };

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("auth_lockout_reset_requests")
    .update({
      status: "auto_approved" satisfies RequestStatus,
      processed_at: now,
      processed_by: "system",
      admin_response: "Auto approve setelah 1x24 jam",
    })
    .eq("status", "pending")
    .lte("auto_approve_at", now)
    .select("*");

  if (error) throw error;
  return { processed: data?.length || 0, settings };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SBASE_URL") || Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SBASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ success: false, error: "Supabase admin credentials are not configured" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const body = await req.json() as RequestBody;

    if (body.action === "request") {
      const email = normalizeEmail(body.email || "");
      const reason = (body.reason || "").trim();
      const lockoutLevel = Math.max(0, Math.floor(body.lockoutLevel || 0));
      const failureCount = Math.max(0, Math.floor(body.failureCount || 0));

      if (!isEmail(email)) return json({ success: false, error: "Email tidak valid" }, 400);
      if (reason.length < 12) return json({ success: false, error: "Alasan minimal 12 karakter" }, 400);
      if (lockoutLevel < MIN_RESET_LOCKOUT_LEVEL) {
        return json({ success: false, error: "Request reset waiting time baru tersedia pada lockout level 6 jam" }, 400);
      }
      if (failureCount < MIN_RESET_FAILURE_COUNT) {
        return json({ success: false, error: "Request reset waiting time belum memenuhi syarat jumlah kegagalan login." }, 400);
      }

      const captchaOk = await verifyRecaptcha(body.captchaToken, req);
      if (!captchaOk) return json({ success: false, error: "Verifikasi CAPTCHA gagal" }, 400);

      const { settings } = await autoApproveExpired(supabaseAdmin);

      const { data: existing, error: existingError } = await supabaseAdmin
        .from("auth_lockout_reset_requests")
        .select("*")
        .eq("normalized_email", email)
        .eq("status", "pending")
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing) {
        return json({
          success: true,
          message: "Request sebelumnya masih menunggu keputusan Admin SIPENA.",
          request: existing,
        });
      }

      const autoApproveAt = new Date(Date.now() + settings.auto_approve_hours * 60 * 60 * 1000).toISOString();
      const { data: request, error: insertError } = await supabaseAdmin
        .from("auth_lockout_reset_requests")
        .insert({
          email,
          normalized_email: email,
          reason,
          status: "pending" satisfies RequestStatus,
          lockout_level: lockoutLevel,
          failure_count: failureCount,
          locked_until: body.lockedUntil || null,
          auto_approve_at: autoApproveAt,
        })
        .select("*")
        .single();
      if (insertError) throw insertError;

      const { error: notificationError } = await supabaseAdmin.from("notifications").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        title: "Request Reset Waiting Time Login",
        message: `${email} meminta reset waiting time login. Auto approve dalam ${settings.auto_approve_hours} jam jika fitur aktif.`,
        type: "auth_lockout_reset_request",
        data: { requestId: request.id, email, lockoutLevel, failureCount },
      });
      if (notificationError) {
        console.warn("[auth-lockout-reset] Admin notification insert skipped:", notificationError.message);
      }

      return json({
        success: true,
        message: "Request reset waiting time dikirim ke Admin SIPENA.",
        request,
      });
    }

    if (body.action === "check") {
      const email = normalizeEmail(body.email || "");
      if (!body.requestId || !isEmail(email)) return json({ success: false, error: "Request tidak valid" }, 400);

      await autoApproveExpired(supabaseAdmin);
      const settings = await getSettings(supabaseAdmin);
      const { data: request, error } = await supabaseAdmin
        .from("auth_lockout_reset_requests")
        .select("*")
        .eq("id", body.requestId)
        .eq("normalized_email", email)
        .single();
      if (error) throw error;

      return json({ success: true, request, settings });
    }

    if (body.action === "admin_list") {
      if (!(await verifyAdminPassword(body.adminPassword))) {
        return json({ success: false, error: "Password admin salah" }, 403);
      }
      const { settings } = await autoApproveExpired(supabaseAdmin);
      const { data: requests, error } = await supabaseAdmin
        .from("auth_lockout_reset_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      return json({ success: true, requests: requests || [], settings });
    }

    if (body.action === "admin_approve" || body.action === "admin_reject") {
      if (!(await verifyAdminPassword(body.adminPassword))) {
        return json({ success: false, error: "Password admin salah" }, 403);
      }
      if (!body.requestId) return json({ success: false, error: "Request ID wajib diisi" }, 400);

      const status: RequestStatus = body.action === "admin_approve" ? "approved" : "rejected";
      const { data: request, error } = await supabaseAdmin
        .from("auth_lockout_reset_requests")
        .update({
          status,
          processed_at: new Date().toISOString(),
          processed_by: "admin",
          admin_response: body.adminResponse || (status === "approved" ? "Disetujui oleh admin" : "Ditolak oleh admin"),
        })
        .eq("id", body.requestId)
        .eq("status", "pending")
        .select("*")
        .single();
      if (error) throw error;

      return json({
        success: true,
        request,
        message: status === "approved" ? "Request reset waiting time disetujui." : "Request reset waiting time ditolak.",
      });
    }

    if (body.action === "process_expired") {
      if (!(await verifyAdminPassword(body.adminPassword))) {
        return json({ success: false, error: "Password admin salah" }, 403);
      }
      const result = await autoApproveExpired(supabaseAdmin);
      return json({ success: true, processed: result.processed, settings: result.settings });
    }

    if (body.action === "admin_update_settings") {
      if (!(await verifyAdminPassword(body.adminPassword))) {
        return json({ success: false, error: "Password admin salah" }, 403);
      }

      const { data: settings, error } = await supabaseAdmin
        .from("auth_lockout_reset_settings")
        .upsert({
          id: "global",
          auto_approve_enabled: body.autoApproveEnabled === true,
          auto_approve_hours: AUTO_APPROVE_HOURS,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" })
        .select("auto_approve_enabled, auto_approve_hours")
        .single();
      if (error) throw error;

      return json({ success: true, settings });
    }

    return json({ success: false, error: "Action tidak dikenal" }, 400);
  } catch (error) {
    console.error("[auth-lockout-reset] Error:", error);
    return json({ success: false, error: publicErrorMessage(error) }, 500);
  }
});
