import type { PreparedOcrImage } from "./types";

export const OCR_MAX_IMAGES = 5;
export const OCR_MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const OCR_MAX_PROCESSED_BYTES = 800_000;
export const OCR_MAX_DIMENSION = 2048;
export const OCR_ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateOcrImageFiles(files: File[], existingCount = 0) {
  if (files.length + existingCount > OCR_MAX_IMAGES) throw new Error(`Maksimal ${OCR_MAX_IMAGES} foto per sesi OCR.`);
  files.forEach((file) => {
    if (!OCR_ALLOWED_MIME_TYPES.has(file.type)) throw new Error(`${file.name}: gunakan JPG, PNG, atau WebP.`);
    if (file.size > OCR_MAX_SOURCE_BYTES) throw new Error(`${file.name}: ukuran foto maksimal 10 MB.`);
  });
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca foto."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Foto tidak dapat dibuka oleh browser."));
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Gagal mengompres foto.")), "image/webp", quality);
  });
}

export async function prepareOcrImage(file: File, page: number): Promise<PreparedOcrImage> {
  validateOcrImageFiles([file]);
  const sourceUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceUrl);
  const scale = Math.min(1, OCR_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Browser tidak mendukung pemrosesan foto OCR.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.88;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > OCR_MAX_PROCESSED_BYTES && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > OCR_MAX_PROCESSED_BYTES) throw new Error(`${file.name}: foto masih terlalu besar setelah dikompres.`);

  const previewUrl = await readFileAsDataUrl(blob);
  const base64 = previewUrl.split(",")[1] || "";
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: "image/webp",
    base64,
    page,
    previewUrl,
    originalSize: file.size,
    processedSize: blob.size,
  };
}
