import { supabaseExternal } from "@/core/repositories/supabase-compat.repository";
import { sanitizeOcrExtractionResult } from "./validation";
import type { OcrExtractionRequest, OcrExtractionResult } from "./types";

const OCR_TIMEOUT_MS = 90_000;

function timeoutResult() {
  return new Promise<never>((_, reject) => {
    globalThis.setTimeout(() => reject(new Error("OCR membutuhkan waktu terlalu lama. Coba kembali atau gunakan editor manual.")), OCR_TIMEOUT_MS);
  });
}

export async function requestOcrExtraction(request: OcrExtractionRequest): Promise<OcrExtractionResult> {
  const invocation = supabaseExternal.functions.invoke("ocr-import-process", { body: request });
  const result = await Promise.race([invocation, timeoutResult()]);
  if (result.error) throw new Error("OCR tidak dapat memproses foto. Coba kembali atau gunakan editor manual.");
  return sanitizeOcrExtractionResult(result.data, request.kind);
}
