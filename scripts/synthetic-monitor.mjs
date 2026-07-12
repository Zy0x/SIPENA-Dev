import { createHmac, randomUUID } from "node:crypto";
import { verifyRemoteSite } from "./verify-web-not-blank.mjs";

const siteUrl = process.env.SYNTHETIC_SITE_URL || "https://sipenadev.netlify.app";
const supabaseUrl = process.env.SYNTHETIC_SUPABASE_URL || "";
const anonKey = process.env.SYNTHETIC_SUPABASE_ANON_KEY || "";
const canaryEmail = process.env.SYNTHETIC_CANARY_EMAIL || "";
const canaryPassword = process.env.SYNTHETIC_CANARY_PASSWORD || "";
const webhookKey = process.env.SYNTHETIC_WEBHOOK_KEY || "";
const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : "";

async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendAlert(status, message, latencyMs, version = "") {
  if (!supabaseUrl || !webhookKey) {
    console.warn("[synthetic] Alert endpoint dilewati: Supabase URL/webhook key belum dikonfigurasi.");
    return;
  }
  const body = JSON.stringify({
    monitor: "sipena-production-deep-check",
    fingerprint: "sipena-production-deep-check",
    environment: "production",
    status,
    severity: "p1",
    message: String(message).slice(0, 500),
    latencyMs,
    version,
    actionUrl: runUrl,
  });
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const signature = createHmac("sha256", webhookKey)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest("hex");
  const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/monitoring-alert`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sipena-timestamp": timestamp,
      "x-sipena-nonce": nonce,
      "x-sipena-signature": signature,
    },
    body,
  });
  if (!response.ok) {
    console.warn(`[synthetic] Endpoint alert merespons ${response.status}.`);
  }
}

async function checkVersion() {
  const response = await fetchWithTimeout(`${siteUrl.replace(/\/$/, "")}/version.json?t=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`version.json gagal (${response.status})`);
  const data = await response.json();
  if (!data || typeof data !== "object") throw new Error("version.json tidak valid");
  return String(data.version || data.buildHash || data.buildId || "unknown").slice(0, 120);
}

async function checkHealth() {
  if (!supabaseUrl || !webhookKey) {
    console.warn("[synthetic] Health check dilewati: secret belum dikonfigurasi.");
    return;
  }
  const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/synthetic-health`, {
    headers: { "x-sipena-monitor-key": webhookKey },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) throw new Error(`Supabase health gagal (${response.status})`);
}

async function checkAuthAndReadAccess() {
  if (!supabaseUrl || !anonKey || !canaryEmail || !canaryPassword) {
    console.warn("[synthetic] Auth canary dilewati: credential belum lengkap.");
    return;
  }
  const loginResponse = await fetchWithTimeout(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey },
    body: JSON.stringify({ email: canaryEmail, password: canaryPassword }),
  });
  const session = await loginResponse.json().catch(() => ({}));
  if (!loginResponse.ok || !session.access_token) throw new Error(`Login canary gagal (${loginResponse.status})`);

  const authHeaders = { apikey: anonKey, Authorization: `Bearer ${session.access_token}` };
  const [userResponse, classesResponse, featureResponse] = await Promise.all([
    fetchWithTimeout(`${supabaseUrl}/auth/v1/user`, { headers: authHeaders }),
    fetchWithTimeout(`${supabaseUrl}/rest/v1/classes?select=id&limit=1`, { headers: authHeaders }),
    fetchWithTimeout(`${supabaseUrl}/functions/v1/admin-feature-access`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "evaluate" }),
    }),
  ]);
  if (!userResponse.ok) throw new Error(`Validasi sesi canary gagal (${userResponse.status})`);
  if (!classesResponse.ok) throw new Error(`Database read-only canary gagal (${classesResponse.status})`);
  if (!featureResponse.ok) throw new Error(`Feature access canary gagal (${featureResponse.status})`);
}

async function run() {
  const startedAt = Date.now();
  let version = "unknown";
  try {
    await verifyRemoteSite(siteUrl, { render: false, timeoutMs: 30_000, logPrefix: "[synthetic]" });
    version = await checkVersion();
    await checkHealth();
    await checkAuthAndReadAccess();
    const latencyMs = Date.now() - startedAt;
    console.log(`[synthetic] Semua pemeriksaan lulus dalam ${latencyMs} ms (versi ${version}).`);
    await sendAlert("recovered", "Semua pemeriksaan produksi berhasil.", latencyMs, version);
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "Pemeriksaan produksi gagal";
    console.error(`[synthetic] ${message}`);
    try {
      await sendAlert("firing", message, latencyMs, version);
    } catch (alertError) {
      console.error(`[synthetic] Pengiriman alert juga gagal: ${alertError instanceof Error ? alertError.message : "unknown"}`);
    }
    process.exitCode = 1;
  }
}

await run();

