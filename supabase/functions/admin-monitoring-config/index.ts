import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  cleanText,
  getRuntimeConfig,
  getServiceClient,
  jsonResponse,
  monitoringCorsHeaders,
  sendTelegramMessage,
  validateTelegramBot,
  verifyAdminSession,
} from "../_shared/monitoring.ts";

type Severity = "p1" | "p2" | "p3";

async function requireAdmin(req: Request, body: Record<string, unknown>) {
  const expectedPassword = Deno.env.get("ADMIN_DB_PASSWORD");
  if (!expectedPassword || body.password !== expectedPassword) {
    throw new Response(JSON.stringify({ success: false, error: "Kredensial admin tidak valid" }), {
      status: 401,
      headers: { ...monitoringCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = getServiceClient();
  const session = await verifyAdminSession(
    supabaseAdmin,
    req.headers.get("x-admin-session-token"),
  );
  if (!session.valid) {
    throw new Response(JSON.stringify({ success: false, error: "Sesi admin tidak valid atau kedaluwarsa" }), {
      status: 401,
      headers: { ...monitoringCorsHeaders, "Content-Type": "application/json" },
    });
  }
  return { supabaseAdmin, actor: session.actor };
}

async function recordTest(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  actor: string,
  success: boolean,
  message: string,
  username = "",
) {
  await supabaseAdmin.rpc("monitoring_admin_record_test", {
    p_success: success,
    p_message: message,
    p_bot_username: username,
    p_actor: actor,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: monitoringCorsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Metode tidak didukung" }, 405);

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = cleanText(body.action, 50);
    const { supabaseAdmin, actor } = await requireAdmin(req, body);

    if (action === "get-config") {
      const [{ data: config, error: configError }, { data: audits, error: auditError }] = await Promise.all([
        supabaseAdmin.rpc("monitoring_admin_get_config"),
        supabaseAdmin
          .from("monitoring_audit_logs")
          .select("id, actor, action, success, details, created_at")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);
      if (configError) throw new Error(configError.message);
      if (auditError) throw new Error(auditError.message);
      return jsonResponse({ success: true, config, audits: audits || [] });
    }

    if (action === "save-config") {
      const enabled = body.enabled === true;
      const minimumSeverity = cleanText(body.minimumSeverity, 2) as Severity;
      const sendRecovery = body.sendRecovery !== false;
      const botToken = cleanText(body.botToken, 220) || null;
      const chatId = cleanText(body.chatId, 80) || null;
      const webhookKey = cleanText(body.webhookKey, 300) || null;

      if (!(["p1", "p2", "p3"] as string[]).includes(minimumSeverity)) {
        return jsonResponse({ success: false, error: "Tingkat alert tidak valid" }, 400);
      }
      if (chatId && !/^-?\d{4,30}$/.test(chatId)) {
        return jsonResponse({ success: false, error: "Telegram Chat ID harus berupa angka" }, 400);
      }
      if (webhookKey && webhookKey.length < 32) {
        return jsonResponse({ success: false, error: "Webhook key minimal 32 karakter" }, 400);
      }

      const runtime = await getRuntimeConfig(supabaseAdmin);
      const effectiveToken = botToken || runtime.telegramBotToken || "";
      const effectiveChatId = chatId || runtime.telegramChatId || "";
      const effectiveWebhookKey = webhookKey || runtime.webhookKey || "";
      let botUsername = runtime.botUsername || "";

      if (enabled && (!effectiveToken || !effectiveChatId || !effectiveWebhookKey)) {
        return jsonResponse({ success: false, error: "Bot Token, Chat ID, dan Webhook Key wajib dikonfigurasi sebelum monitoring diaktifkan" }, 400);
      }

      if (botToken || chatId) {
        try {
          const bot = await validateTelegramBot(effectiveToken);
          botUsername = bot.username;
          await sendTelegramMessage(
            effectiveToken,
            effectiveChatId,
            "SIPENA Monitoring terhubung. Pesan ini memastikan Bot Token dan Chat ID dapat digunakan.",
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Validasi Telegram gagal";
          await recordTest(supabaseAdmin, actor, false, message, botUsername);
          return jsonResponse({ success: false, error: `Konfigurasi lama dipertahankan. ${message}` }, 400);
        }
      }

      const { data, error } = await supabaseAdmin.rpc("monitoring_admin_save_config", {
        p_enabled: enabled,
        p_minimum_severity: minimumSeverity,
        p_send_recovery: sendRecovery,
        p_bot_token: botToken,
        p_chat_id: chatId,
        p_webhook_key: webhookKey,
        p_bot_username: botUsername,
        p_actor: actor,
      });
      if (error) throw new Error(error.message);
      return jsonResponse({ success: true, config: data });
    }

    if (action === "test-telegram") {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { count } = await supabaseAdmin
        .from("monitoring_audit_logs")
        .select("id", { count: "exact", head: true })
        .eq("actor", actor)
        .eq("action", "telegram_test")
        .gte("created_at", fiveMinutesAgo);
      if ((count || 0) >= 3) {
        return jsonResponse({ success: false, error: "Batas pengujian tercapai. Coba kembali dalam lima menit." }, 429);
      }

      const runtime = await getRuntimeConfig(supabaseAdmin);
      if (!runtime.telegramBotToken || !runtime.telegramChatId) {
        return jsonResponse({ success: false, error: "Telegram belum dikonfigurasi" }, 400);
      }
      try {
        const bot = await validateTelegramBot(runtime.telegramBotToken);
        await sendTelegramMessage(
          runtime.telegramBotToken,
          runtime.telegramChatId,
          `Tes SIPENA Monitoring berhasil pada ${new Date().toISOString()}.`,
        );
        await recordTest(supabaseAdmin, actor, true, "Pesan uji berhasil dikirim", bot.username);
        const { data: config } = await supabaseAdmin.rpc("monitoring_admin_get_config");
        return jsonResponse({ success: true, config, message: "Pesan uji berhasil dikirim" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pesan uji gagal";
        await recordTest(supabaseAdmin, actor, false, message, runtime.botUsername || "");
        return jsonResponse({ success: false, error: message }, 502);
      }
    }

    if (action === "disconnect-telegram") {
      if (body.confirmation !== "PUTUSKAN TELEGRAM") {
        return jsonResponse({ success: false, error: "Konfirmasi pemutusan tidak valid" }, 400);
      }
      const { data, error } = await supabaseAdmin.rpc("monitoring_admin_disconnect_telegram", {
        p_actor: actor,
      });
      if (error) throw new Error(error.message);
      return jsonResponse({ success: true, config: data });
    }

    return jsonResponse({ success: false, error: "Aksi monitoring tidak dikenal" }, 400);
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Kesalahan internal monitoring";
    console.error("admin-monitoring-config:", message);
    return jsonResponse({ success: false, error: "Konfigurasi monitoring tidak dapat diproses" }, 500);
  }
});
