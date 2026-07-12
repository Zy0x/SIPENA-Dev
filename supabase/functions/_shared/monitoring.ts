import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const monitoringCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-session-token, x-sipena-timestamp, x-sipena-nonce, x-sipena-signature, x-sipena-monitor-key",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...monitoringCorsHeaders, "Content-Type": "application/json" },
  });
}

export function getServiceClient() {
  const supabaseUrl = Deno.env.get("EXTERNAL_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Konfigurasi service role monitoring belum tersedia");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAdminSession(
  supabaseAdmin: ReturnType<typeof getServiceClient>,
  sessionToken: string | null,
) {
  if (!sessionToken) return { valid: false, actor: "admin:missing-session" };

  const tokenHash = await sha256(sessionToken);
  const { data, error } = await supabaseAdmin
    .from("admin_sessions")
    .select("expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || new Date(data.expires_at).getTime() <= Date.now()) {
    return { valid: false, actor: `admin:${tokenHash.slice(0, 12)}` };
  }

  return { valid: true, actor: `admin:${tokenHash.slice(0, 12)}` };
}

export function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function getRuntimeConfig(supabaseAdmin: ReturnType<typeof getServiceClient>) {
  const { data, error } = await supabaseAdmin.rpc("monitoring_get_runtime_config");
  if (error) throw new Error(`Konfigurasi monitoring tidak dapat dibaca: ${error.message}`);
  return (data || {}) as {
    enabled?: boolean;
    minimumSeverity?: "p1" | "p2" | "p3";
    sendRecovery?: boolean;
    telegramBotToken?: string | null;
    telegramChatId?: string | null;
    webhookKey?: string | null;
    botUsername?: string | null;
    updatedAt?: string | null;
  };
}

async function telegramRequest(token: string, method: string, payload?: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.ok) {
    const description = cleanText(result?.description, 180) || `Telegram HTTP ${response.status}`;
    throw new Error(description);
  }
  return result.result;
}

export async function validateTelegramBot(token: string) {
  const result = await telegramRequest(token, "getMe");
  return {
    username: cleanText(result?.username, 80),
    displayName: cleanText(result?.first_name, 100),
  };
}

export async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string,
  actionUrl?: string,
) {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: text.slice(0, 3900),
    disable_web_page_preview: true,
  };
  if (actionUrl && /^https:\/\//i.test(actionUrl)) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: "Buka Detail", url: actionUrl }]],
    };
  }
  return telegramRequest(token, "sendMessage", payload);
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function createHmacSignature(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToHex(new Uint8Array(signature));
}

export async function verifyHmacSignature(secret: string, message: string, provided: string) {
  if (!provided || !/^[a-f0-9]{64}$/i.test(provided)) return false;
  const expected = await createHmacSignature(secret, message);
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ provided.toLowerCase().charCodeAt(index);
  }
  return mismatch === 0;
}

export async function constantTimeSecretEqual(expected: string, provided: string) {
  if (!expected || !provided) return false;
  const [expectedHash, providedHash] = await Promise.all([sha256(expected), sha256(provided)]);
  let mismatch = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    mismatch |= expectedHash.charCodeAt(index) ^ providedHash.charCodeAt(index);
  }
  return mismatch === 0;
}

