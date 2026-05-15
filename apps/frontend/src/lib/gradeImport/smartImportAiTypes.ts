export type SmartImportAssistRiskLevel = "low" | "medium" | "high";
export type SmartImportAssistType = "student" | "column" | "value" | "table" | "structure";
export type SmartImportAssistTargetType = "student" | "assignment" | "chapter" | "table" | "ignore" | "value";

export interface SmartImportAssistSheetSummary {
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface SmartImportAssistCandidateTable {
  id: string;
  sheetName: string;
  headerRowIndex: number;
  dataStartRowIndex: number;
  dataEndRowIndex: number;
  matchedStudentCount: number;
  gradeColumnCount: number;
  sampleStudents: string[];
  headers: string[];
}

export interface SmartImportAssistHeaderSummary {
  columnIndex: number;
  rawHeader: string;
}

export interface SmartImportAssistSampleRow {
  rowIndex: number;
  values: Array<string | number | null>;
}

export interface SmartImportAssistWorkbookSummary {
  fileName?: string;
  sheets: SmartImportAssistSheetSummary[];
  candidateTables: SmartImportAssistCandidateTable[];
  headers: SmartImportAssistHeaderSummary[];
  sampleRows: SmartImportAssistSampleRow[];
}

export interface SmartImportAssistStudentContext {
  id: string;
  name: string;
  nisn?: string;
}

export interface SmartImportAssistChapterContext {
  id: string;
  name: string;
}

export interface SmartImportAssistAssignmentContext {
  id: string;
  chapter_id: string;
  name: string;
}

export interface SmartImportAssistWebContext {
  students: SmartImportAssistStudentContext[];
  chapters: SmartImportAssistChapterContext[];
  assignments: SmartImportAssistAssignmentContext[];
}

export interface SmartImportAssistDeterministicPlan {
  studentMappings: unknown[];
  columnMappings: unknown[];
  conflicts: unknown[];
  warnings: unknown[];
}

export interface SmartImportAssistRequest {
  mode: "grade_import_assist";
  workbookSummary: SmartImportAssistWorkbookSummary;
  webContext: SmartImportAssistWebContext;
  deterministicPlan: SmartImportAssistDeterministicPlan;
}

export interface SmartImportAssistSuggestion {
  type: SmartImportAssistType;
  rowIndex?: number;
  columnIndex?: number;
  sourceId?: string;
  suggestedAction: string;
  targetId?: string;
  targetType: SmartImportAssistTargetType;
  suggestedValue?: number;
  confidence: number;
  reason: string;
  requiresConfirmation: true;
}

export interface SmartImportAssistSummary {
  confidence: number;
  riskLevel: SmartImportAssistRiskLevel;
  notes: string[];
}

export interface SmartImportAssistResponse {
  suggestions: SmartImportAssistSuggestion[];
  summary: SmartImportAssistSummary;
}

export const SMART_IMPORT_ASSIST_FALLBACK_NOTE = "AI tidak tersedia. Lanjutkan dengan pemeriksaan manual.";
const INVALID_AI_NOTE = "AI tidak tersedia atau hasilnya tidak valid. Lanjutkan dengan pemeriksaan manual.";

const allowedTypes = new Set<SmartImportAssistType>(["student", "column", "value", "table", "structure"]);
const allowedTargetTypes = new Set<SmartImportAssistTargetType>(["student", "assignment", "chapter", "table", "ignore", "value"]);
const allowedRiskLevels = new Set<SmartImportAssistRiskLevel>(["low", "medium", "high"]);
const blockedTextPattern = /\b(select|insert|update|delete|drop|alter|create\s+table|create\s+function|rpc|deploy|migration)\b/i;

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function cleanText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 300);
}

function cleanNotes(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const notes = value.map((item) => cleanText(item)).filter(Boolean).slice(0, 8);
  return notes.length ? notes : fallback;
}

function cleanPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function isKnownWorkbookRow(rowIndex: number | undefined, request: SmartImportAssistRequest): boolean {
  if (!rowIndex) return false;
  if (request.workbookSummary.sampleRows.some((row) => row.rowIndex === rowIndex)) return true;
  return request.workbookSummary.candidateTables.some((table) =>
    rowIndex >= table.headerRowIndex && rowIndex <= table.dataEndRowIndex,
  );
}

function isKnownWorkbookColumn(columnIndex: number | undefined, request: SmartImportAssistRequest): boolean {
  if (!columnIndex) return false;
  if (request.workbookSummary.headers.some((header) => header.columnIndex === columnIndex)) return true;
  const maxColumnCount = request.workbookSummary.sheets.reduce((max, sheet) => Math.max(max, sheet.columnCount), 0);
  return columnIndex <= maxColumnCount;
}

function extractJsonLike(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced?.[1]?.trim() || trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const match = body.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("invalid json");
    return JSON.parse(match[0]);
  }
}

export function createSmartImportAssistFallback(note = SMART_IMPORT_ASSIST_FALLBACK_NOTE): SmartImportAssistResponse {
  return {
    suggestions: [],
    summary: {
      confidence: 0,
      riskLevel: "high",
      notes: [note],
    },
  };
}

export function sanitizeSmartImportAssistResponse(
  raw: unknown,
  request: SmartImportAssistRequest,
): SmartImportAssistResponse {
  let parsed: unknown;
  try {
    parsed = extractJsonLike(raw);
  } catch {
    return createSmartImportAssistFallback(INVALID_AI_NOTE);
  }

  if (!parsed || typeof parsed !== "object") {
    return createSmartImportAssistFallback(INVALID_AI_NOTE);
  }

  const root = parsed as Record<string, unknown>;
  const rawSummary = root.summary && typeof root.summary === "object" ? root.summary as Record<string, unknown> : {};
  const students = new Set(request.webContext.students.map((item) => item.id));
  const assignments = new Set(request.webContext.assignments.map((item) => item.id));
  const chapters = new Set(request.webContext.chapters.map((item) => item.id));
  const tables = new Set(request.workbookSummary.candidateTables.map((item) => item.id));

  const suggestions = Array.isArray(root.suggestions) ? root.suggestions : [];
  const safeSuggestions = suggestions.flatMap((item): SmartImportAssistSuggestion[] => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    const type = candidate.type;
    const targetType = candidate.targetType;
    if (!allowedTypes.has(type as SmartImportAssistType)) return [];
    if (!allowedTargetTypes.has(targetType as SmartImportAssistTargetType)) return [];

    const rowIndex = cleanPositiveInteger(candidate.rowIndex);
    const columnIndex = cleanPositiveInteger(candidate.columnIndex);
    if (["student", "value"].includes(type as string) && !isKnownWorkbookRow(rowIndex, request)) return [];
    if (["column", "structure", "value"].includes(type as string) && !isKnownWorkbookColumn(columnIndex, request)) return [];

    const suggestedAction = cleanText(candidate.suggestedAction, "Perlu dicek manual");
    const reason = cleanText(candidate.reason, "Periksa saran ini sebelum dipakai.");
    if (blockedTextPattern.test(suggestedAction) || blockedTextPattern.test(reason)) return [];

    const targetId = cleanText(candidate.targetId);
    if (targetType === "student" && (!targetId || !students.has(targetId))) return [];
    if (targetType === "assignment" && (!targetId || !assignments.has(targetId))) return [];
    if (targetType === "chapter" && (!targetId || !chapters.has(targetId))) return [];
    if (targetType === "table" && (!targetId || !tables.has(targetId))) return [];

    const rawSuggestedValue = candidate.suggestedValue;
    const suggestedValue = typeof rawSuggestedValue === "number" && Number.isFinite(rawSuggestedValue) && rawSuggestedValue >= 0 && rawSuggestedValue <= 100
      ? rawSuggestedValue
      : undefined;
    if (targetType === "value" && suggestedValue === undefined) return [];

    return [{
      type: type as SmartImportAssistType,
      rowIndex,
      columnIndex,
      sourceId: cleanText(candidate.sourceId) || undefined,
      suggestedAction,
      targetId: targetId || undefined,
      targetType: targetType as SmartImportAssistTargetType,
      suggestedValue,
      confidence: clampConfidence(candidate.confidence),
      reason,
      requiresConfirmation: true,
    }];
  });

  const confidence = clampConfidence(rawSummary.confidence);
  const riskLevel = allowedRiskLevels.has(rawSummary.riskLevel as SmartImportAssistRiskLevel)
    ? rawSummary.riskLevel as SmartImportAssistRiskLevel
    : "high";

  return {
    suggestions: safeSuggestions,
    summary: {
      confidence,
      riskLevel,
      notes: cleanNotes(rawSummary.notes, safeSuggestions.length ? ["Semua saran AI wajib dicek sebelum dipakai."] : [INVALID_AI_NOTE]),
    },
  };
}
