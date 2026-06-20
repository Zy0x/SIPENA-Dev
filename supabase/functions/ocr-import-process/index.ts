import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const REFINEMENT_MODEL = "openai/gpt-oss-20b";
const GROQ_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_IMAGE_BASE64_LENGTH = 2_100_000;
const MAX_COLUMNS = 40;
const MAX_ROWS = 500;
const MAX_CELL_LENGTH = 300;
const VISION_TIMEOUT_MS = 45_000;
const REFINEMENT_TIMEOUT_MS = 30_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ImportKind = "students" | "grades" | "attendance";
type Semantic = "order" | "student_name" | "nisn" | "grade" | "date" | "attendance_status" | "unknown";

interface SafeImage {
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  page: number;
}

interface SafeRequest {
  kind: ImportKind;
  images: SafeImage[];
}

interface RawTable {
  page: number;
  rawText: string;
  headers: string[];
  rows: string[][];
  handwritten: boolean;
  confidence: number;
}

interface NormalizedColumn {
  id: string;
  label: string;
  semantic: Semantic;
  confidence: number;
}

interface NormalizedRow {
  id: string;
  page: number;
  values: string[];
  confidence: number;
  handwritten: boolean;
}

const validKinds = new Set<ImportKind>(["students", "grades", "attendance"]);
const validMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const validSemantics = new Set<Semantic>(["order", "student_name", "nisn", "grade", "date", "attendance_status", "unknown"]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanText(value: unknown, maxLength = MAX_CELL_LENGTH) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function cleanMultilineText(value: unknown, maxLength = 50_000) {
  if (typeof value !== "string") return "";
  const printableValue = Array.from(value.replace(/\r\n?/g, "\n"), (character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || (code >= 32 && code !== 127) ? character : "";
  }).join("");
  return printableValue
    .replace(/[^\S\n\t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function normalizeKey(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function confidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function safePage(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_IMAGES)
    : fallback;
}

function parseRequest(rawBody: string): SafeRequest {
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) throw new Error("payload_too_large");
  const input = JSON.parse(rawBody) as Record<string, unknown>;
  if (input.mode !== "ocr_import" || !validKinds.has(input.kind as ImportKind)) throw new Error("payload_schema");
  if (!Array.isArray(input.images) || input.images.length === 0 || input.images.length > MAX_IMAGES) throw new Error("image_count");

  const images = input.images.map((value, index): SafeImage => {
    const image = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const mimeType = cleanText(image.mimeType) as SafeImage["mimeType"];
    const base64 = typeof image.base64 === "string" ? image.base64.trim() : "";
    if (!validMimeTypes.has(mimeType) || !base64 || base64.length > MAX_IMAGE_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(base64)) {
      throw new Error("image_invalid");
    }
    return {
      name: cleanText(image.name, 120) || `Foto ${index + 1}`,
      mimeType,
      base64,
      page: safePage(image.page, index + 1),
    };
  });

  return { kind: input.kind as ImportKind, images };
}

function extractJson(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced?.[1]?.trim() || trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const match = body.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("invalid_ai_json");
    return JSON.parse(match[0]);
  }
}

async function fetchWithTimeout(body: Record<string, unknown>, apiKey: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(GROQ_COMPLETIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractionPrompt(kind: ImportKind) {
  const domain = kind === "students"
    ? "daftar siswa dengan nomor urut, nama siswa, dan NISN"
    : kind === "grades"
      ? "tabel nilai dengan nama siswa, NISN bila ada, serta semua judul dan nilai tugas"
      : "daftar presensi dengan nama siswa, NISN bila ada, tanggal, dan status kehadiran";
  return [
    `Lakukan OCR presisi pada foto ${domain}.`,
    "Salin teks yang benar-benar terlihat. Jangan mengarang nama, NISN, nilai, tanggal, atau status.",
    "Pertahankan urutan foto, baris, dan kolom. Nilai 0 harus tetap 0.",
    "Jika sel tidak terbaca, gunakan string kosong. Tandai handwritten=true bila mayoritas baris berupa tulisan tangan.",
    "Kembalikan JSON saja dengan bentuk:",
    '{"rawText":"gabungan semua foto","tables":[{"page":1,"rawText":"teks mentah khusus foto halaman 1","headers":["..."],"rows":[["..."]],"handwritten":false,"confidence":0.9}],"warnings":["..."]}',
  ].join("\n");
}

async function runVisionPass(request: SafeRequest, apiKey: string) {
  const content = [
    { type: "text", text: extractionPrompt(request.kind) },
    ...request.images.map((image) => ({
      type: "image_url",
      image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
    })),
  ];
  const response = await fetchWithTimeout({
    model: VISION_MODEL,
    messages: [{ role: "user", content }],
    temperature: 0,
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
  }, apiKey, VISION_TIMEOUT_MS);
  if (!response.ok) throw new Error(`vision_http_${response.status}`);
  const data = await response.json();
  return extractJson(String(data.choices?.[0]?.message?.content || ""));
}

function sanitizeRawTables(raw: unknown): { rawText: string; tables: RawTable[]; warnings: string[] } {
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const tables = (Array.isArray(root.tables) ? root.tables : []).slice(0, MAX_IMAGES * 3).flatMap((value, tableIndex): RawTable[] => {
    const table = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const headers = (Array.isArray(table.headers) ? table.headers : []).slice(0, MAX_COLUMNS).map((item) => cleanText(item, 100));
    const rows = (Array.isArray(table.rows) ? table.rows : []).slice(0, MAX_ROWS).flatMap((row): string[][] => {
      if (!Array.isArray(row)) return [];
      const values = row.slice(0, headers.length || MAX_COLUMNS).map((item) => cleanText(item));
      return values.some(Boolean) ? [values] : [];
    });
    if (headers.length === 0 && rows.length === 0) return [];
    return [{
      page: safePage(table.page, tableIndex + 1),
      rawText: cleanMultilineText(table.rawText, 12_000),
      headers,
      rows,
      handwritten: table.handwritten === true,
      confidence: confidence(table.confidence),
    }];
  });
  return {
    rawText: cleanMultilineText(root.rawText),
    tables,
    warnings: Array.isArray(root.warnings) ? root.warnings.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 12) : [],
  };
}

function buildPageTexts(images: SafeImage[], tables: RawTable[]) {
  return images.map((image) => {
    const pageTables = tables.filter((table) => table.page === image.page);
    const ocrText = pageTables.map((table) => table.rawText).filter(Boolean).join("\n\n");
    if (ocrText) return { page: image.page, text: ocrText, source: "ocr" as const };

    const tableText = pageTables.map((table) => [
      table.headers.join("\t"),
      ...table.rows.map((row) => row.join("\t")),
    ].filter(Boolean).join("\n")).filter(Boolean).join("\n\n");
    return { page: image.page, text: tableText, source: "table_fallback" as const };
  });
}

function inferSemantic(label: string, kind: ImportKind): Semantic {
  const key = normalizeKey(label);
  if (/^(no|nomor|nomor urut|absen|no absen)$/.test(key)) return "order";
  if (key.includes("nisn") || key === "nis" || key.includes("nomor induk")) return "nisn";
  if (key.includes("nama") || key === "siswa" || key === "murid") return "student_name";
  if (kind === "attendance" && (key.includes("tanggal") || key === "date" || key === "tgl")) return "date";
  if (kind === "attendance" && (key.includes("status") || key.includes("keterangan") || key === "ket")) return "attendance_status";
  if (kind === "grades" && key) return "grade";
  return "unknown";
}

function canonicalLabel(semantic: Semantic, original: string) {
  if (semantic === "order") return "No";
  if (semantic === "student_name") return "Nama Siswa";
  if (semantic === "nisn") return "NISN";
  if (semantic === "date") return "Tanggal";
  if (semantic === "attendance_status") return "Status";
  return original || "Kolom";
}

function localNormalize(kind: ImportKind, raw: ReturnType<typeof sanitizeRawTables>) {
  const labels: string[] = [];
  raw.tables.forEach((table) => table.headers.forEach((header, index) => {
    const label = header || `Kolom ${index + 1}`;
    if (!labels.some((item) => normalizeKey(item) === normalizeKey(label))) labels.push(label);
  }));
  const columns = labels.slice(0, MAX_COLUMNS).map((label, index): NormalizedColumn => {
    const semantic = inferSemantic(label, kind);
    return { id: `column-${index + 1}`, label: canonicalLabel(semantic, label), semantic, confidence: 0.7 };
  });
  const rows: NormalizedRow[] = [];
  raw.tables.forEach((table) => {
    const headerKeys = table.headers.map(normalizeKey);
    table.rows.forEach((sourceRow) => {
      const values = columns.map((column) => {
        const sourceIndex = headerKeys.findIndex((header) => header === normalizeKey(column.label)
          || inferSemantic(header, kind) === column.semantic && column.semantic !== "unknown" && column.semantic !== "grade");
        return sourceIndex >= 0 ? cleanText(sourceRow[sourceIndex]) : "";
      });
      if (values.some(Boolean)) rows.push({
        id: `ocr-row-${rows.length + 1}`,
        page: table.page,
        values,
        confidence: table.confidence,
        handwritten: table.handwritten,
      });
    });
  });
  return { columns, rows };
}

function refinementPrompt(kind: ImportKind, raw: ReturnType<typeof sanitizeRawTables>) {
  const canonical = kind === "students"
    ? "No, Nama Siswa, NISN"
    : kind === "attendance"
      ? "Nama Siswa, NISN bila ada, Tanggal, Status"
      : "Nama Siswa, NISN bila ada, kemudian seluruh kolom nilai dengan judul aslinya";
  return [
    `Rapikan hasil OCR menjadi tabel ${kind}. Kolom wajib/canonical: ${canonical}.`,
    "Jangan mengarang atau menambah data. Pertahankan nilai 0, urutan foto, dan urutan baris.",
    "Semantic yang diizinkan: order, student_name, nisn, grade, date, attendance_status, unknown.",
    "Kembalikan JSON saja:",
    '{"columns":[{"id":"column-1","label":"Nama Siswa","semantic":"student_name","confidence":0.9}],"rows":[{"id":"row-1","page":1,"values":["..."],"confidence":0.9,"handwritten":false}],"warnings":["..."]}',
    `DATA OCR:\n${JSON.stringify(raw)}`,
  ].join("\n");
}

function sanitizeNormalized(raw: unknown, kind: ImportKind) {
  const root = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const columns = (Array.isArray(root.columns) ? root.columns : []).slice(0, MAX_COLUMNS).flatMap((value, index): NormalizedColumn[] => {
    const column = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const semantic = validSemantics.has(column.semantic as Semantic) ? column.semantic as Semantic : "unknown";
    return [{
      id: cleanText(column.id, 60) || `column-${index + 1}`,
      label: canonicalLabel(semantic, cleanText(column.label, 100)),
      semantic,
      confidence: confidence(column.confidence),
    }];
  });
  if (columns.length === 0) throw new Error("refinement_columns_empty");
  const rows = (Array.isArray(root.rows) ? root.rows : []).slice(0, MAX_ROWS).flatMap((value, index): NormalizedRow[] => {
    const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const values = Array.isArray(row.values) ? row.values.slice(0, columns.length).map((item) => cleanText(item)) : [];
    while (values.length < columns.length) values.push("");
    if (!values.some(Boolean)) return [];
    return [{
      id: cleanText(row.id, 80) || `ocr-row-${index + 1}`,
      page: safePage(row.page, 1),
      values,
      confidence: confidence(row.confidence),
      handwritten: row.handwritten === true,
    }];
  });
  if (rows.length === 0) throw new Error("refinement_rows_empty");
  const required = kind === "attendance"
    ? ["student_name", "date", "attendance_status"]
    : ["student_name"];
  if (!required.every((semantic) => columns.some((column) => column.semantic === semantic))) throw new Error("refinement_required_columns");
  return {
    columns,
    rows,
    warnings: Array.isArray(root.warnings) ? root.warnings.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 12) : [],
  };
}

async function runRefinementPass(kind: ImportKind, raw: ReturnType<typeof sanitizeRawTables>, apiKey: string) {
  const response = await fetchWithTimeout({
    model: REFINEMENT_MODEL,
    messages: [
      { role: "system", content: "Kamu hanya menormalkan hasil OCR ke JSON. Jangan mengarang data dan jangan memberi instruksi database." },
      { role: "user", content: refinementPrompt(kind, raw) },
    ],
    temperature: 0,
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    reasoning_effort: "low",
  }, apiKey, REFINEMENT_TIMEOUT_MS);
  if (!response.ok) throw new Error(`refinement_http_${response.status}`);
  const data = await response.json();
  return sanitizeNormalized(extractJson(String(data.choices?.[0]?.message?.content || "")), kind);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method tidak didukung." }, 405);

  const requestId = crypto.randomUUID();
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return jsonResponse({ error: "Login diperlukan untuk memakai OCR." }, 401);

  let request: SafeRequest;
  try {
    request = parseRequest(await req.text());
  } catch (error) {
    console.warn(JSON.stringify({ requestId, stage: "request", errorType: error instanceof Error ? error.message : "invalid_request" }));
    return jsonResponse({ error: "Foto OCR tidak valid atau melewati batas aman." }, 400);
  }

  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) {
    console.warn(JSON.stringify({ requestId, stage: "config", errorType: "missing_groq_key" }));
    return jsonResponse({ error: "Layanan OCR belum tersedia." }, 503);
  }

  const startedAt = Date.now();
  try {
    const raw = sanitizeRawTables(await runVisionPass(request, apiKey));
    if (raw.tables.length === 0) throw new Error("vision_empty");

    let normalized: ReturnType<typeof localNormalize> & { warnings?: string[] };
    let usedFallback = false;
    try {
      normalized = await runRefinementPass(request.kind, raw, apiKey);
    } catch (error) {
      usedFallback = true;
      normalized = localNormalize(request.kind, raw);
      console.warn(JSON.stringify({ requestId, stage: "refinement", errorType: error instanceof Error ? error.message : "refinement_failed" }));
    }

    console.info(JSON.stringify({
      requestId,
      kind: request.kind,
      imageCount: request.images.length,
      rowCount: normalized.rows.length,
      usedFallback,
      durationMs: Date.now() - startedAt,
    }));
    const pageTexts = buildPageTexts(request.images, raw.tables);
    return jsonResponse({
      requestId,
      kind: request.kind,
      rawText: raw.rawText || pageTexts.map((item) => item.text).filter(Boolean).join("\n\n"),
      pageTexts,
      columns: normalized.columns,
      rows: normalized.rows,
      warnings: [...raw.warnings, ...(normalized.warnings || [])].slice(0, 12),
      usedFallback,
    });
  } catch (error) {
    const errorType = error instanceof Error && error.name === "AbortError"
      ? "timeout"
      : error instanceof Error ? error.message : "ocr_failed";
    console.warn(JSON.stringify({ requestId, stage: "vision", errorType, durationMs: Date.now() - startedAt }));
    return jsonResponse({ error: "Teks tidak berhasil dibaca. Coba foto yang lebih jelas atau gunakan editor manual.", requestId }, 422);
  }
});
