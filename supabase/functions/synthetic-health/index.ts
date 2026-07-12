import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  cleanText,
  constantTimeSecretEqual,
  getRuntimeConfig,
  getServiceClient,
  jsonResponse,
  monitoringCorsHeaders,
} from "../_shared/monitoring.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: monitoringCorsHeaders });
  if (req.method !== "GET") return jsonResponse({ ok: false, error: "Metode tidak didukung" }, 405);

  const startedAt = performance.now();
  try {
    const supabaseAdmin = getServiceClient();
    const runtime = await getRuntimeConfig(supabaseAdmin);
    if (!runtime.webhookKey) return jsonResponse({ ok: false, error: "Health monitor belum dikonfigurasi" }, 503);

    const keyValid = await constantTimeSecretEqual(
      runtime.webhookKey,
      cleanText(req.headers.get("x-sipena-monitor-key"), 300),
    );
    if (!keyValid) return jsonResponse({ ok: false, error: "Tidak ditemukan" }, 404);

    const { error: databaseError } = await supabaseAdmin
      .from("monitoring_settings")
      .select("environment")
      .eq("environment", "production")
      .single();
    const latencyMs = Math.round(performance.now() - startedAt);

    if (databaseError) {
      return jsonResponse({
        ok: false,
        services: { edgeRuntime: "ok", database: "error" },
        latencyMs,
        timestamp: new Date().toISOString(),
      }, 503);
    }

    return jsonResponse({
      ok: true,
      services: { edgeRuntime: "ok", database: "ok" },
      latencyMs,
      timestamp: new Date().toISOString(),
      configVersion: runtime.updatedAt || null,
    });
  } catch (error) {
    console.error("synthetic-health:", error instanceof Error ? error.message : "unknown");
    return jsonResponse({
      ok: false,
      services: { edgeRuntime: "ok", database: "unknown" },
      latencyMs: Math.round(performance.now() - startedAt),
      timestamp: new Date().toISOString(),
    }, 503);
  }
});

