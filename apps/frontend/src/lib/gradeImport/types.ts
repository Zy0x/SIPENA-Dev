export type ImportSourceType =
  | "official_exact"
  | "official_modified"
  | "official_damaged"
  | "free_structured"
  | "free_unstructured"
  | "unsupported";

export type UpdateMode =
  | "fill_empty_only"
  | "overwrite_existing"
  | "overwrite_selected_columns"
  | "skip_existing";

export type GradeType = "assignment" | "sts" | "sas";

export type ParsedHeaderType = GradeType | "reserved" | "derived" | "unknown";

export type ImportSeverity = "info" | "warning" | "blocked";

export type MappingStatus =
  | "safe"
  | "warning"
  | "needs_confirmation"
  | "ambiguous"
  | "missing"
  | "missing_in_web"
  | "missing_in_excel"
  | "blocked";

export interface ImportWarning {
  code: string;
  severity: ImportSeverity;
  message: string;
  field?: string;
  rowIndex?: number;
  columnIndex?: number;
}

export interface ImportConflict {
  code: string;
  severity: ImportSeverity;
  message: string;
  type:
    | "student"
    | "column"
    | "structure"
    | "grade_value"
    | "context"
    | "overwrite"
    | "unsupported";
  rowIndex?: number;
  columnIndex?: number;
  options?: string[];
}

export interface GradeTarget {
  gradeType: GradeType;
  chapterName?: string;
  assignmentName?: string;
  chapterId?: string;
  assignmentId?: string;
  sourceChapterName?: string;
  sourceAssignmentName?: string;
}

export interface ParsedGradeHeader {
  raw: string;
  normalized: string;
  headerType: ParsedHeaderType;
  target?: GradeTarget;
  confidence: number;
  reserved: boolean;
  derived: boolean;
  reasons: string[];
  warnings: ImportWarning[];
}

export interface StudentMapping {
  rowIndex: number;
  excelName?: string;
  excelNisn?: string;
  studentId?: string;
  webName?: string;
  webNisn?: string;
  matchedBy?: "student_id" | "nisn_exact" | "nisn_normalized" | "name_exact" | "name_normalized" | "fuzzy" | "manual";
  confidence: number;
  status: MappingStatus;
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
}

export interface ColumnMapping {
  columnIndex: number;
  rawHeader: string;
  parsedHeader: ParsedGradeHeader;
  target?: GradeTarget;
  confidence: number;
  status: MappingStatus;
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
}

export interface StructureSuggestion {
  id: string;
  type: "create_chapter" | "create_assignment" | "create_chapter_and_assignment" | "map_existing";
  chapterName?: string;
  assignmentName?: string;
  target?: GradeTarget;
  confidence: number;
  requiresConfirmation: boolean;
  status: MappingStatus;
  warnings: ImportWarning[];
}

export interface GradeOperation {
  id: string;
  rowIndex: number;
  columnIndex: number;
  studentId?: string;
  target: GradeTarget;
  value: number | null;
  suggestedValue?: number;
  existingValue?: number | null;
  updateMode: UpdateMode;
  action: "fill_empty" | "overwrite" | "skip_empty" | "skip_existing" | "needs_confirmation" | "blocked";
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
}

export interface ImportPlan {
  sourceType: ImportSourceType;
  updateMode: UpdateMode;
  studentMappings: StudentMapping[];
  columnMappings: ColumnMapping[];
  structureSuggestions: StructureSuggestion[];
  gradeOperations: GradeOperation[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
  summary: {
    totalRows: number;
    matchedStudents: number;
    mappedColumns: number;
    safeOperations: number;
    blockedOperations: number;
    needsConfirmation: number;
    matchedStudentCount?: number;
    ambiguousStudentCount?: number;
    missingStudentCount?: number;
    gradeColumnCount?: number;
    conflictCount?: number;
    newAssignmentCount?: number;
    newChapterCount?: number;
    invalidValueCount?: number;
    readyImportCount?: number;
    skippedValueCount?: number;
  };
}

export interface TextNormalizationResult {
  raw: string;
  normalized: string;
  candidates: string[];
  warnings: ImportWarning[];
}

export type GradeValueStatus = "valid" | "empty" | "invalid" | "textual" | "needs_confirmation";

export interface GradeValueParseResult {
  raw: unknown;
  normalized: string;
  status: GradeValueStatus;
  value: number | null;
  suggestedValue?: number;
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
}
