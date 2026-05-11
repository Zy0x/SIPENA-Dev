import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEFAULT_MODEL = "llama-3.1-8b-instant";
const MAX_BODY_BYTES = 500 * 1024;
const MAX_STUDENTS = 200;
const MAX_CHAPTERS = 100;
const MAX_ASSIGNMENTS = 300;
const MAX_CANDIDATE_TABLES = 10;
const MAX_HEADERS = 100;
const MAX_SAMPLE_ROWS = 25;
const MAX_SHEETS = 30;
const MAX_VALUES_PER_ROW = 100;
const MAX_TEXT_LENGTH = 200;
const AI_TIMEOUT_MS = 20_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AssistType = "student" | "column" | "value" | "table" | "structure";
type TargetType = "student" | "assignment" | "chapter" | "table" | "ignore" | "value";
type RiskLevel = "low" | "medium" | "high";

interface NormalizedRequest {
  mode: "grade_import_assist";
  workbookSummary: {
    fileName?: string;
    sheets: Array<{ name: string; rowCount: number; columnCount: number }>;
    candidateTables: Array<{
      id: string;
      sheetName: string;
      headerRowIndex: number;
      dataStartRowIndex: number;
      dataEndRowIndex: number;
      matchedStudentCount: number;
      gradeColumnCount: number;
      sampleStudents: string[];
      headers: string[];
    }>;
    headers: Array<{ columnIndex: number; rawHeader: string }>;
    sampleRows: Array<{ rowIndex: number; values: Array<string | number | null> }>;
  };
  webContext: {
    students: Array<{ id: string; name: string; nisn?: string }>;
    chapters: Array<{ id: string; name: string }>;
    assignments: Array<{ id: string; chapter_id: string; name: string }>;
  };
  deterministicPlan: {
    studentMappings: unknown[];
    columnMappings: unknown[];
    conflicts: unknown[];
    warnings: unknown[];
  };
  model: string;
  notes: string[];
}

interface AssistSuggestion {
  type: AssistType;
  rowIndex?: number;
  columnIndex?: number;
  sourceId?: string;
  suggestedAction: string;
  targetId?: string;
  targetType: TargetType;
  suggestedValue?: number;
  confidence: number;
  reason: string;
  requiresConfirmation: true;
}

const allowedTypes = new Set<AssistType>(["student", "column", "value", "table", "structure"]);
const allowedTargetTypes = new Set<TargetType>(["student", "assignment", "chapter", "table", "ignore", "value"]);
const allowedRiskLevels = new Set<RiskLevel>(["low", "medium", "high"]);
const allowedModels = new Set([
  DEFAULT_MODEL,
  "llama-3.3-70b-versatile",
  "qwen/qwen3-32b",
  "qwen-2.5-32b",
]);
const blockedTextPattern = /\b(select|insert|update|delete|drop|alter|create\s+table|create\s+function|rpc|deploy|migration)\b/i;

function responseJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fallbackResponse(note = "AI tidak tersedia atau hasilnya tidak valid. Lanjutkan dengan pemeriksaan manual.", status = 200): Response {
  return responseJson({
    suggestions: [],
    summary: {
      confidence: 0,
      riskLevel: "high",
      notes: [note],
    },
  }, status);
}

function safeText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeValue(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return safeText(value);
  return null;
}

function normalizeTextArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => safeText(item)).filter(Boolean);
}

function limitedArray(value: unknown, maxItems: number, note: string, notes: string[]): unknown[] {
  if (!Array.isArray(value)) return [];
  if (value.length > maxItems) notes.push(note);
  return value.slice(0, maxItems);
}

function sanitizeUnknown(value: unknown, depth = 0): unknown {
  if (depth > 3) return null;
  if (typeof value === "string") return safeText(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeUnknown(item, depth + 1));
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).slice(0, 30).forEach(([key, item]) => {
      result[safeText(key)] = sanitizeUnknown(item, depth + 1);
    });
    return result;
  }
  return null;
}

function normalizeWorkbookSummary(value: unknown, notes: string[]): NormalizedRequest["workbookSummary"] {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    fileName: safeText(input.fileName) || undefined,
    sheets: limitedArray(input.sheets, MAX_SHEETS, "Sebagian sheet tidak dikirim ke AI karena melewati batas aman.", notes).map((item) => {
      const sheet = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        name: safeText(sheet.name, "Sheet"),
        rowCount: safeNumber(sheet.rowCount),
        columnCount: safeNumber(sheet.columnCount),
      };
    }),
    candidateTables: limitedArray(input.candidateTables, MAX_CANDIDATE_TABLES, "Sebagian tabel kandidat dipotong karena melewati batas aman.", notes).map((item) => {
      const table = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        id: safeText(table.id),
        sheetName: safeText(table.sheetName),
        headerRowIndex: safeNumber(table.headerRowIndex),
        dataStartRowIndex: safeNumber(table.dataStartRowIndex),
        dataEndRowIndex: safeNumber(table.dataEndRowIndex),
        matchedStudentCount: safeNumber(table.matchedStudentCount),
        gradeColumnCount: safeNumber(table.gradeColumnCount),
        sampleStudents: normalizeTextArray(table.sampleStudents, 3),
        headers: normalizeTextArray(table.headers, MAX_HEADERS),
      };
    }).filter((item) => item.id && item.sheetName),
    headers: limitedArray(input.headers, MAX_HEADERS, "Sebagian header dipotong karena melewati batas aman.", notes).map((item) => {
      const header = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        columnIndex: safeNumber(header.columnIndex),
        rawHeader: safeText(header.rawHeader),
      };
    }).filter((item) => item.rawHeader),
    sampleRows: limitedArray(input.sampleRows, MAX_SAMPLE_ROWS, "Sebagian contoh baris dipotong karena melewati batas aman.", notes).map((item) => {
      const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        rowIndex: safeNumber(row.rowIndex),
        values: Array.isArray(row.values)
          ? row.values.slice(0, MAX_VALUES_PER_ROW).map(normalizeValue)
          : [],
      };
    }),
  };
}

function normalizeWebContext(value: unknown, notes: string[]): NormalizedRequest["webContext"] {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    students: limitedArray(input.students, MAX_STUDENTS, "Sebagian data siswa dipotong karena melewati batas aman.", notes).map((item) => {
      const student = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        id: safeText(student.id),
        name: safeText(student.name),
        nisn: safeText(student.nisn) || undefined,
      };
    }).filter((item) => item.id && item.name),
    chapters: limitedArray(input.chapters, MAX_CHAPTERS, "Sebagian BAB dipotong karena melewati batas aman.", notes).map((item) => {
      const chapter = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        id: safeText(chapter.id),
        name: safeText(chapter.name),
      };
    }).filter((item) => item.id && item.name),
    assignments: limitedArray(input.assignments, MAX_ASSIGNMENTS, "Sebagian tugas dipotong karena melewati batas aman.", notes).map((item) => {
      const assignment = item && typeof item === "object" ? item as Record<string, unknown> : {};
      return {
        id: safeText(assignment.id),
        chapter_id: safeText(assignment.chapter_id),
        name: safeText(assignment.name),
      };
    }).filter((item) => item.id && item.chapter_id && item.name),
  };
}

function normalizePlan(value: unknown, notes: string[]): NormalizedRequest["deterministicPlan"] {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const maxPlanItems = 200;
  return {
    studentMappings: limitedArray(input.studentMappings, maxPlanItems, "Sebagian hasil cocok siswa dipotong karena melewati batas aman.", notes).map((item) => sanitizeUnknown(item)),
    columnMappings: limitedArray(input.columnMappings, maxPlanItems, "Sebagian hasil cocok kolom dipotong karena melewati batas aman.", notes).map((item) => sanitizeUnknown(item)),
    conflicts: limitedArray(input.conflicts, maxPlanItems, "Sebagian konflik dipotong karena melewati batas aman.", notes).map((item) => sanitizeUnknown(item)),
    warnings: limitedArray(input.warnings, maxPlanItems, "Sebagian peringatan dipotong karena melewati batas aman.", notes).map((item) => sanitizeUnknown(item)),
  };
}

function normalizeRequest(rawBody: string): NormalizedRequest {
  const notes: string[] = [];
  if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
    notes.push("Ukuran payload melebihi batas aman 500 KB. Data diringkas sebelum dikirim ke AI.");
  }
  const input = JSON.parse(rawBody) as Record<string, unknown>;
  if (!input || typeof input !== "object") throw new Error("payload_schema");
  if (input.mode !== "grade_import_assist") throw new Error("payload_mode");

  return {
    mode: "grade_import_assist",
    workbookSummary: normalizeWorkbookSummary(input.workbookSummary, notes),
    webContext: normalizeWebContext(input.webContext, notes),
    deterministicPlan: normalizePlan(input.deterministicPlan, notes),
    model: allowedModels.has(String(input.model)) ? String(input.model) : DEFAULT_MODEL,
    notes,
  };
}

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced?.[1]?.trim() || trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const match = body.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("ai_invalid_json");
    return JSON.parse(match[0]);
  }
}

function safeNotes(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const notes = value.map((item) => safeText(item)).filter(Boolean).slice(0, 8);
  return notes.length ? notes : fallback;
}

function sanitizeSuggestion(value: unknown, request: NormalizedRequest): AssistSuggestion | null {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const type = item.type;
  const targetType = item.targetType;
  if (!allowedTypes.has(type as AssistType)) return null;
  if (!allowedTargetTypes.has(targetType as TargetType)) return null;

  const suggestedAction = safeText(item.suggestedAction, "Perlu dicek manual");
  const reason = safeText(item.reason, "Periksa saran ini sebelum dipakai.");
  if (blockedTextPattern.test(suggestedAction) || blockedTextPattern.test(reason)) return null;

  const targetId = safeText(item.targetId);
  if (targetType === "student" && !request.webContext.students.some((student) => student.id === targetId)) return null;
  if (targetType === "assignment" && !request.webContext.assignments.some((assignment) => assignment.id === targetId)) return null;
  if (targetType === "chapter" && !request.webContext.chapters.some((chapter) => chapter.id === targetId)) return null;
  if (targetType === "table" && !request.workbookSummary.candidateTables.some((table) => table.id === targetId)) return null;

  const rawSuggestedValue = item.suggestedValue;
  const suggestedValue = typeof rawSuggestedValue === "number" && Number.isFinite(rawSuggestedValue) && rawSuggestedValue >= 0 && rawSuggestedValue <= 100
    ? rawSuggestedValue
    : undefined;
  if (targetType === "value" && suggestedValue === undefined) return null;

  return {
    type: type as AssistType,
    rowIndex: safeOptionalNumber(item.rowIndex),
    columnIndex: safeOptionalNumber(item.columnIndex),
    sourceId: safeText(item.sourceId) || undefined,
    suggestedAction,
    targetId: targetId || undefined,
    targetType: targetType as TargetType,
    suggestedValue,
    confidence: clampConfidence(item.confidence),
    reason,
    requiresConfirmation: true,
  };
}

function sanitizeAiResponse(value: unknown, request: NormalizedRequest): { suggestions: AssistSuggestion[]; summary: { confidence: number; riskLevel: RiskLevel; notes: string[] } } {
  const root = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawSuggestions = Array.isArray(root.suggestions) ? root.suggestions : [];
  const suggestions = rawSuggestions
    .map((item) => sanitizeSuggestion(item, request))
    .filter(Boolean) as AssistSuggestion[];
  const rawSummary = root.summary && typeof root.summary === "object" ? root.summary as Record<string, unknown> : {};
  const confidence = clampConfidence(rawSummary.confidence);
  const riskLevel = allowedRiskLevels.has(rawSummary.riskLevel as RiskLevel)
    ? rawSummary.riskLevel as RiskLevel
    : "high";

  return {
    suggestions,
    summary: {
      confidence,
      riskLevel,
      notes: [
        ...request.notes,
        ...safeNotes(rawSummary.notes, suggestions.length ? ["Semua saran AI wajib dicek sebelum dipakai."] : ["AI tidak tersedia atau hasilnya tidak valid. Lanjutkan dengan pemeriksaan manual."]),
      ].slice(0, 10),
    },
  };
}

function buildSystemPrompt(): string {
  return [
    "Kamu adalah asisten import nilai SIPENA.",
    "Tugasmu hanya memberi saran JSON untuk membantu guru memetakan workbook Excel ke data kelas aktif.",
    "Jangan menulis database. Jangan mengubah nilai final. Jangan membuat siswa. Jangan mengarang ID.",
    "Gunakan hanya ID yang tersedia di webContext.",
    "Jika ragu, minta konfirmasi.",
    "Semua saran dengan confidence di bawah 0.90 wajib requiresConfirmation true.",
    "Kembalikan JSON valid sesuai schema tanpa markdown.",
    "Jangan menghasilkan SQL, instruksi deploy, migration, atau operasi executable.",
  ].join("\n");
}

function buildUserPrompt(request: NormalizedRequest): string {
  return JSON.stringify({
    instruction: "Berikan saran hanya untuk item unresolved/ambiguous pada deterministicPlan.conflicts dan deterministicPlan.warnings. Jangan memberi saran untuk item safe kecuali ada risiko jelas.",
    outputSchema: {
      suggestions: [{
        type: "student|column|value|table|structure",
        rowIndex: 2,
        columnIndex: 5,
        sourceId: "optional",
        suggestedAction: "string",
        targetId: "optional; must exist in webContext or candidateTables when used",
        targetType: "student|assignment|chapter|table|ignore|value",
        suggestedValue: 80,
        confidence: 0.82,
        reason: "string",
        requiresConfirmation: true,
      }],
      summary: {
        confidence: 0.82,
        riskLevel: "low|medium|high",
        notes: ["string"],
      },
    },
    workbookSummary: request.workbookSummary,
    webContext: request.webContext,
    deterministicPlan: request.deterministicPlan,
    truncationNotes: request.notes,
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return fallbackResponse("Method tidak didukung.", 405);
  }

  const requestId = crypto.randomUUID();
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    console.warn(JSON.stringify({ requestId, errorType: "missing_jwt" }));
    return fallbackResponse("Login diperlukan sebelum meminta saran AI.", 401);
  }

  let normalized: NormalizedRequest;
  try {
    normalized = normalizeRequest(await req.text());
    console.info(JSON.stringify({
      requestId,
      sheets: normalized.workbookSummary.sheets.length,
      candidateTables: normalized.workbookSummary.candidateTables.length,
      headers: normalized.workbookSummary.headers.length,
      sampleRows: normalized.workbookSummary.sampleRows.length,
      students: normalized.webContext.students.length,
      chapters: normalized.webContext.chapters.length,
      assignments: normalized.webContext.assignments.length,
      conflicts: normalized.deterministicPlan.conflicts.length,
    }));
  } catch (error) {
    console.warn(JSON.stringify({ requestId, errorType: error instanceof Error ? error.message : "payload_invalid" }));
    return fallbackResponse("Payload saran AI tidak valid.", 400);
  }

  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    console.warn(JSON.stringify({ requestId, errorType: "missing_groq_api_key" }));
    return fallbackResponse("Saran AI belum tersedia karena kunci API belum dikonfigurasi.", 503);
  }

  try {
    const aiResponse = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: normalized.model,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(normalized) },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    }, AI_TIMEOUT_MS);

    if (!aiResponse.ok) {
      console.warn(JSON.stringify({ requestId, errorType: "ai_http_error", status: aiResponse.status }));
      return fallbackResponse("AI tidak tersedia atau hasilnya tidak valid. Lanjutkan dengan pemeriksaan manual.", 502);
    }

    const aiData = await aiResponse.json();
    const content = String(aiData.choices?.[0]?.message?.content || "");
    const parsed = extractJson(content);
    return responseJson(sanitizeAiResponse(parsed, normalized));
  } catch (error) {
    const errorType = error instanceof Error && error.name === "AbortError"
      ? "ai_timeout"
      : error instanceof Error
        ? error.message
        : "ai_failure";
    console.warn(JSON.stringify({ requestId, errorType }));
    return fallbackResponse("AI tidak tersedia atau hasilnya tidak valid. Lanjutkan dengan pemeriksaan manual.", 200);
  }
});
