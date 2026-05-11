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
  return createSmartImportAssistFallback(message || "AI tidak tersedia. Lanjutkan dengan pemeriksaan manual.");
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
