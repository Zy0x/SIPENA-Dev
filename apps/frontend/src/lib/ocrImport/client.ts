import { supabaseExternal } from "@/core/repositories/supabase-compat.repository";
import { logActivity } from "@/lib/activityLogger";
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

export async function uploadOcrImageAndLog({
  userId,
  classId,
  subjectId,
  kind,
  base64,
  imageName,
  recordsCount,
}: {
  userId: string;
  classId: string;
  subjectId?: string;
  kind: string;
  base64: string;
  imageName: string;
  recordsCount: number;
}): Promise<string | null> {
  try {
    // 1. Konversi base64 ke Blob
    const response = await fetch(`data:image/webp;base64,${base64}`);
    const blob = await response.blob();

    // 2. Upload file ke storage bucket 'ocr-imports'
    const fileId = crypto.randomUUID();
    const filePath = `${userId}/${fileId}.webp`;
    
    const { error: uploadError } = await supabaseExternal.storage
      .from("ocr-imports")
      .upload(filePath, blob, {
        upsert: true,
        contentType: "image/webp",
      });

    if (uploadError) {
      console.error("Gagal mengunggah foto OCR ke Storage:", uploadError);
      return null;
    }

    // 3. Masukkan record metadata log ke public.ocr_imports
    const { data: logData, error: logError } = await (supabaseExternal as any)
      .from("ocr_imports")
      .insert([{
        user_id: userId,
        class_id: classId,
        subject_id: subjectId || null,
        kind,
        image_path: filePath,
        records_count: recordsCount,
      }])
      .select()
      .single();

    if (logError) {
      console.error("Gagal menyimpan log audit OCR ke Database:", logError);
      return null;
    }

    // 4. Catat aktivitas ke tabel activity_logs
    await logActivity({
      userId,
      action: "import_ocr",
      entityType: "ocr_imports",
      entityId: logData.id,
      entityName: imageName,
      metadata: {
        kind,
        records_count: recordsCount,
        image_path: filePath,
      },
    });

    return filePath;
  } catch (error) {
    console.error("Gagal mencatat audit OCR:", error);
    return null;
  }
}
