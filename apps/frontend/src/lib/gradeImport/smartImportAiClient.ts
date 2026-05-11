import {
  createSmartImportAssistFallback,
  sanitizeSmartImportAssistResponse,
  type SmartImportAssistRequest,
  type SmartImportAssistResponse,
} from "./smartImportAiTypes";

type SmartImportAssistInvokeResult = {
  data?: unknown;
  error?: { message?: string } | Error | null;
};

type SmartImportAssistInvoker = (payload: SmartImportAssistRequest) => Promise<SmartImportAssistInvokeResult>;

interface SmartImportAssistClientOptions {
  timeoutMs?: number;
  invoke?: SmartImportAssistInvoker;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const SAFE_FALLBACK_NOTE = "AI tidak tersedia. Lanjutkan dengan pemeriksaan manual.";
const TIMEOUT_FALLBACK_NOTE = "AI membutuhkan waktu terlalu lama. Lanjutkan dengan pemeriksaan manual.";
const AUTH_FALLBACK_NOTE = "Login diperlukan sebelum meminta saran AI.";

const TECHNICAL_ERROR_PATTERN = /\b(edge function|non-2xx|functionshttp|failed to fetch|networkerror|fetch failed|internal server error|http status|status code|groq|json|payload|timeout \d+\s*ms)\b/i;

function timeoutFallback(timeoutMs: number): Promise<SmartImportAssistInvokeResult> {
  return new Promise((resolve) => {
    globalThis.setTimeout(() => {
      resolve({ error: new Error(`Saran AI melewati batas waktu ${timeoutMs} ms.`) });
    }, timeoutMs);
  });
}

function fallbackFromError(error: unknown): SmartImportAssistResponse {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes("login diperlukan") || lowerMessage.includes("authorization") || lowerMessage.includes("auth")) {
    return createSmartImportAssistFallback(AUTH_FALLBACK_NOTE);
  }
  if (lowerMessage.includes("melewati batas waktu") || lowerMessage.includes("timeout")) {
    return createSmartImportAssistFallback(TIMEOUT_FALLBACK_NOTE);
  }
  if (!message || TECHNICAL_ERROR_PATTERN.test(message)) {
    return createSmartImportAssistFallback(SAFE_FALLBACK_NOTE);
  }
  return createSmartImportAssistFallback(SAFE_FALLBACK_NOTE);
}

export async function requestSmartImportAssist(
  payload: SmartImportAssistRequest,
  options: SmartImportAssistClientOptions = {},
): Promise<SmartImportAssistResponse> {
  const request: SmartImportAssistRequest = {
    ...payload,
    mode: "grade_import_assist",
  };
  const invoke = options.invoke || (async (body: SmartImportAssistRequest) => {
    const { supabaseExternal } = await import("@/infrastructure/supabase/supabase-client");
    return supabaseExternal.functions.invoke("smart-import-assist", { body });
  });
  const timeoutMs = Math.max(1_000, options.timeoutMs || DEFAULT_TIMEOUT_MS);

  try {
    const result = await Promise.race([
      invoke(request),
      timeoutFallback(timeoutMs),
    ]);
    if (result.error) return fallbackFromError(result.error);
    return sanitizeSmartImportAssistResponse(result.data, request);
  } catch (error) {
    return fallbackFromError(error);
  }
}
