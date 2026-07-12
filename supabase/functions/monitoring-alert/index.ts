import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  cleanText,
  getRuntimeConfig,
  getServiceClient,
  jsonResponse,
  monitoringCorsHeaders,
  sendTelegramMessage,
  sha256,
  verifyHmacSignature,
} from "../_shared/monitoring.ts";

type Severity = "p1" | "p2" | "p3";
type AlertStatus = "firing" | "recovered";

const severityRank: Record<Severity, number> = { p1: 1, p2: 2, p3: 3 };

function shouldNotify(severity: Severity, minimum: Severity) {
  return severityRank[severity] <= severityRank[minimum];
}

function buildMessage(payload: {
  monitor: string;
  status: AlertStatus;
  severity: Severity;
  environment: string;
  message: string;
  latencyMs?: number;
  version?: string;
}) {
  const recovered = payload.status === "recovered";
  const lines = [
    recovered ? "SIPENA PULIH" : `SIPENA GANGGUAN ${payload.severity.toUpperCase()}`,
    `Monitor: ${payload.monitor}`,
    `Lingkungan: ${payload.environment}`,
    `Status: ${recovered ? "Pulih" : "Bermasalah"}`,
  ];
  if (payload.message) lines.push(`Detail: ${payload.message}`);
  if (typeof payload.latencyMs === "number") lines.push(`Respons: ${Math.round(payload.latencyMs)} ms`);
  if (payload.version) lines.push(`Versi: ${payload.version}`);
  lines.push(`Waktu: ${new Date().toISOString()}`);
  return lines.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: monitoringCorsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Metode tidak didukung" }, 405);

  const rawBody = await req.text();
  try {
    const supabaseAdmin = getServiceClient();
    const runtime = await getRuntimeConfig(supabaseAdmin);
    if (!runtime.webhookKey) return jsonResponse({ success: false, error: "Webhook monitoring belum dikonfigurasi" }, 503);

    const timestamp = cleanText(req.headers.get("x-sipena-timestamp"), 30);
    const nonce = cleanText(req.headers.get("x-sipena-nonce"), 120);
    const signature = cleanText(req.headers.get("x-sipena-signature"), 128);
    const timestampNumber = Number(timestamp);
    if (!timestamp || !nonce || !Number.isFinite(timestampNumber)) {
      return jsonResponse({ success: false, error: "Signature monitoring tidak lengkap" }, 401);
    }
    if (Math.abs(Date.now() - timestampNumber) > 5 * 60 * 1000) {
      return jsonResponse({ success: false, error: "Request monitoring sudah kedaluwarsa" }, 401);
    }
    const signatureValid = await verifyHmacSignature(
      runtime.webhookKey,
      `${timestamp}.${nonce}.${rawBody}`,
      signature,
    );
    if (!signatureValid) return jsonResponse({ success: false, error: "Signature monitoring tidak valid" }, 401);

    const { error: nonceError } = await supabaseAdmin
      .from("monitoring_alert_nonces")
      .insert({ nonce });
    if (nonceError) return jsonResponse({ success: false, error: "Request monitoring sudah pernah diproses" }, 409);
    await supabaseAdmin
      .from("monitoring_alert_nonces")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const input = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    const monitor = cleanText(input.monitor, 120);
    const status = cleanText(input.status, 20) as AlertStatus;
    const severity = cleanText(input.severity, 2).toLowerCase() as Severity;
    const environment = cleanText(input.environment, 40) || "production";
    const message = cleanText(input.message, 500);
    const actionUrl = cleanText(input.actionUrl, 500);
    const version = cleanText(input.version, 120);
    const latencyMs = typeof input.latencyMs === "number" && Number.isFinite(input.latencyMs)
      ? Math.max(0, Math.min(input.latencyMs, 600_000))
      : undefined;

    if (!monitor || !(["firing", "recovered"] as string[]).includes(status)) {
      return jsonResponse({ success: false, error: "Payload monitoring tidak valid" }, 400);
    }
    if (!(["p1", "p2", "p3"] as string[]).includes(severity)) {
      return jsonResponse({ success: false, error: "Severity monitoring tidak valid" }, 400);
    }

    const fingerprint = cleanText(input.fingerprint, 180) || await sha256(`${environment}:${monitor}`);
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("monitoring_incidents")
      .select("*")
      .eq("fingerprint", fingerprint)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const safePayload = {
      monitor,
      status,
      severity,
      environment,
      message,
      latencyMs,
      version,
      actionUrl: /^https:\/\//i.test(actionUrl) ? actionUrl : "",
    };

    let shouldSend = false;
    let notificationKind: "open" | "recovery" = "open";

    if (status === "firing") {
      shouldSend = !existing || existing.status === "recovered" || !existing.telegram_open_sent;
      const row = {
        fingerprint,
        monitor_name: monitor,
        severity,
        status: "open",
        first_seen_at: existing?.status === "open" ? existing.first_seen_at : new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        recovered_at: null,
        occurrence_count: existing?.status === "open" ? (existing.occurrence_count || 0) + 1 : 1,
        last_payload: safePayload,
        telegram_open_sent: existing?.status === "open" ? !!existing.telegram_open_sent : false,
        telegram_recovery_sent: false,
      };
      const { error } = await supabaseAdmin.from("monitoring_incidents").upsert(row);
      if (error) throw new Error(error.message);
    } else {
      notificationKind = "recovery";
      shouldSend = !!existing && existing.status === "open" && !existing.telegram_recovery_sent;
      if (existing) {
        const { error } = await supabaseAdmin
          .from("monitoring_incidents")
          .update({
            status: "recovered",
            recovered_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            last_payload: safePayload,
          })
          .eq("fingerprint", fingerprint);
        if (error) throw new Error(error.message);
      }
    }

    const severityAllowed = shouldNotify(severity, runtime.minimumSeverity || "p1");
    const channelReady = !!runtime.telegramBotToken && !!runtime.telegramChatId;
    const recoveryAllowed = status !== "recovered" || runtime.sendRecovery !== false;
    const willSend = !!runtime.enabled && shouldSend && severityAllowed && channelReady && recoveryAllowed;

    if (willSend) {
      try {
        await sendTelegramMessage(
          runtime.telegramBotToken!,
          runtime.telegramChatId!,
          buildMessage(safePayload),
          safePayload.actionUrl || undefined,
        );
        await supabaseAdmin
          .from("monitoring_incidents")
          .update(notificationKind === "open"
            ? { telegram_open_sent: true }
            : { telegram_recovery_sent: true })
          .eq("fingerprint", fingerprint);
      } catch (error) {
        const failure = error instanceof Error ? error.message : "Telegram gagal";
        await supabaseAdmin.from("monitoring_audit_logs").insert({
          actor: "monitoring-alert",
          action: `telegram_${notificationKind}`,
          success: false,
          details: { fingerprint, monitor, error: cleanText(failure, 180) },
        });
        return jsonResponse({ success: false, accepted: true, error: "Incident tersimpan, tetapi Telegram gagal dikirim" }, 502);
      }
    }

    await supabaseAdmin.from("monitoring_audit_logs").insert({
      actor: "monitoring-alert",
      action: status === "recovered" ? "incident_recovered" : "incident_firing",
      success: true,
      details: {
        fingerprint,
        monitor,
        severity,
        notificationSent: willSend,
        skipReason: willSend
          ? null
          : !runtime.enabled
            ? "monitoring_disabled"
            : !severityAllowed
              ? "below_threshold"
              : !channelReady
                ? "telegram_not_configured"
                : !shouldSend
                  ? "duplicate"
                  : !recoveryAllowed
                    ? "recovery_disabled"
                    : "not_required",
      },
    });

    return jsonResponse({ success: true, accepted: true, notificationSent: willSend });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kesalahan internal alert";
    console.error("monitoring-alert:", cleanText(message, 180));
    return jsonResponse({ success: false, error: "Alert monitoring tidak dapat diproses" }, 500);
  }
});

