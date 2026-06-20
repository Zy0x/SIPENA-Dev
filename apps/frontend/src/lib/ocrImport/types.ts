export type OcrImportKind = "students" | "grades" | "attendance";

export type OcrColumnSemantic =
  | "order"
  | "student_name"
  | "nisn"
  | "grade"
  | "date"
  | "attendance_status"
  | "unknown";

export interface OcrImageInput {
  name: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  page: number;
}

export interface PreparedOcrImage extends OcrImageInput {
  id: string;
  previewUrl: string;
  originalSize: number;
  processedSize: number;
}

export interface OcrExtractionRequest {
  mode: "ocr_import";
  kind: OcrImportKind;
  images: OcrImageInput[];
}

export interface OcrColumn {
  id: string;
  label: string;
  semantic: OcrColumnSemantic;
  confidence: number;
  targetId?: string;
}

export interface OcrExtractedRow {
  id: string;
  page: number;
  values: string[];
  confidence: number;
  handwritten: boolean;
}

export interface OcrPageText {
  page: number;
  text: string;
  source: "ocr" | "table_fallback" | "manual";
}

export interface OcrExtractionResult {
  requestId: string;
  kind: OcrImportKind;
  rawText: string;
  pageTexts: OcrPageText[];
  columns: OcrColumn[];
  rows: OcrExtractedRow[];
  warnings: string[];
  usedFallback: boolean;
}

export type OcrIssueSeverity = "error" | "warning" | "info";

export interface OcrIssue {
  severity: OcrIssueSeverity;
  code: string;
  message: string;
  columnId?: string;
}

export interface OcrStudentContext {
  id: string;
  name: string;
  nisn?: string | null;
}

export interface OcrAssignmentContext {
  id: string;
  name: string;
}

export interface OcrExistingGradeContext {
  studentId: string;
  assignmentId: string;
  value: number | null;
}

export interface OcrExistingAttendanceContext {
  studentId: string;
  date: string;
  status: string;
}

export interface OcrImportContext {
  kind: OcrImportKind;
  targetClassId?: string;
  targetClassName?: string;
  targetSubjectId?: string;
  targetSubjectName?: string;
  students: OcrStudentContext[];
  assignments?: OcrAssignmentContext[];
  existingGrades?: OcrExistingGradeContext[];
  existingAttendance?: OcrExistingAttendanceContext[];
}

export interface OcrDraftRow extends OcrExtractedRow {
  included: boolean;
  targetStudentId?: string;
  issues: OcrIssue[];
}

export interface OcrImportPlan {
  kind: OcrImportKind;
  targetClassId?: string;
  columns: OcrColumn[];
  rows: OcrDraftRow[];
}

export interface OcrImportResult {
  success: number;
  skipped: number;
  failed: number;
  message?: string;
}
