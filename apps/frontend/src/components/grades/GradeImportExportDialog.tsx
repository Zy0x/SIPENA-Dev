import type { ReactNode, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Loader2,
  MapPinned,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnhancedToast } from "@/contexts/ToastContext";
import {
  buildExecutableImportOperations,
  buildImportPlan,
  buildSpreadsheetPreviewModel,
  createSmartImportAssistFallback,
  defaultCellImportSetting,
  defaultColumnImportSetting,
  emptyImportSelectionState,
  getSimplifiedConflictSourceId,
  nowSelectionTimestamp,
  readWorkbookFile,
  requestSmartImportAssist,
  rowHasImportableValue,
  sanitizeSmartImportAssistResponse,
  simplifyImportConflicts,
  type CellValueMode,
  type ColumnMapping,
  type ColumnValueMode,
  type ConflictSimplifierResult,
  type FreeExcelAnalysis,
  type FreeExcelRegionAnalysis,
  type GradeOperation,
  type GradeTarget,
  type ImportConflict,
  type ImportPlan,
  type ImportPlanContext,
  type ImportPlanInputAnalysis,
  type ImportSelectionState,
  type ImportSourceType,
  type ImportWarning,
  type SmartImportAssistRequest,
  type SmartImportAssistResponse,
  type SmartImportAssistSuggestion,
  type SpreadsheetPreviewCell,
  type SpreadsheetPreviewColumn,
  type SpreadsheetPreviewModel,
  type SpreadsheetPreviewRow,
  type StudentMapping,
  type UpdateMode,
} from "@/lib/gradeImport";
import {
  buildFinalReviewModel,
  buildImportDecisionGraph,
  detectGradeImportSource,
  resolveImportDecisionGraphWithAi,
  type FinalReviewModel,
  type ImportDecisionGraph,
} from "@/lib/gradeImportAgent";
import { cn } from "@/lib/utils";

import { ExportOptionCard } from "./import-export/ExportOptionCard";
import type { ColumnTargetDraft } from "./import-export/ColumnSettingsOverlay";
import { HeaderConfigurationStep } from "./import-export/HeaderConfigurationStep";
import { ImportDropzone } from "./import-export/ImportDropzone";
import { ImportIssueResolutionStep } from "./import-export/ImportIssueResolutionStep";
import { getActiveHeaderConfigurationIssues, getActiveImportIssues } from "./import-export/importIssueQueue";
import { getImportStepReadiness } from "./import-export/importStepReadiness";
import { ImportStepper } from "./import-export/ImportStepper";
import { ManualChoiceCard } from "./import-export/ManualChoiceCard";
import { RiskAlert } from "./import-export/RiskAlert";
import { SmartFixGroupCard } from "./import-export/SmartFixGroupCard";
import { SmartFixItemCard } from "./import-export/SmartFixItemCard";
import { SmartFixSummary } from "./import-export/SmartFixSummary";
import { SmartSpreadsheetPreview } from "./import-export/SmartSpreadsheetPreview";
import { StatusBadge, type StatusBadgeTone } from "./import-export/StatusBadge";
import { WorkbookPreviewPanel } from "./import-export/WorkbookPreviewPanel";

export type GradeImportExportTab = "import" | "export";

interface GradeImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: GradeImportExportTab;
  onTabChange: (tab: GradeImportExportTab) => void;
  classNameLabel: string;
  subjectName: string;
  semesterName?: string | null;
  studentCount: number;
  chapterCount: number;
  assignmentCount: number;
  canDownloadOfficialTemplate?: boolean;
  isDownloadingTemplate?: boolean;
  onDownloadOfficialTemplate?: () => void | Promise<void>;
  isExportingCurrentGrades?: boolean;
  isExportingBackup?: boolean;
  onDownloadCurrentGrades?: () => void | Promise<void>;
  onDownloadBackup?: () => void | Promise<void>;
  onSaveGrade?: (studentId: string, gradeType: "assignment" | "sts" | "sas", value: number, assignmentId?: string) => void | Promise<void>;
  onSaveGradesBatch?: (items: Array<{
    studentId: string;
    gradeType: "assignment" | "sts" | "sas";
    value: number;
    assignmentId?: string;
    academicYearId?: string | null;
    semesterId?: string | null;
  }>) => Promise<{ savedCount: number; skippedUnchangedCount?: number } | void>;
  onEnsureAssignmentTarget?: (target: GradeTarget) => Promise<EnsuredImportTarget>;
  onRollbackCreatedImportStructure?: (created: { assignmentIds: string[]; chapterIds: string[] }) => Promise<void>;
  onImportComplete?: () => void | Promise<void>;
  canUndoImport?: boolean;
  canRedoImport?: boolean;
  onUndoImport?: () => void | Promise<void>;
  onRedoImport?: () => void | Promise<void>;
  importContext: ImportPlanContext;
}

type ExportMode = "official" | "current" | "backup";
type EnsuredImportTarget = GradeTarget & {
  createdChapterId?: string;
  createdAssignmentId?: string;
};
type ImportExecutionState = "idle" | "analyzing" | "ready" | "failed" | "importing" | "success";
type ImportHistoryActionState = "idle" | "undoing" | "redoing";
type AiAssistState = "idle" | "loading" | "success" | "error";
type ColumnResolutionKind = "existing_assignment" | "create_assignment" | "create_chapter_and_assignment" | "sts" | "sas" | "ignore";
type ImportUiErrorCode =
  | "IMPORT_FILE_TOO_LARGE"
  | "IMPORT_UNSUPPORTED_FILE_TYPE"
  | "IMPORT_WORKBOOK_READ_FAILED"
  | "IMPORT_CONTEXT_MISMATCH"
  | "IMPORT_DUPLICATE_STUDENT_MAPPING"
  | "IMPORT_DUPLICATE_COLUMN_TARGET"
  | "IMPORT_INVALID_GRADE_VALUE"
  | "IMPORT_NO_VALID_SHEET"
  | "IMPORT_SHEET_EMPTY"
  | "IMPORT_FILE_EMPTY";

interface ColumnResolution {
  kind: ColumnResolutionKind;
  assignmentId?: string;
  chapterId?: string;
  chapterName?: string;
  assignmentName?: string;
  confirmed?: boolean;
}

interface ImportResolverState {
  ignoredRows: number[];
  unresolvedRows: number[];
  studentOverrides: Record<string, string>;
  ignoredColumns: number[];
  ignoredCells: string[];
  columnOverrides: Record<string, ColumnResolution>;
  resolvedConflictKeys: string[];
}

interface ImportExecutionFailure {
  operationId: string;
  rowIndex: number;
  columnIndex: number;
  target: string;
  message: string;
}

interface ImportExecutionSummary {
  successCount: number;
  skippedCount: number;
  failedCount: number;
  warnings: string[];
  failedRows: ImportExecutionFailure[];
}

interface ImportExecutionProgress {
  current: number;
  total: number;
}

interface ImportFileMeta {
  name: string;
  size: number;
  lastModified: number;
}

interface AiAssistPanelState {
  status: AiAssistState;
  response: SmartImportAssistResponse | null;
  error: string | null;
  cacheKey: string | null;
}

const emptyResolverState: ImportResolverState = {
  ignoredRows: [],
  unresolvedRows: [],
  studentOverrides: {},
  ignoredColumns: [],
  ignoredCells: [],
  columnOverrides: {},
  resolvedConflictKeys: [],
};

const emptyAiAssistPanelState: AiAssistPanelState = {
  status: "idle",
  response: null,
  error: null,
  cacheKey: null,
};

const importSteps = ["Upload", "Pemeriksaan", "Daftar Bermasalah", "Konfigurasi Header", "Verifikasi Tabel", "Review Akhir", "Simpan"];
const maxImportFileBytes = 20 * 1024 * 1024;

const sourceLabels: Record<ImportSourceType, string> = {
  official_exact: "Template SIPENA cocok",
  official_modified: "Template SIPENA berubah, perlu dicek",
  official_damaged: "Template SIPENA tidak lengkap, perlu pemeriksaan",
  free_structured: "Excel bebas terdeteksi",
  free_unstructured: "Format belum dikenali",
  unsupported: "Format belum bisa dibaca",
};

const updateModeLabels: Record<UpdateMode, string> = {
  fill_empty_only: "Isi yang kosong",
  overwrite_existing: "Timpa setelah konfirmasi",
  overwrite_selected_columns: "Timpa kolom dipilih",
  skip_existing: "Lewati nilai lama",
};

function formatImportUiLabel(value?: string | null) {
  if (!value) return "";
  const labels: Record<string, string> = {
    blocked: "Perlu diselesaikan",
    manual_required: "Perlu dipilih",
    needs_confirmation: "Perlu dicek",
    fill_empty_only: "Isi yang kosong",
    skip_existing: "Lewati nilai lama",
    overwrite_existing: "Timpa setelah konfirmasi",
    skip: "Dilewati",
  };
  return labels[value] || value;
}

const conflictTypeLabels: Record<ImportConflict["type"], string> = {
  student: "Siswa",
  column: "Kolom",
  structure: "Struktur",
  grade_value: "Nilai",
  context: "Konteks",
  overwrite: "Nilai lama",
  unsupported: "Format",
};

const exportSheetsByMode: Record<ExportMode, string[]> = {
  official: ["Panduan", "Isi_Nilai", "_manifest", "_students", "_structure", "_column_map", "_rules", "_examples"],
  current: ["Panduan", "Nilai"],
  backup: ["Panduan", "Nilai", "_manifest", "_students", "_structure", "_grades"],
};

const importUiErrorMessages: Record<ImportUiErrorCode, { title: string; message: string }> = {
  IMPORT_FILE_TOO_LARGE: {
    title: "File terlalu besar",
    message: "File terlalu besar. Gunakan file maksimal 20 MB atau pecah workbook menjadi beberapa file.",
  },
  IMPORT_UNSUPPORTED_FILE_TYPE: {
    title: "Format file belum didukung",
    message: "Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv.",
  },
  IMPORT_WORKBOOK_READ_FAILED: {
    title: "Workbook gagal dibaca",
    message: "Workbook gagal dibaca. Coba simpan ulang dari Excel lalu upload kembali.",
  },
  IMPORT_CONTEXT_MISMATCH: {
    title: "File berbeda kelas/mapel/semester",
    message: "File ini dibuat untuk kelas/mapel/semester lain. Pilih konteks yang sesuai atau download template baru.",
  },
  IMPORT_DUPLICATE_STUDENT_MAPPING: {
    title: "Siswa terduplikasi",
    message: "Ada lebih dari satu baris Excel yang menuju siswa kelas aktif yang sama. Pilih satu baris atau abaikan duplikat.",
  },
  IMPORT_DUPLICATE_COLUMN_TARGET: {
    title: "Kolom nilai terduplikasi",
    message: "Ada lebih dari satu kolom menuju target nilai yang sama. Pilih kolom yang dipakai sebelum import.",
  },
  IMPORT_INVALID_GRADE_VALUE: {
    title: "Nilai tidak valid",
    message: "Ada nilai tidak valid. Nilai harus berupa angka 0 sampai 100.",
  },
  IMPORT_NO_VALID_SHEET: {
    title: "Sheet nilai tidak ditemukan",
    message: "Workbook tidak memiliki sheet valid. Pastikan file berisi sheet nilai.",
  },
  IMPORT_SHEET_EMPTY: {
    title: "Sheet kosong",
    message: "Sheet yang dibaca kosong. Pilih file dengan data siswa dan kolom nilai.",
  },
  IMPORT_FILE_EMPTY: {
    title: "File kosong",
    message: "File kosong dan tidak bisa dianalisis.",
  },
};

const importNoticeMessages: Record<string, { title: string; message: string }> = {
  IMPORT_PLAN_BLOCKED: {
    title: "Masih ada pilihan yang perlu diselesaikan",
    message: "Buka Daftar Bermasalah, pilih tindakan yang sesuai, lalu lanjutkan kembali.",
  },
  IMPORT_NO_GRADE_COLUMNS: {
    title: "Kolom nilai belum ditemukan",
    message: "Pastikan workbook memiliki kolom nilai seperti BAB 1 - Tugas 1, STS, atau SAS.",
  },
  COLUMN_CREATE_ASSIGNMENT_SUGGESTED: {
    title: "Tugas baru perlu konfirmasi",
    message: "BAB sudah ada di kelas aktif, tetapi nama tugas dari Excel belum ada. Konfirmasi dulu sebelum tugas baru dipakai.",
  },
  COLUMN_CREATE_CHAPTER_AND_ASSIGNMENT_SUGGESTED: {
    title: "BAB dan tugas baru perlu konfirmasi",
    message: "BAB dan tugas dari Excel belum ada di kelas aktif. Konfirmasi atau ubah namanya dulu sebelum dipakai.",
  },
  COLUMN_ASSIGNMENT_SIMILAR_MATCH: {
    title: "Nama tugas mirip",
    message: "SIPENA menemukan tugas yang namanya mirip. Periksa kembali agar nilai masuk ke tugas yang tepat.",
  },
  COLUMN_CHAPTER_SIMILAR_MATCH: {
    title: "Nama BAB mirip",
    message: "SIPENA menemukan BAB yang namanya mirip. Periksa kembali agar nilai masuk ke BAB yang tepat.",
  },
  COLUMN_ASSIGNMENT_WITHOUT_CHAPTER: {
    title: "Nama BAB belum jelas",
    message: "Header Excel hanya menyebut tugas tanpa BAB. Pilih BAB yang benar sebelum import.",
  },
  COLUMN_ASSIGNMENT_WITHOUT_CHAPTER_AMBIGUOUS: {
    title: "Tugas cocok ke beberapa BAB",
    message: "Nama tugas ini ada di lebih dari satu BAB. Pilih target yang benar sebelum import.",
  },
  COLUMN_ASSIGNMENT_AMBIGUOUS: {
    title: "Kolom belum bisa dipastikan",
    message: "Header Excel cocok ke beberapa tugas. Pilih tugas yang benar secara manual.",
  },
  COLUMN_METADATA_VS_HEADER_CHANGED: {
    title: "Header template berubah",
    message: "Identitas template masih terbaca, tetapi nama kolom terlihat berubah. Periksa target kolom sebelum lanjut.",
  },
  COLUMN_METADATA_INVALID_HEADER_CLEAR: {
    title: "Identitas kolom perlu dicek",
    message: "Identitas template tidak cocok dengan struktur kelas aktif, tetapi header Excel cukup jelas. Pilih target kolom untuk memastikan.",
  },
  COLUMN_UNRESOLVED: {
    title: "Kolom belum dipetakan",
    message: "SIPENA belum bisa menentukan target kolom ini. Pilih tugas, STS, SAS, atau abaikan kolom.",
  },
  STUDENT_ID_NAME_CHANGED: {
    title: "Nama siswa berbeda",
    message: "ID siswa cocok, tetapi nama di Excel berbeda dengan data kelas aktif. SIPENA akan memakai data siswa dari kelas aktif setelah Anda konfirmasi.",
  },
  STUDENT_ID_NISN_CHANGED: {
    title: "NISN siswa berbeda",
    message: "ID siswa cocok, tetapi NISN di Excel berbeda dengan data kelas aktif. SIPENA akan memakai data siswa dari kelas aktif setelah Anda konfirmasi.",
  },
  STUDENT_MATCH_AMBIGUOUS: {
    title: "Siswa belum pasti",
    message: "Ada lebih dari satu kemungkinan siswa. Pilih siswa yang benar atau abaikan baris Excel.",
  },
  STUDENT_DUPLICATE_EXCEL_MATCH: {
    title: "Baris siswa ganda",
    message: "Lebih dari satu baris Excel mengarah ke siswa yang sama. Pilih baris yang dipakai atau abaikan duplikat.",
  },
  STUDENT_MATCH_DUPLICATE_WEB_CANDIDATE: {
    title: "Data siswa kelas aktif mirip",
    message: "Ada beberapa siswa kelas aktif dengan data yang mirip. Pilih siswa yang benar secara manual.",
  },
  STUDENT_MISSING_IN_WEB: {
    title: "Siswa belum ada di kelas aktif",
    message: "Baris Excel ini tidak cocok dengan siswa di kelas aktif. SIPENA tidak akan membuat siswa baru dari import nilai.",
  },
  STUDENT_MISSING_IN_EXCEL: {
    title: "Siswa tidak ada di Excel",
    message: "Ada siswa di kelas aktif yang tidak ditemukan di workbook. Nilainya tidak akan berubah.",
  },
  STUDENT_FUZZY_AMBIGUOUS: {
    title: "Nama siswa mirip",
    message: "Nama siswa mirip dengan beberapa data kelas aktif. Pilih siswa yang benar secara manual.",
  },
  STUDENT_FUZZY_MATCH: {
    title: "Nama siswa mirip",
    message: "SIPENA menemukan kandidat siswa dari kemiripan nama. Periksa sebelum lanjut.",
  },
  STUDENT_NAME_NORMALIZED_MATCH: {
    title: "Nama siswa disesuaikan",
    message: "Nama siswa cocok setelah ejaan atau spasi dirapikan. Data kelas aktif tetap menjadi acuan.",
  },
  STUDENT_NISN_NORMALIZED_MATCH: {
    title: "NISN disesuaikan",
    message: "NISN cocok setelah formatnya dibersihkan. Data kelas aktif tetap menjadi acuan.",
  },
  STUDENT_MARKED_UNRESOLVED: {
    title: "Baris siswa belum selesai",
    message: "Baris ini ditandai belum selesai. Pilih siswa, abaikan baris, atau ulangi pilihan.",
  },
  IMPORT_STUDENT_NOT_SAFE_FOR_VALUE: {
    title: "Siswa harus dipastikan",
    message: "Baris ini memiliki nilai, tetapi siswanya belum aman dipetakan. Pilih siswa atau abaikan baris.",
  },
  IMPORT_STUDENT_MISSING_IN_WEB_FOR_VALUE: {
    title: "Siswa belum ada di kelas",
    message: "Baris Excel ini memiliki nilai, tetapi siswanya tidak ditemukan di kelas aktif. Pilih siswa yang benar, abaikan baris, atau tambahkan siswa dulu.",
  },
  IMPORT_COLUMN_NOT_SAFE_FOR_VALUE: {
    title: "Kolom nilai harus dipastikan",
    message: "Kolom ini memiliki nilai, tetapi targetnya belum aman. Pilih tugas, STS, SAS, atau abaikan kolom.",
  },
  IMPORT_DUPLICATE_COLUMN_TARGET: importUiErrorMessages.IMPORT_DUPLICATE_COLUMN_TARGET,
  IMPORT_CONTEXT_MISMATCH: importUiErrorMessages.IMPORT_CONTEXT_MISMATCH,
  IMPORT_CONTEXT_MISMATCH_BLOCKED: importUiErrorMessages.IMPORT_CONTEXT_MISMATCH,
  IMPORT_SEMESTER_MISMATCH: {
    title: "Semester berbeda",
    message: "File ini dibuat untuk semester lain. Pilih semester yang sesuai atau download template baru.",
  },
  IMPORT_MANIFEST_MISSING: {
    title: "Identitas template tidak ditemukan",
    message: "Sheet identitas template tidak ditemukan. File tetap bisa dianalisis, tetapi perlu pengecekan manual.",
  },
  IMPORT_METADATA_SHEET_MISSING: {
    title: "Sheet validasi tidak lengkap",
    message: "Beberapa sheet validasi template tidak ditemukan. Periksa pencocokan sebelum lanjut.",
  },
  IMPORT_HEADER_CHANGED: {
    title: "Header berubah",
    message: "Ada header yang berubah dari template awal. Periksa pencocokan kolom sebelum import.",
  },
  IMPORT_ADDED_HEADER_DETECTED: {
    title: "Kolom tambahan terdeteksi",
    message: "Ada kolom tambahan di workbook. SIPENA akan meminta konfirmasi jika kolom itu menjadi nilai baru.",
  },
  IMPORT_NEW_STRUCTURE_NOT_CONFIRMED: {
    title: "Struktur baru belum dikonfirmasi",
    message: "BAB atau tugas baru belum dikonfirmasi. Konfirmasi dulu sebelum import dilanjutkan.",
  },
  IMPORT_UNSIGNED_TEMPLATE: {
    title: "Template dibuat dari browser",
    message: "SIPENA akan tetap memvalidasi isinya terhadap data kelas aktif sebelum import.",
  },
  IMPORT_NO_FREE_EXCEL_REGION: {
    title: "Tabel nilai belum ditemukan",
    message: "SIPENA belum menemukan tabel nilai yang jelas di file. Pastikan ada kolom Nama/NISN dan kolom nilai.",
  },
  IMPORT_REGION_SELECTION_REQUIRED: {
    title: "Pilih tabel nilai dulu",
    message: "Workbook memiliki lebih dari satu tabel nilai. Pilih tabel yang akan dipakai agar SIPENA tidak mengambil nilai dari area yang salah.",
  },
  IMPORT_NO_SUPPORTED_TEMPLATE_STRUCTURE: {
    title: "Struktur template belum dikenali",
    message: "Format workbook belum dikenali sebagai template nilai SIPENA. Gunakan template resmi atau rapikan header nilai.",
  },
  IMPORT_INVALID_VALUE_STRICT: importUiErrorMessages.IMPORT_INVALID_GRADE_VALUE,
  GRADE_VALUE_INVALID: importUiErrorMessages.IMPORT_INVALID_GRADE_VALUE,
  GRADE_VALUE_TEXTUAL: {
    title: "Nilai berupa teks",
    message: "Ada nilai berupa teks seperti Tuntas, Remedial, atau huruf. Ubah menjadi angka 0 sampai 100 sebelum import.",
  },
  GRADE_VALUE_TEXTUAL_BLOCKED: {
    title: "Nilai teks belum bisa disimpan",
    message: "Nilai berupa teks tidak disimpan otomatis. Ubah menjadi angka 0 sampai 100.",
  },
  GRADE_VALUE_FRACTION_SCALED: {
    title: "Nilai pecahan perlu dicek",
    message: "Nilai pecahan bisa dikonversi ke skala 100, tetapi perlu konfirmasi agar tidak salah tafsir.",
  },
  GRADE_VALUE_FRACTION_100: {
    title: "Nilai pecahan dibaca",
    message: "Format seperti 90/100 akan dibaca sebagai 90.",
  },
  GRADE_VALUE_PERCENT: {
    title: "Nilai persen dibaca",
    message: "Tanda persen akan diabaikan dan nilai dibaca sebagai angka 0 sampai 100.",
  },
  GRADE_VALUE_DECIMAL_COMMA: {
    title: "Koma desimal dibaca",
    message: "Koma desimal akan dibaca sebagai titik desimal.",
  },
};

function normalizeImportErrorCode(code?: string): ImportUiErrorCode | null {
  if (!code) return null;
  if (code === "IMPORT_SEMESTER_MISMATCH" || code === "IMPORT_CONTEXT_MISMATCH_BLOCKED") return "IMPORT_CONTEXT_MISMATCH";
  if (code === "STUDENT_DUPLICATE_EXCEL_MATCH") return "IMPORT_DUPLICATE_STUDENT_MAPPING";
  if (code === "IMPORT_INVALID_VALUE_STRICT" || code === "GRADE_VALUE_INVALID") return "IMPORT_INVALID_GRADE_VALUE";
  if (code in importUiErrorMessages) return code as ImportUiErrorCode;
  return null;
}

function getImportErrorMessage(code: ImportUiErrorCode | null, fallback?: string) {
  return code ? importUiErrorMessages[code] : { title: "File gagal dianalisis", message: cleanBackendText(fallback) || "File gagal dianalisis. Coba periksa format workbook." };
}

function cleanBackendText(text?: string) {
  if (!text) return "";
  return text
    .replace(/\bmanual_required\b/gi, formatImportUiLabel("manual_required"))
    .replace(/\bneeds_confirmation\b/gi, formatImportUiLabel("needs_confirmation"))
    .replace(/\bfill_empty_only\b/gi, formatImportUiLabel("fill_empty_only"))
    .replace(/\bskip_existing\b/gi, formatImportUiLabel("skip_existing"))
    .replace(/\boverwrite_existing\b/gi, formatImportUiLabel("overwrite_existing"))
    .replace(/ImportPlan/gi, "Rencana import")
    .replace(/\bwarning\b/gi, "hal yang perlu dicek")
    .replace(/\bblocking\b/gi, "yang wajib diselesaikan")
    .replace(/\bblocked\b/gi, formatImportUiLabel("blocked"))
    .replace(/\bresolved\b/gi, "selesai dicek")
    .replace(/\bexecutor\b/gi, "proses simpan")
    .replace(/\bderived columns?\b/gi, "kolom hasil rumus")
    .replace(/\bmetadata\b/gi, "identitas template")
    .replace(/\bmapping\b/gi, "pencocokan")
    .replace(/\bpemetaan\b/gi, "pencocokan")
    .replace(/\bweb\b/gi, "kelas aktif")
    .replace(/\binvalid\b/gi, "tidak valid")
    .replace(/\bsafe\b/gi, "aman")
    .replace(/\bstudent_id\b/gi, "ID siswa")
    .replace(/\bcreate_chapter_and_assignment\b/gi, "membuat BAB dan tugas baru")
    .replace(/\bcreate_assignment\b/gi, "membuat tugas baru")
    .replace(/_/g, " ");
}

function fallbackNoticeTitle(code?: string | null, type?: ImportConflict["type"]): string {
  if (type === "student" || code?.includes("STUDENT")) return "Siswa perlu dicek";
  if (type === "column" || type === "structure" || code?.includes("COLUMN") || code?.includes("HEADER")) return "Kolom perlu dicek";
  if (type === "grade_value" || code?.includes("GRADE") || code?.includes("VALUE")) return "Nilai perlu dicek";
  if (
    type === "context" ||
    type === "unsupported" ||
    code?.includes("CONTEXT") ||
    code?.includes("SEMESTER") ||
    code?.includes("MANIFEST") ||
    code?.includes("METADATA") ||
    code?.includes("TEMPLATE") ||
    code?.includes("WORKBOOK") ||
    code?.includes("FILE") ||
    code?.includes("SHEET")
  ) return "File perlu dicek";
  if (type === "overwrite") return "Nilai lama perlu dicek";
  return "Bagian ini perlu dicek";
}

function getImportNotice(code?: string | null, fallback?: string, type?: ImportConflict["type"]) {
  if (code && importNoticeMessages[code]) return importNoticeMessages[code];
  const normalized = normalizeImportErrorCode(code || undefined);
  if (normalized) return importUiErrorMessages[normalized];
  return {
    title: fallbackNoticeTitle(code, type),
    message: cleanBackendText(fallback) || "Periksa kembali item ini sebelum melanjutkan import.",
  };
}

function statusLabel(status: string) {
  if (status === "safe") return "Aman";
  if (status === "warning") return "Perlu dicek";
  if (status === "needs_confirmation") return "Perlu dicek";
  if (status === "ambiguous") return "Perlu dipilih";
  if (status === "missing" || status === "missing_in_web") return "Perlu dipilih";
  if (status === "missing_in_excel") return "Perlu dicek";
  if (status === "blocked") return "Perlu dipilih";
  return cleanBackendText(status);
}

function headerTypeLabel(type: string) {
  if (type === "assignment") return "Tugas";
  if (type === "sts") return "STS";
  if (type === "sas") return "SAS";
  if (type === "reserved") return "Kolom identitas";
  if (type === "derived") return "Kolom hasil rumus";
  return "Belum dikenali";
}

function matchedByLabel(matchedBy?: StudentMapping["matchedBy"]) {
  if (matchedBy === "student_id") return "ID siswa";
  if (matchedBy === "nisn_exact") return "NISN cocok";
  if (matchedBy === "nisn_normalized") return "NISN disesuaikan";
  if (matchedBy === "name_exact") return "Nama cocok";
  if (matchedBy === "name_normalized") return "Nama disesuaikan";
  if (matchedBy === "fuzzy") return "Nama mirip";
  return "Manual";
}

function conflictSeverityLabel(severity: ImportConflict["severity"]) {
  if (severity === "blocked") return "Wajib diselesaikan";
  if (severity === "warning") return "Perlu dicek";
  return "Aman";
}

function sourceTone(sourceType: ImportSourceType): StatusBadgeTone {
  if (sourceType === "official_exact") return "success";
  if (sourceType === "official_modified" || sourceType === "free_structured") return "safe";
  if (sourceType === "official_damaged") return "warning";
  if (sourceType === "free_unstructured") return "smart";
  return "warning";
}

function statusTone(status: string): StatusBadgeTone {
  if (status === "safe") return "success";
  if (status === "warning" || status === "needs_confirmation") return "warning";
  if (status === "blocked" || status === "ambiguous" || status === "missing_in_web") return "danger";
  return "info";
}

function decisionActionLabel(action: FinalReviewModel["sections"][number]["decisions"][number]["action"]): string {
  if (action === "save") return "Simpan";
  if (action === "convert") return "Konversi";
  if (action === "overwrite") return "Timpa nilai lama";
  if (action === "create_assignment") return "Buat tugas baru";
  if (action === "create_chapter_and_assignment") return "Buat BAB dan tugas baru";
  if (action === "skip") return formatImportUiLabel("skip");
  return "Perlu pilihan";
}

function decisionActionTone(action: FinalReviewModel["sections"][number]["decisions"][number]["action"]): StatusBadgeTone {
  if (action === "save" || action === "convert") return "success";
  if (action === "overwrite" || action === "create_assignment" || action === "create_chapter_and_assignment") return "warning";
  if (action === "manual_choice_required") return "danger";
  return "info";
}

function decisionRiskLabel(risk: FinalReviewModel["sections"][number]["decisions"][number]["risk"]): string {
  if (risk === "safe") return "Aman";
  if (risk === "review") return "Perlu cek";
  return "Tinggi";
}

function decisionRiskTone(risk: FinalReviewModel["sections"][number]["decisions"][number]["risk"]): StatusBadgeTone {
  if (risk === "safe") return "success";
  if (risk === "review") return "warning";
  return "danger";
}

function emptyExecutionSummary(): ImportExecutionSummary {
  return {
    successCount: 0,
    skippedCount: 0,
    failedCount: 0,
    warnings: [],
    failedRows: [],
  };
}

function targetLabel(operation: GradeOperation): string {
  if (operation.target.gradeType === "sts") return "STS";
  if (operation.target.gradeType === "sas") return "SAS";
  return [operation.target.chapterName, operation.target.assignmentName].filter(Boolean).join(" - ") || "Tugas";
}

function gradeTargetLabel(target: GradeTarget): string {
  if (target.gradeType === "sts") return "STS";
  if (target.gradeType === "sas") return "SAS";
  return [target.chapterName, target.assignmentName].filter(Boolean).join(" - ") || "Tugas";
}

function hasBlockedConflicts(plan: ImportPlan | null): boolean {
  return Boolean(plan?.conflicts.some((item) => item.severity === "blocked"));
}

function getTopWarnings(plan: ImportPlan | null): ImportWarning[] {
  return (plan?.warnings || []).slice(0, 5);
}

function isFreeExcelAnalysis(analysis: ImportPlanInputAnalysis | null): analysis is FreeExcelAnalysis {
  return Boolean(analysis && "regions" in analysis);
}

function isRegionSelectionPending(analysis: ImportPlanInputAnalysis | null): boolean {
  return isFreeExcelAnalysis(analysis) && analysis.requiresRegionSelection && !analysis.selectedRegionId;
}

function workbookCellLabel(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function sampleStudentLabels(region: FreeExcelRegionAnalysis): string[] {
  return region.addressedDataRows
    .slice(0, 3)
    .map((row) => {
      const name = region.nameColumnIndex ? workbookCellLabel(row.values[region.nameColumnIndex - 1]) : "";
      const nisn = region.nisnColumnIndex ? workbookCellLabel(row.values[region.nisnColumnIndex - 1]) : "";
      return [name, nisn ? `(${nisn})` : ""].filter(Boolean).join(" ");
    })
    .filter(Boolean);
}

function selectedFreeExcelRegion(analysis: ImportPlanInputAnalysis | null): FreeExcelRegionAnalysis | null {
  if (!isFreeExcelAnalysis(analysis)) return null;
  return analysis.regions.find((item) => item.id === analysis.selectedRegionId) || analysis.bestRegion || analysis.regions[0] || null;
}

function buildCandidateTables(analysis: ImportPlanInputAnalysis | null) {
  if (!isFreeExcelAnalysis(analysis)) return [];
  return analysis.regions.slice(0, 10).map((region) => ({
    id: region.id,
    sheetName: region.sheetName,
    headerRowIndex: region.headerRowIndex,
    dataStartRowIndex: region.dataStartRowIndex,
    dataEndRowIndex: region.dataEndRowIndex,
    matchedStudentCount: region.matchedStudentCount,
    gradeColumnCount: region.gradeColumns.length,
    sampleStudents: sampleStudentLabels(region),
    headers: region.gradeColumns.map((column) => column.rawHeader).filter(Boolean).slice(0, 100),
  }));
}

function buildWorkbookSummaryForAi(
  analysis: ImportPlanInputAnalysis,
  plan: ImportPlan,
  fileMeta: ImportFileMeta | null,
) {
  const selectedRegion = selectedFreeExcelRegion(analysis);
  const workbook = analysis.workbook;
  const sampleRows = selectedRegion
    ? selectedRegion.addressedDataRows.slice(0, 25).map((row) => ({
        rowIndex: row.originalRowIndex,
        values: row.values.slice(0, 100),
      }))
    : "inputSheet" in analysis && analysis.inputSheet
      ? analysis.inputSheet.addressedRows.slice(0, 25).map((row) => ({
          rowIndex: row.originalRowIndex,
          values: row.values.slice(0, 100),
        }))
      : [];

  return {
    fileName: fileMeta?.name || workbook.fileName,
    sheets: workbook.sheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
    })),
    candidateTables: buildCandidateTables(analysis),
    headers: plan.columnMappings.slice(0, 100).map((mapping) => ({
      columnIndex: mapping.columnIndex,
      rawHeader: mapping.rawHeader,
    })),
    sampleRows,
  };
}

function buildDeterministicPlanForAi(plan: ImportPlan) {
  return {
    studentMappings: plan.studentMappings.map((mapping) => ({
      rowIndex: mapping.rowIndex,
      excelName: mapping.excelName,
      excelNisn: mapping.excelNisn,
      studentId: mapping.studentId,
      webName: mapping.webName,
      webNisn: mapping.webNisn,
      status: mapping.status,
      confidence: mapping.confidence,
      matchedBy: mapping.matchedBy,
      warnings: mapping.warnings.map((item) => ({ code: item.code, message: item.message })),
      conflicts: mapping.conflicts.map((item) => ({ code: item.code, message: item.message })),
    })),
    columnMappings: plan.columnMappings.map((mapping) => ({
      columnIndex: mapping.columnIndex,
      rawHeader: mapping.rawHeader,
      status: mapping.status,
      confidence: mapping.confidence,
      target: mapping.target,
      headerType: mapping.parsedHeader.headerType,
      warnings: mapping.warnings.map((item) => ({ code: item.code, message: item.message })),
      conflicts: mapping.conflicts.map((item) => ({ code: item.code, message: item.message })),
    })),
    conflicts: plan.conflicts.map((conflict) => ({
      code: conflict.code,
      type: conflict.type,
      severity: conflict.severity,
      message: conflict.message,
      rowIndex: conflict.rowIndex,
      columnIndex: conflict.columnIndex,
      options: conflict.options,
    })),
    warnings: plan.warnings.map((warning) => ({
      code: warning.code,
      severity: warning.severity,
      message: warning.message,
      rowIndex: warning.rowIndex,
      columnIndex: warning.columnIndex,
    })),
  };
}

function buildSmartImportAssistRequest(
  analysis: ImportPlanInputAnalysis,
  plan: ImportPlan,
  context: ImportPlanContext,
  fileMeta: ImportFileMeta | null,
): SmartImportAssistRequest {
  return {
    mode: "grade_import_assist",
    workbookSummary: buildWorkbookSummaryForAi(analysis, plan, fileMeta),
    webContext: {
      students: context.students.map((student) => ({
        id: student.id,
        name: student.name,
        nisn: student.nisn || undefined,
      })),
      chapters: context.chapters.map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
      })),
      assignments: context.assignments.map((assignment) => ({
        id: assignment.id,
        chapter_id: assignment.chapter_id,
        name: assignment.name,
      })),
    },
    deterministicPlan: buildDeterministicPlanForAi(plan),
  };
}

function smartImportAssistCacheKey(
  fileMeta: ImportFileMeta | null,
  plan: ImportPlan | null,
  analysis: ImportPlanInputAnalysis | null,
): string | null {
  if (!plan) return null;
  const filePart = fileMeta ? `${fileMeta.name}:${fileMeta.size}:${fileMeta.lastModified}` : "unknown-file";
  const sourcePart = `${plan.sourceType}:${isFreeExcelAnalysis(analysis) ? analysis.selectedRegionId || analysis.bestRegion?.id || "no-region" : "official"}`;
  const summaryPart = [
    plan.summary.conflictCount || plan.conflicts.length,
    plan.summary.needsConfirmation,
    plan.summary.blockedOperations,
    plan.summary.readyImportCount || 0,
    plan.summary.skippedValueCount || 0,
  ].join(":");
  return `${filePart}|${sourcePart}|${summaryPart}`;
}

function selectedRegionLabel(analysis: FreeExcelAnalysis): string | null {
  if (!analysis.selectedRegionId) return null;
  const region = analysis.regions.find((item) => item.id === analysis.selectedRegionId);
  if (!region) return null;
  return `${region.sheetName}, header baris ${region.headerRowIndex}`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values)).filter(Boolean);
}

function uniqueNumbersForState(values: number[]): number[] {
  return Array.from(new Set(values)).filter((value) => Number.isFinite(value));
}

function conflictKey(conflict: ImportConflict): string {
  return [
    conflict.type,
    conflict.code,
    conflict.rowIndex ?? "",
    conflict.columnIndex ?? "",
    conflict.message,
  ].join(":");
}

function simplifiedWarningKey(warning: ImportWarning): string {
  return getSimplifiedConflictSourceId({
    type: warning.code.includes("STUDENT") ? "student" : warning.code.includes("CONTEXT") || warning.code.includes("SEMESTER") ? "context" : "column",
    code: warning.code,
    rowIndex: warning.rowIndex,
    columnIndex: warning.columnIndex,
    message: warning.message,
  });
}

function targetKey(target: GradeTarget | undefined): string {
  if (!target) return "";
  if (target.gradeType === "assignment") {
    return `assignment:${target.assignmentId || ""}:${target.chapterId || ""}:${target.chapterName || ""}:${target.assignmentName || ""}`;
  }
  return `special:${target.gradeType}`;
}

function buildTargetFromColumnResolution(resolution: ColumnResolution, context: ImportPlanContext): GradeTarget | undefined {
  if (resolution.kind === "ignore") return undefined;
  if (resolution.kind === "sts" || resolution.kind === "sas") return { gradeType: resolution.kind };

  if (resolution.kind === "existing_assignment" && resolution.assignmentId) {
    const assignment = context.assignments.find((item) => item.id === resolution.assignmentId);
    const chapter = assignment ? context.chapters.find((item) => item.id === assignment.chapter_id) : undefined;
    if (!assignment) return undefined;
    return {
      gradeType: "assignment",
      chapterId: chapter?.id || assignment.chapter_id,
      chapterName: chapter?.name,
      assignmentId: assignment.id,
      assignmentName: assignment.name,
    };
  }

  if (resolution.kind === "create_assignment") {
    const chapter = context.chapters.find((item) => item.id === resolution.chapterId);
    return {
      gradeType: "assignment",
      chapterId: resolution.chapterId || chapter?.id,
      chapterName: resolution.chapterName || chapter?.name,
      assignmentName: resolution.assignmentName,
    };
  }

  return {
    gradeType: "assignment",
    chapterName: resolution.chapterName,
    assignmentName: resolution.assignmentName,
  };
}

function resolutionCreatesNewStructure(resolution: ColumnResolution | undefined): boolean {
  return Boolean(resolution && ["create_assignment", "create_chapter_and_assignment"].includes(resolution.kind) && resolution.confirmed);
}

function operationActionAfterResolution(operation: GradeOperation, updateMode: UpdateMode): GradeOperation["action"] {
  if (operation.conflicts.length) return "blocked";
  if (operation.value === null) return "skip_empty";
  if (operation.existingValue !== null && operation.existingValue !== undefined) {
    if (updateMode === "overwrite_existing" || updateMode === "overwrite_selected_columns") return "overwrite";
    return "skip_existing";
  }
  return "fill_empty";
}

function recalculateSummary(plan: ImportPlan): ImportPlan["summary"] {
  const readyOperations = plan.gradeOperations.filter((operation) => ["fill_empty", "overwrite"].includes(operation.action));
  const skippedOperations = plan.gradeOperations.filter((operation) =>
    ["skip_empty", "skip_existing", "manual_skip_row", "manual_skip_column", "manual_skip_cell"].includes(operation.action),
  );
  const invalidValues = plan.gradeOperations.filter((operation) =>
    operation.conflicts.some((item) => item.code === "IMPORT_INVALID_VALUE_STRICT" || item.type === "grade_value"),
  ).length;
  const newChapterSuggestions = plan.structureSuggestions.filter((item) => item.type === "create_chapter" || item.type === "create_chapter_and_assignment").length;
  const newAssignmentSuggestions = plan.structureSuggestions.filter((item) => item.type === "create_assignment" || item.type === "create_chapter_and_assignment").length;

  return {
    ...plan.summary,
    matchedStudents: plan.studentMappings.filter((mapping) => mapping.studentId && ["safe", "warning"].includes(mapping.status)).length,
    mappedColumns: plan.columnMappings.filter((mapping) => mapping.target && ["safe", "warning"].includes(mapping.status)).length,
    safeOperations: readyOperations.length,
    blockedOperations: plan.gradeOperations.filter((operation) => operation.action === "blocked").length,
    needsConfirmation: plan.gradeOperations.filter((operation) => operation.action === "needs_confirmation").length,
    matchedStudentCount: plan.studentMappings.filter((mapping) => mapping.studentId && ["safe", "warning"].includes(mapping.status)).length,
    ambiguousStudentCount: plan.studentMappings.filter((mapping) => mapping.status === "ambiguous").length,
    missingStudentCount: plan.studentMappings.filter((mapping) => mapping.status === "missing_in_web").length
      + plan.missingInExcelStudents.length,
    gradeColumnCount: plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived && mapping.status !== "missing").length,
    conflictCount: plan.conflicts.length,
    newAssignmentCount: newAssignmentSuggestions,
    newChapterCount: newChapterSuggestions,
    invalidValueCount: invalidValues,
    readyImportCount: readyOperations.length,
    skippedValueCount: skippedOperations.length,
  };
}

function applyResolverToPlan(
  basePlan: ImportPlan,
  resolver: ImportResolverState,
  context: ImportPlanContext,
  updateMode: UpdateMode,
): ImportPlan {
  const ignoredRows = new Set(resolver.ignoredRows);
  const unresolvedRows = new Set(resolver.unresolvedRows);
  const ignoredColumns = new Set(resolver.ignoredColumns);
  const ignoredCells = new Set(resolver.ignoredCells);
  const resolvedKeys = new Set(resolver.resolvedConflictKeys);

  const studentsById = new Map(context.students.map((student) => [student.id, student]));
  const columnOverrides = new Map(
    Object.entries(resolver.columnOverrides).map(([columnIndex, resolution]) => [Number(columnIndex), resolution]),
  );

  const studentMappings = basePlan.studentMappings.map((mapping) => {
    const overrideStudent = resolver.studentOverrides[String(mapping.rowIndex)]
      ? studentsById.get(resolver.studentOverrides[String(mapping.rowIndex)])
      : undefined;

    if (ignoredRows.has(mapping.rowIndex)) {
      return {
        ...mapping,
        status: "warning" as const,
        warnings: uniqueStrings([...mapping.warnings.map((item) => item.code), "STUDENT_ROW_IGNORED_BY_USER"]).map((code) => (
          mapping.warnings.find((item) => item.code === code) || {
            code,
            severity: "warning" as const,
            message: "Baris Excel diabaikan untuk import.",
            rowIndex: mapping.rowIndex,
          }
        )),
        conflicts: [],
      };
    }

    if (unresolvedRows.has(mapping.rowIndex)) {
      return {
        ...mapping,
        status: "blocked" as const,
        conflicts: [{
          code: "STUDENT_MARKED_UNRESOLVED",
          severity: "blocked" as const,
          type: "student" as const,
          rowIndex: mapping.rowIndex,
          message: "Baris siswa ditandai belum selesai.",
        }],
      };
    }

    if (overrideStudent) {
      return {
        ...mapping,
        studentId: overrideStudent.id,
        webName: overrideStudent.name,
        webNisn: overrideStudent.nisn || undefined,
        matchedBy: "manual" as const,
        confidence: 100,
        status: "safe" as const,
        conflicts: [],
      };
    }

    return mapping;
  });

  const columnMappings = basePlan.columnMappings.map((mapping) => {
    const resolution = columnOverrides.get(mapping.columnIndex);

    if (ignoredColumns.has(mapping.columnIndex) || resolution?.kind === "ignore") {
      return {
        ...mapping,
        target: undefined,
        confidence: 100,
        status: "safe" as const,
        conflicts: [],
        warnings: [{
          code: "COLUMN_IGNORED_BY_USER",
          severity: "warning" as const,
          message: "Kolom Excel diabaikan untuk import.",
          columnIndex: mapping.columnIndex,
        }],
      };
    }

    if (resolution) {
      const target = buildTargetFromColumnResolution(resolution, context);
      const needsStructureConfirmation = ["create_assignment", "create_chapter_and_assignment"].includes(resolution.kind) && !resolution.confirmed;
      return {
        ...mapping,
        target,
        confidence: resolution.kind === "existing_assignment" || resolution.kind === "sts" || resolution.kind === "sas" ? 100 : 92,
        status: needsStructureConfirmation ? "needs_confirmation" as const : "safe" as const,
        conflicts: needsStructureConfirmation
          ? [{
              code: "STRUCTURE_CONFIRMATION_REQUIRED",
              severity: "blocked" as const,
              type: "structure" as const,
              columnIndex: mapping.columnIndex,
              message: "BAB/tugas baru belum dikonfirmasi.",
            }]
          : [],
        warnings: resolution.kind === "create_assignment" || resolution.kind === "create_chapter_and_assignment"
          ? [{
              code: "STRUCTURE_CREATION_CONFIRMED_IN_PREVIEW",
              severity: "warning" as const,
              message: "Struktur baru hanya dikonfirmasi untuk preview, belum dibuat di database.",
              columnIndex: mapping.columnIndex,
            }]
          : mapping.warnings,
      };
    }

    return mapping;
  });

  const studentByRow = new Map(studentMappings.map((mapping) => [mapping.rowIndex, mapping]));
  const columnByIndex = new Map(columnMappings.map((mapping) => [mapping.columnIndex, mapping]));

  const gradeOperations = basePlan.gradeOperations.map((operation) => {
    const student = studentByRow.get(operation.rowIndex);
    const column = columnByIndex.get(operation.columnIndex);
    const columnResolution = columnOverrides.get(operation.columnIndex);
    const ignored = ignoredRows.has(operation.rowIndex) || ignoredColumns.has(operation.columnIndex) || column?.target === undefined;
    const ignoredCell = ignoredCells.has(`${operation.rowIndex}:${operation.columnIndex}`);
    const unresolved = unresolvedRows.has(operation.rowIndex);
    const studentSafe = Boolean(student?.studentId && ["safe", "warning"].includes(student.status));
    const columnSafe = Boolean(column?.target && ["safe", "warning"].includes(column.status));

    let conflicts = operation.conflicts.filter((item) => {
      if (resolvedKeys.has(conflictKey(item))) return false;
      if (ignored || ignoredCell) return false;
      if (item.type === "student" && studentSafe) return false;
      if ((item.type === "column" || item.type === "structure") && columnSafe) return false;
      return true;
    });

    if (unresolved) {
      conflicts = [{
        code: "STUDENT_MARKED_UNRESOLVED",
        severity: "blocked" as const,
        type: "student" as const,
        rowIndex: operation.rowIndex,
        columnIndex: operation.columnIndex,
        message: "Baris siswa ditandai belum selesai.",
      }];
    }

    const nextOperation: GradeOperation = {
      ...operation,
      studentId: student?.studentId,
      target: column?.target || operation.target,
      existingValue: resolutionCreatesNewStructure(columnResolution) ? null : operation.existingValue,
      updateMode,
      conflicts,
      action: ignoredRows.has(operation.rowIndex)
        ? "manual_skip_row"
        : (ignoredColumns.has(operation.columnIndex) || column?.target === undefined)
          ? "manual_skip_column"
          : ignoredCell
            ? "manual_skip_cell"
            : operation.action,
    };
    nextOperation.action = ignored || ignoredCell ? nextOperation.action : operationActionAfterResolution(nextOperation, updateMode);
    return nextOperation;
  });

  const operationConflicts = gradeOperations.flatMap((operation) => operation.conflicts);
  const planConflicts = basePlan.conflicts.filter((item) => {
    if (resolvedKeys.has(conflictKey(item))) return false;
    if (item.rowIndex && ignoredRows.has(item.rowIndex)) return false;
    if (item.columnIndex && ignoredColumns.has(item.columnIndex)) return false;
    if (item.type === "student" && item.rowIndex) {
      const mapping = studentByRow.get(item.rowIndex);
      return !(mapping?.studentId && ["safe", "warning"].includes(mapping.status));
    }
    if ((item.type === "column" || item.type === "structure") && item.columnIndex) {
      const mapping = columnByIndex.get(item.columnIndex);
      return !(mapping?.target && ["safe", "warning"].includes(mapping.status));
    }
    return true;
  });

  const nextPlan: ImportPlan = {
    ...basePlan,
    updateMode,
    studentMappings,
    columnMappings,
    gradeOperations,
    conflicts: [...planConflicts, ...operationConflicts],
  };

  return {
    ...nextPlan,
    conflicts: nextPlan.conflicts.filter((item, index, all) =>
      all.findIndex((candidate) => conflictKey(candidate) === conflictKey(item)) === index,
    ),
    summary: recalculateSummary(nextPlan),
  };
}

function MetricCard({
  label,
  value,
  tone = "info",
}: {
  label: string;
  value: number;
  tone?: "blue" | "green" | "orange" | "red" | "violet" | "info";
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-100",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100",
    orange: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/25 dark:text-orange-100",
    red: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-100",
    violet: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-100",
    info: "border-border bg-slate-50 text-slate-900 dark:bg-slate-900/60 dark:text-slate-100",
  }[tone];

  return (
    <div className={cn("min-w-0 rounded-2xl border p-3", toneClass)}>
      <p className="truncate text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-border bg-white p-6 text-center dark:bg-slate-950">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900">
        <Clock className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function RegionSelectionPanel({
  analysis,
  onSelectRegion,
}: {
  analysis: FreeExcelAnalysis;
  onSelectRegion: (regionId: string) => void;
}) {
  const bestRegionId = analysis.bestRegion?.id;

  return (
    <div className="rounded-[24px] border border-orange-200 bg-orange-50/80 p-4 shadow-sm dark:border-orange-900/60 dark:bg-orange-950/20">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="warning">Perlu pilih tabel</StatusBadge>
            <StatusBadge tone="safe">{analysis.regions.length} tabel nilai</StatusBadge>
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">
            Kami menemukan beberapa tabel nilai
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Pilih tabel yang ingin dipakai. Tabel paling mungkin diberi tanda, tetapi nilai belum akan disimpan sebelum Anda memilih.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {analysis.regions.map((region) => {
          const gradeHeaders = region.gradeColumns.slice(0, 3).map((column) => column.rawHeader).filter(Boolean);
          const studentSamples = sampleStudentLabels(region);
          const selected = analysis.selectedRegionId === region.id;
          const best = bestRegionId === region.id;

          return (
            <div
              key={region.id}
              className={cn(
                "rounded-2xl border bg-white p-3 shadow-sm dark:bg-slate-950",
                selected ? "border-emerald-300 ring-2 ring-emerald-100 dark:border-emerald-700 dark:ring-emerald-950" : "border-border",
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50" title={region.sheetName}>
                      {region.sheetName}
                    </p>
                    {best ? <StatusBadge tone="safe">Paling mungkin</StatusBadge> : <StatusBadge tone="warning">Perlu dicek</StatusBadge>}
                    {selected ? <StatusBadge tone="success">Dipilih</StatusBadge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Header baris {region.headerRowIndex}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/70">
                  <p className="text-muted-foreground">Siswa cocok</p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-slate-50">{region.matchedStudentCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900/70">
                  <p className="text-muted-foreground">Kolom nilai</p>
                  <p className="mt-1 font-semibold text-slate-950 dark:text-slate-50">{region.gradeColumns.length}</p>
                </div>
              </div>

              <div className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Header nilai: </span>
                  {gradeHeaders.length ? gradeHeaders.join(", ") : "Belum ada contoh"}
                </p>
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-200">Contoh siswa: </span>
                  {studentSamples.length ? studentSamples.join(", ") : "Belum ada contoh"}
                </p>
              </div>

              <Button
                type="button"
                className="mt-3 min-h-10 w-full rounded-full"
                variant={selected ? "outline" : "default"}
                onClick={() => onSelectRegion(region.id)}
              >
                {selected ? "Tabel ini dipakai" : "Gunakan tabel ini"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalysisStep({
  plan,
  analysis,
  onSelectRegion,
}: {
  plan: ImportPlan | null;
  analysis: ImportPlanInputAnalysis | null;
  onSelectRegion: (regionId: string) => void;
}) {
  if (!plan) {
    return <EmptyPanel title="Belum ada file dianalisis" description="Upload file Excel atau CSV untuk membuat preview import." />;
  }

  const freeAnalysis = isFreeExcelAnalysis(analysis) ? analysis : null;

  return (
    <div className="space-y-4">
      {freeAnalysis?.requiresRegionSelection ? (
        <RegionSelectionPanel analysis={freeAnalysis} onSelectRegion={onSelectRegion} />
      ) : null}

      <div className="rounded-[20px] border border-slate-300 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={sourceTone(plan.sourceType)}>{sourceLabels[plan.sourceType]}</StatusBadge>
          <StatusBadge tone={hasBlockedConflicts(plan) ? "warning" : "safe"}>
            {hasBlockedConflicts(plan) ? "Perlu dicek" : "Siap dilanjutkan"}
          </StatusBadge>
          {freeAnalysis?.selectedRegionId ? <StatusBadge tone="safe">{selectedRegionLabel(freeAnalysis)}</StatusBadge> : null}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          File sudah dibaca. Lanjutkan ke Daftar Bermasalah atau Konfigurasi Header untuk menyelesaikan pilihan yang diperlukan.
        </p>
      </div>

      {(plan.summary.gradeColumnCount || 0) === 0 ? (
        <RiskAlert title={getImportNotice("IMPORT_NO_GRADE_COLUMNS").title} tone="blocked">
          {getImportNotice("IMPORT_NO_GRADE_COLUMNS").message}
        </RiskAlert>
      ) : null}

      {hasBlockedConflicts(plan) ? (
        <RiskAlert title={getImportNotice("IMPORT_PLAN_BLOCKED").title} tone="blocked">
          {getImportNotice("IMPORT_PLAN_BLOCKED").message}
        </RiskAlert>
      ) : null}

      <div className="space-y-2">
        {getTopWarnings(plan).length ? getTopWarnings(plan).map((item, index) => {
          const notice = getImportNotice(item.code, item.message);
          return (
            <RiskAlert key={`${item.code}-${index}`} title={notice.title} tone="warning">
              {notice.message}
            </RiskAlert>
          );
        }) : (
          <RiskAlert title="Tidak ada hal penting yang perlu dicek" tone="safe">
            Pemeriksaan awal tidak menemukan masalah besar. Tetap lihat tabel sebelum menyimpan nilai.
          </RiskAlert>
        )}
      </div>
    </div>
  );
}

function ImportStartPanel({
  fileName,
  canDownloadOfficialTemplate,
  isDownloadingTemplate,
  onDownloadOfficialTemplate,
  onFileSelected,
  downloadReason,
  uploadInputRef,
}: {
  fileName?: string | null;
  canDownloadOfficialTemplate: boolean;
  isDownloadingTemplate: boolean;
  onDownloadOfficialTemplate?: () => void | Promise<void>;
  onFileSelected: (file: File) => void;
  downloadReason?: string | null;
  uploadInputRef?: RefObject<HTMLInputElement>;
}) {
  const downloadDisabled = !canDownloadOfficialTemplate || !onDownloadOfficialTemplate || isDownloadingTemplate;
  return (
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
      <section className="rounded-[20px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
        <div className="mb-3 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">Upload file nilai</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Gunakan Excel/CSV dari template SIPENA atau file nilai lain.
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">.xlsx, .xls, .csv</span>
        </div>
        <ImportDropzone fileName={fileName} onFileSelected={onFileSelected} inputRef={uploadInputRef} />
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          File diperiksa dulu. Nilai lama tidak ditimpa tanpa konfirmasi.
        </p>
      </section>

      <section className="rounded-[20px] border border-border bg-slate-50/75 p-4 shadow-sm dark:bg-slate-900/40">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Template resmi</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Paling aman untuk input baru karena struktur sudah sesuai kelas aktif.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-4 min-h-10 w-full rounded-full bg-white"
          disabled={downloadDisabled}
          aria-describedby={downloadReason ? "sipena-template-download-reason" : undefined}
          title={downloadReason || undefined}
          onClick={onDownloadOfficialTemplate}
        >
          {isDownloadingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {isDownloadingTemplate ? "Menyiapkan..." : "Download template"}
        </Button>
        {downloadReason ? (
          <p id="sipena-template-download-reason" className="mt-2 text-xs leading-5 text-muted-foreground">
            {downloadReason}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function StudentMappingCard({ mapping }: { mapping: StudentMapping }) {
  const excelLabel = mapping.excelName || mapping.excelNisn || `Baris ${mapping.rowIndex}`;
  const webLabel = `Kelas aktif: ${mapping.webName || "Belum cocok"} ${mapping.webNisn ? `(${mapping.webNisn})` : ""}`.trim();

  return (
    <div className="rounded-2xl border border-border bg-white p-3 dark:bg-slate-950">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50" title={excelLabel}>
            {excelLabel}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={webLabel}>
            {webLabel}
          </p>
        </div>
        <StatusBadge tone={statusTone(mapping.status)}>{statusLabel(mapping.status)}</StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Baris {mapping.rowIndex}</span>
        <span>Keyakinan {mapping.confidence}%</span>
        <span>{matchedByLabel(mapping.matchedBy)}</span>
      </div>
    </div>
  );
}

function ColumnMappingCard({ mapping }: { mapping: ColumnMapping }) {
  const target = mapping.target?.gradeType === "assignment"
    ? [mapping.target.chapterName, mapping.target.assignmentName].filter(Boolean).join(" - ")
    : mapping.target?.gradeType?.toUpperCase();

  return (
    <div className="rounded-2xl border border-border bg-white p-3 dark:bg-slate-950">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50" title={mapping.rawHeader || `Kolom ${mapping.columnIndex}`}>{mapping.rawHeader || `Kolom ${mapping.columnIndex}`}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={target || "Belum dipetakan"}>Target: {target || "Belum dipetakan"}</p>
        </div>
        <StatusBadge tone={statusTone(mapping.status)}>{statusLabel(mapping.status)}</StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Kolom {mapping.columnIndex}</span>
        <span>Keyakinan {mapping.confidence}%</span>
        <span>{headerTypeLabel(mapping.parsedHeader.headerType)}</span>
      </div>
    </div>
  );
}

function MappingStep({ plan }: { plan: ImportPlan | null }) {
  if (!plan) {
    return <EmptyPanel title="Pemeriksaan belum tersedia" description="Preview akan menampilkan hasil cocok siswa dan target kolom setelah file selesai diperiksa." />;
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Cocokkan Siswa</h3>
        </div>
        <div className="grid gap-3 md:hidden">
          {plan.studentMappings.length ? plan.studentMappings.slice(0, 24).map((mapping) => <StudentMappingCard key={mapping.rowIndex} mapping={mapping} />) : (
            <EmptyPanel title="Belum ada siswa" description="File tidak memuat baris siswa yang bisa dicocokkan. Pastikan ada kolom Nama Siswa atau NISN." />
          )}
        </div>
        <div className="hidden overflow-x-auto rounded-[24px] border border-border bg-white dark:bg-slate-950 md:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs text-muted-foreground dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Baris</th>
                <th className="px-4 py-3 text-left font-semibold">Excel</th>
                <th className="px-4 py-3 text-left font-semibold">Data Web</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Keyakinan</th>
              </tr>
            </thead>
            <tbody>
              {plan.studentMappings.map((mapping) => (
                <tr key={mapping.rowIndex} className="border-t border-border">
                  <td className="px-4 py-3">{mapping.rowIndex}</td>
                  <td className="max-w-[220px] px-4 py-3"><span className="block truncate" title={mapping.excelName || "-"}>{mapping.excelName || "-"}</span><span className="block truncate text-xs text-muted-foreground" title={mapping.excelNisn || ""}>{mapping.excelNisn || ""}</span></td>
                  <td className="max-w-[220px] px-4 py-3"><span className="block truncate" title={mapping.webName || "-"}>{mapping.webName || "-"}</span><span className="block truncate text-xs text-muted-foreground" title={mapping.webNisn || ""}>{mapping.webNisn || ""}</span></td>
                  <td className="px-4 py-3"><StatusBadge tone={statusTone(mapping.status)}>{statusLabel(mapping.status)}</StatusBadge></td>
                  <td className="px-4 py-3">{mapping.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Target Kolom/BAB/Tugas</h3>
        </div>
        <div className="grid gap-3 md:hidden">
          {plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived).length ? plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived).map((mapping) => (
            <ColumnMappingCard key={mapping.columnIndex} mapping={mapping} />
          )) : (
            <EmptyPanel title="Tidak ada kolom nilai" description="Tambahkan kolom seperti BAB 1 - Tugas 1, STS, atau SAS agar nilai bisa diarahkan ke target yang benar." />
          )}
        </div>
        <div className="hidden overflow-x-auto rounded-[24px] border border-border bg-white dark:bg-slate-950 md:block">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-slate-50 text-xs text-muted-foreground dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Kolom</th>
                <th className="px-4 py-3 text-left font-semibold">Header</th>
                <th className="px-4 py-3 text-left font-semibold">Target</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Keyakinan</th>
              </tr>
            </thead>
            <tbody>
              {plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived).map((mapping) => {
                const target = mapping.target?.gradeType === "assignment"
                  ? [mapping.target.chapterName, mapping.target.assignmentName].filter(Boolean).join(" - ")
                  : mapping.target?.gradeType?.toUpperCase();
                return (
                  <tr key={mapping.columnIndex} className="border-t border-border">
                    <td className="px-4 py-3">{mapping.columnIndex}</td>
                    <td className="max-w-[260px] px-4 py-3"><span className="block truncate" title={mapping.rawHeader}>{mapping.rawHeader}</span></td>
                    <td className="max-w-[260px] px-4 py-3"><span className="block truncate" title={target || "-"}>{target || "-"}</span></td>
                    <td className="px-4 py-3"><StatusBadge tone={statusTone(mapping.status)}>{statusLabel(mapping.status)}</StatusBadge></td>
                    <td className="px-4 py-3">{mapping.confidence}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface ConflictResolutionActions {
  onUseCurrentStudent: (rowIndex: number, studentId: string) => void;
  onChooseStudent: (rowIndex: number, studentId: string) => void;
  onIgnoreRow: (rowIndex: number) => void;
  onResetRowSelection: (rowIndex: number) => void;
  onMarkRowUnresolved: (rowIndex: number) => void;
  onUseExistingAssignment: (columnIndex: number, assignmentId: string) => void;
  onConfirmCreateAssignment: (columnIndex: number, chapterId: string, assignmentName: string) => void;
  onConfirmCreateChapterAndAssignment: (columnIndex: number, chapterName: string, assignmentName: string) => void;
  onSetSpecialColumn: (columnIndex: number, kind: "sts" | "sas") => void;
  onIgnoreColumn: (columnIndex: number) => void;
  onIgnoreCell: (rowIndex: number, columnIndex: number) => void;
  onResolveConflict: (conflict: ImportConflict) => void;
  onResetConflictChoice: (conflict: ImportConflict) => void;
  onKeepDuplicateColumn: (conflict: ImportConflict, keepColumnIndex: number) => void;
  onBulkIgnoreDerived: () => void;
  onBulkUseSafeMappings: () => void;
  onBulkTrustStudentIdWarnings: () => void;
  onApplySafeFixes: () => void;
  onApproveSipenaSuggestions: () => void;
  onResetAllChoices: () => void;
  onUpdateModeChange: (mode: UpdateMode) => void;
  onSelectRegion: (regionId: string) => void;
  onSetColumnInclude: (column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetColumnHeader: (column: SpreadsheetPreviewColumn, header: string) => void;
  onSetColumnTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
  onSetColumnValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
  onSetCellInclude: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetCellValueMode: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, mode: CellValueMode, overwriteConfirmed?: boolean) => void;
  onAcceptSuggestedValue: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn) => void;
  onUseSuggestedValue: (rowIndex: number, columnIndex: number, value: number) => void;
  onResetCellSelection: (cell: SpreadsheetPreviewCell) => void;
}

function ResolutionButton({
  children,
  onClick,
  tone = "default",
  size = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: "default" | "safe" | "warning";
  size?: "default" | "compact";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border font-semibold transition-colors",
        size === "default" && "min-h-9 px-3 py-1.5 text-xs",
        size === "compact" && "min-h-7 px-2.5 py-1 text-[11px]",
        tone === "safe" && "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-100",
        tone === "warning" && "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/35 dark:text-orange-100",
        tone === "default" && "border-border bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function StructureResolutionControls({
  conflict,
  mapping,
  context,
  actions,
}: {
  conflict: ImportConflict;
  mapping?: ColumnMapping;
  context: ImportPlanContext;
  actions: ConflictResolutionActions;
}) {
  const suggestedChapterName = mapping?.target?.chapterName || mapping?.target?.sourceChapterName || "";
  const suggestedAssignmentName = mapping?.target?.assignmentName || mapping?.target?.sourceAssignmentName || mapping?.rawHeader || "";
  const [chapterName, setChapterName] = useState(suggestedChapterName);
  const [assignmentName, setAssignmentName] = useState(suggestedAssignmentName);
  const [chapterId, setChapterId] = useState(mapping?.target?.chapterId || context.chapters[0]?.id || "");

  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-orange-100 bg-white/70 p-3 dark:border-orange-900/50 dark:bg-slate-950/40">
      <label className="grid gap-1 text-xs font-medium">
        BAB
        <input
          value={chapterName}
          onChange={(event) => setChapterName(event.target.value)}
          className="min-h-9 rounded-xl border border-border bg-white px-3 text-sm dark:bg-slate-950"
          placeholder="Nama BAB"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Tugas
        <input
          value={assignmentName}
          onChange={(event) => setAssignmentName(event.target.value)}
          className="min-h-9 rounded-xl border border-border bg-white px-3 text-sm dark:bg-slate-950"
          placeholder="Nama tugas"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {context.chapters.length ? (
          <select
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
            className="min-h-9 max-w-full rounded-full border border-border bg-white px-3 text-xs dark:bg-slate-950"
          >
            {context.chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>{chapter.name}</option>
            ))}
          </select>
        ) : null}
        <ResolutionButton
          tone="warning"
          onClick={() => {
            if (!conflict.columnIndex || !chapterId || !assignmentName.trim()) return;
            actions.onConfirmCreateAssignment(conflict.columnIndex, chapterId, assignmentName.trim());
          }}
        >
          Konfirmasi tugas baru
        </ResolutionButton>
        <ResolutionButton
          tone="warning"
          onClick={() => {
            if (!conflict.columnIndex || !chapterName.trim() || !assignmentName.trim()) return;
            actions.onConfirmCreateChapterAndAssignment(conflict.columnIndex, chapterName.trim(), assignmentName.trim());
          }}
        >
          Konfirmasi BAB + tugas
        </ResolutionButton>
      </div>
    </div>
  );
}

function ConflictActionPanel({
  conflict,
  plan,
  context,
  actions,
}: {
  conflict: ImportConflict;
  plan: ImportPlan;
  context: ImportPlanContext;
  actions: ConflictResolutionActions;
}) {
  const studentMapping = conflict.rowIndex ? plan.studentMappings.find((mapping) => mapping.rowIndex === conflict.rowIndex) : undefined;
  const columnMapping = conflict.columnIndex ? plan.columnMappings.find((mapping) => mapping.columnIndex === conflict.columnIndex) : undefined;
  const chapterById = new Map(context.chapters.map((chapter) => [chapter.id, chapter]));

  if (conflict.type === "student" && conflict.rowIndex) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {studentMapping?.studentId ? (
          <ResolutionButton tone="safe" onClick={() => actions.onUseCurrentStudent(conflict.rowIndex!, studentMapping.studentId!)}>
            Gunakan siswa kelas ini
          </ResolutionButton>
        ) : null}
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) actions.onChooseStudent(conflict.rowIndex!, event.target.value);
          }}
          className="min-h-9 max-w-full rounded-full border border-border bg-white px-3 text-xs dark:bg-slate-950"
        >
          <option value="">Pilih siswa lain</option>
          {context.students.map((student) => (
            <option key={student.id} value={student.id}>{student.name} {student.nisn ? `(${student.nisn})` : ""}</option>
          ))}
        </select>
        <ResolutionButton onClick={() => actions.onIgnoreRow(conflict.rowIndex!)}>Abaikan baris Excel</ResolutionButton>
        <ResolutionButton tone="warning" onClick={() => actions.onMarkRowUnresolved(conflict.rowIndex!)}>Tandai belum selesai</ResolutionButton>
        <ResolutionButton onClick={() => actions.onResetConflictChoice(conflict)}>Ulangi pilihan ini</ResolutionButton>
      </div>
    );
  }

  if ((conflict.type === "column" || conflict.type === "structure") && conflict.columnIndex) {
    const duplicateOptionColumns = conflict.code === "IMPORT_DUPLICATE_COLUMN_TARGET"
      ? (conflict.options || [])
          .map((header) => plan.columnMappings.find((mapping) => mapping.rawHeader === header))
          .filter(Boolean) as ColumnMapping[]
      : [];

    return (
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) actions.onUseExistingAssignment(conflict.columnIndex!, event.target.value);
            }}
            className="min-h-9 max-w-full rounded-full border border-border bg-white px-3 text-xs dark:bg-slate-950"
          >
            <option value="">Gunakan tugas existing</option>
            {context.assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {[chapterById.get(assignment.chapter_id)?.name, assignment.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
          <ResolutionButton tone="safe" onClick={() => actions.onSetSpecialColumn(conflict.columnIndex!, "sts")}>Jadikan STS</ResolutionButton>
          <ResolutionButton tone="safe" onClick={() => actions.onSetSpecialColumn(conflict.columnIndex!, "sas")}>Jadikan SAS</ResolutionButton>
          <ResolutionButton onClick={() => actions.onIgnoreColumn(conflict.columnIndex!)}>Abaikan kolom</ResolutionButton>
          <ResolutionButton onClick={() => actions.onResetConflictChoice(conflict)}>Ulangi pilihan ini</ResolutionButton>
          {conflict.code === "IMPORT_DUPLICATE_COLUMN_TARGET" ? (
            <ResolutionButton tone="safe" onClick={() => actions.onKeepDuplicateColumn(conflict, conflict.columnIndex!)}>
              Gunakan kolom ini
            </ResolutionButton>
          ) : null}
          {duplicateOptionColumns[0] ? (
            <ResolutionButton tone="safe" onClick={() => actions.onKeepDuplicateColumn(conflict, duplicateOptionColumns[0].columnIndex)}>
              Gunakan kolom pertama
            </ResolutionButton>
          ) : null}
          {duplicateOptionColumns[1] ? (
            <ResolutionButton tone="safe" onClick={() => actions.onKeepDuplicateColumn(conflict, duplicateOptionColumns[1].columnIndex)}>
              Gunakan kolom kedua
            </ResolutionButton>
          ) : null}
        </div>
        {conflict.type === "structure" ? (
          <StructureResolutionControls conflict={conflict} mapping={columnMapping} context={context} actions={actions} />
        ) : null}
      </div>
    );
  }

  if (conflict.type === "overwrite") {
    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(Object.keys(updateModeLabels) as UpdateMode[]).map((mode) => (
          <ResolutionButton key={mode} tone={mode === "overwrite_existing" ? "warning" : "safe"} onClick={() => actions.onUpdateModeChange(mode)}>
            {updateModeLabels[mode]}
          </ResolutionButton>
        ))}
        <ResolutionButton onClick={() => actions.onResetConflictChoice(conflict)}>Ulangi pilihan ini</ResolutionButton>
      </div>
    );
  }

  if (conflict.severity === "blocked") {
    return (
      <div className="mt-3 space-y-2 rounded-2xl border border-red-100 bg-white/70 p-3 text-xs leading-5 dark:border-red-900/50 dark:bg-slate-950/40">
        <p>Item ini belum bisa dilanjutkan sampai file atau pencocokannya diperbaiki. Data ambigu tidak dipilih otomatis.</p>
        <ResolutionButton onClick={() => actions.onResetConflictChoice(conflict)}>Ulangi pilihan ini</ResolutionButton>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ResolutionButton onClick={() => actions.onResolveConflict(conflict)}>Tandai dicek</ResolutionButton>
      <ResolutionButton onClick={() => actions.onResetConflictChoice(conflict)}>Ulangi pilihan ini</ResolutionButton>
    </div>
  );
}

function ConflictStep({
  plan,
  context,
  actions,
  onBackToMapping,
}: {
  plan: ImportPlan | null;
  context: ImportPlanContext;
  actions: ConflictResolutionActions;
  onBackToMapping: () => void;
}) {
  if (!plan) {
    return <EmptyPanel title="Cek & Perbaiki belum tersedia" description="Item yang perlu dicek akan muncul setelah file dianalisis." />;
  }

  const grouped = plan.conflicts.reduce((acc, item) => {
    acc[item.type] = [...(acc[item.type] || []), item];
    return acc;
  }, {} as Record<ImportConflict["type"], ImportConflict[]>);
  const types = Object.keys(conflictTypeLabels) as ImportConflict["type"][];

  return (
    <div className="space-y-3">
      <section className="rounded-[24px] border border-border bg-white p-4 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Aksi cepat untuk Cek & Perbaiki</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Pilihan di sini hanya mengubah preview. Tidak ada nilai yang disimpan sebelum tahap import.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ResolutionButton onClick={onBackToMapping}>Kembali ke pencocokan</ResolutionButton>
            <ResolutionButton tone="warning" onClick={actions.onResetAllChoices}>Ulangi pilihan</ResolutionButton>
            <ResolutionButton onClick={actions.onBulkIgnoreDerived}>Abaikan kolom hasil rumus</ResolutionButton>
            <ResolutionButton tone="safe" onClick={actions.onBulkUseSafeMappings}>Terima pencocokan aman</ResolutionButton>
            <ResolutionButton tone="safe" onClick={actions.onBulkTrustStudentIdWarnings}>Gunakan data siswa dari kelas aktif</ResolutionButton>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Aturan saat nilai sudah ada</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(updateModeLabels) as UpdateMode[]).map((mode) => (
              <ResolutionButton
                key={mode}
                tone={plan.updateMode === mode ? "safe" : mode === "overwrite_existing" ? "warning" : "default"}
                onClick={() => actions.onUpdateModeChange(mode)}
              >
                {updateModeLabels[mode]}
              </ResolutionButton>
            ))}
          </div>
        </div>
      </section>

      {!plan.conflicts.length ? (
        <RiskAlert title="Tidak ada item wajib" tone="safe">
          Tidak ada item utama yang harus dipilih. Lanjutkan ke preview untuk melihat nilai yang akan diproses.
        </RiskAlert>
      ) : types.filter((type) => grouped[type]?.length).map((type) => (
        <section key={type} className="rounded-[24px] border border-border bg-white p-4 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">{conflictTypeLabels[type]}</h3>
            <StatusBadge tone="warning">{grouped[type].length} item</StatusBadge>
          </div>
          <div className="mt-3 space-y-2">
            {grouped[type].map((item, index) => {
              const notice = getImportNotice(item.code, item.message, item.type);
              return (
                <div key={`${item.code}-${index}`} className="rounded-2xl border border-red-100 bg-red-50/80 p-3 text-red-950 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-100">
                  <div className="flex min-w-0 items-start gap-2">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="max-w-full truncate text-sm font-semibold" title={notice.title}>
                          {notice.title}
                        </p>
                        <StatusBadge tone={item.severity === "blocked" ? "warning" : "info"}>
                          {conflictSeverityLabel(item.severity)}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-xs leading-5 opacity-85">
                        {notice.message}
                      </p>
                      <p className="mt-1 text-xs opacity-70">
                        {item.rowIndex ? `Baris ${item.rowIndex}` : ""} {item.columnIndex ? `Kolom ${item.columnIndex}` : ""}
                      </p>
                      <ConflictActionPanel conflict={item} plan={plan} context={context} actions={actions} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function SmartFixStep({
  plan,
  result,
  context,
  actions,
  onBackToMapping,
  onRestartUpload,
}: {
  plan: ImportPlan | null;
  result: ConflictSimplifierResult | null;
  context: ImportPlanContext;
  actions: ConflictResolutionActions;
  onBackToMapping: () => void;
  onRestartUpload: () => void;
}) {
  if (!plan || !result) {
    return <EmptyPanel title="Cek & Perbaiki belum tersedia" description="Bagian ini akan muncul setelah file dianalisis." />;
  }

  const conflictById = new Map(plan.conflicts.map((conflict) => [conflictKey(conflict), conflict]));
  const chapterById = new Map(context.chapters.map((chapter) => [chapter.id, chapter]));

  const applySafeFixes = () => {
    actions.onApplySafeFixes();
  };

  const reviewSuggestions = () => {
    document.getElementById("sipena-smart-fix-needs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const summaryAction = () => {
    if (result.manualRequiredCount > 0) {
      document.getElementById("sipena-smart-fix-manual")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (result.needsConfirmationCount > 0) {
      reviewSuggestions();
      return;
    }
    applySafeFixes();
  };

  const renderManualChoice = (item: ConflictSimplifierResult["groups"][number]["items"][number]) => {
    const conflict = item.sourceConflictIds.map((id) => conflictById.get(id)).find(Boolean);
    if (!conflict) return <SmartFixItemCard key={item.id} item={item} defaultOpen={item.level === "manual_required"} />;

    const studentMapping = conflict.rowIndex ? plan.studentMappings.find((mapping) => mapping.rowIndex === conflict.rowIndex) : undefined;
    const columnMapping = conflict.columnIndex ? plan.columnMappings.find((mapping) => mapping.columnIndex === conflict.columnIndex) : undefined;
    const duplicateOptionColumns = conflict.code === "IMPORT_DUPLICATE_COLUMN_TARGET"
      ? (conflict.options || [])
          .map((header) => plan.columnMappings.find((mapping) => mapping.rawHeader === header))
          .filter(Boolean) as ColumnMapping[]
      : [];

    if (item.level !== "manual_required") {
      return <SmartFixItemCard key={item.id} item={item} defaultOpen={false} />;
    }

    if (conflict.type === "student" && conflict.rowIndex) {
      return (
        <ManualChoiceCard
          key={item.id}
          title="Pilih siswa yang benar"
          body="Nama dari Excel cocok dengan beberapa siswa. SIPENA tidak memilih otomatis agar nilai tidak masuk ke siswa yang salah."
          fields={[
            { label: "Excel", value: studentMapping?.excelName || `Baris ${conflict.rowIndex}` },
            { label: "NISN Excel", value: studentMapping?.excelNisn || "-" },
          ]}
        >
          {studentMapping?.studentId ? (
            <ResolutionButton tone="safe" onClick={() => actions.onUseCurrentStudent(conflict.rowIndex!, studentMapping.studentId!)}>
              Gunakan kandidat SIPENA
            </ResolutionButton>
          ) : null}
          {context.students.slice(0, 8).map((student) => (
            <ResolutionButton key={student.id} onClick={() => actions.onChooseStudent(conflict.rowIndex!, student.id)}>
              Gunakan {student.name}
            </ResolutionButton>
          ))}
          <ResolutionButton onClick={() => actions.onIgnoreRow(conflict.rowIndex!)}>Abaikan baris</ResolutionButton>
        </ManualChoiceCard>
      );
    }

    if (conflict.type === "context") {
      return (
        <ManualChoiceCard
          key={item.id}
          title="File berbeda kelas/mapel/semester"
          body="File ini dibuat untuk kelas, mapel, semester, atau tahun ajaran lain. Import diblokir agar nilai tidak masuk ke konteks yang salah."
          fields={[
            { label: "Masalah", value: getImportNotice(conflict.code, conflict.message, conflict.type).message },
          ]}
        >
          <ResolutionButton onClick={onRestartUpload}>Batalkan dan upload template baru</ResolutionButton>
        </ManualChoiceCard>
      );
    }

    if (conflict.type === "grade_value") {
      return (
        <ManualChoiceCard
          key={item.id}
          title="Nilai tidak valid"
          body="SIPENA tidak bisa membaca nilai ini sebagai angka 0-100."
          fields={[
            { label: "Baris", value: String(conflict.rowIndex || "-") },
            { label: "Kolom", value: columnMapping?.rawHeader || String(conflict.columnIndex || "-") },
          ]}
        >
          {conflict.rowIndex ? <ResolutionButton onClick={() => actions.onIgnoreRow(conflict.rowIndex!)}>Abaikan nilai ini</ResolutionButton> : null}
          {conflict.columnIndex ? <ResolutionButton onClick={() => actions.onIgnoreColumn(conflict.columnIndex!)}>Abaikan seluruh kolom ini</ResolutionButton> : null}
          <ResolutionButton tone="warning" onClick={() => actions.onResetConflictChoice(conflict)}>Edit di Excel lalu upload ulang</ResolutionButton>
        </ManualChoiceCard>
      );
    }

    if (conflict.code === "IMPORT_DUPLICATE_COLUMN_TARGET") {
      return (
        <ManualChoiceCard
          key={item.id}
          title="Ada 2 kolom menuju tugas yang sama"
          body="Pilih kolom mana yang dipakai agar nilai tidak dobel."
          fields={[
            { label: "Kolom Excel", value: conflict.options?.join(" / ") || columnMapping?.rawHeader || "-" },
          ]}
        >
          {duplicateOptionColumns[0] ? (
            <ResolutionButton tone="safe" onClick={() => actions.onKeepDuplicateColumn(conflict, duplicateOptionColumns[0].columnIndex)}>
              Gunakan kolom pertama
            </ResolutionButton>
          ) : null}
          {duplicateOptionColumns[1] ? (
            <ResolutionButton tone="safe" onClick={() => actions.onKeepDuplicateColumn(conflict, duplicateOptionColumns[1].columnIndex)}>
              Gunakan kolom kedua
            </ResolutionButton>
          ) : null}
          {conflict.columnIndex ? <ResolutionButton onClick={() => actions.onIgnoreColumn(conflict.columnIndex!)}>Abaikan salah satu</ResolutionButton> : null}
        </ManualChoiceCard>
      );
    }

    if ((conflict.type === "column" || conflict.type === "structure") && conflict.columnIndex) {
      const assignmentName = columnMapping?.target?.assignmentName || columnMapping?.target?.sourceAssignmentName || columnMapping?.rawHeader || "Tugas";
      return (
        <ManualChoiceCard
          key={item.id}
          title={conflict.code.includes("WITHOUT_CHAPTER") ? "Tugas ini perlu BAB" : "Pilih target kolom nilai"}
          body={conflict.code.includes("WITHOUT_CHAPTER")
            ? "Kolom Excel hanya menyebut nama tugas. Pilih BAB yang benar sebelum import."
            : "Target kolom nilai belum cukup aman untuk dipilih otomatis."}
          fields={[
            { label: "Kolom Excel", value: columnMapping?.rawHeader || String(conflict.columnIndex) },
          ]}
        >
          {context.chapters.map((chapter) => (
            <ResolutionButton
              key={chapter.id}
              tone="safe"
              onClick={() => actions.onConfirmCreateAssignment(conflict.columnIndex!, chapter.id, assignmentName)}
            >
              Pakai {chapter.name}
            </ResolutionButton>
          ))}
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) actions.onUseExistingAssignment(conflict.columnIndex!, event.target.value);
            }}
            className="min-h-11 max-w-full rounded-full border border-border bg-white px-3 text-sm dark:bg-slate-950"
          >
            <option value="">Gunakan tugas yang sudah ada</option>
            {context.assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {[chapterById.get(assignment.chapter_id)?.name, assignment.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
          <ResolutionButton tone="safe" onClick={() => actions.onSetSpecialColumn(conflict.columnIndex!, "sts")}>Jadikan STS</ResolutionButton>
          <ResolutionButton tone="safe" onClick={() => actions.onSetSpecialColumn(conflict.columnIndex!, "sas")}>Jadikan SAS</ResolutionButton>
          <ResolutionButton onClick={() => actions.onIgnoreColumn(conflict.columnIndex!)}>Abaikan kolom</ResolutionButton>
        </ManualChoiceCard>
      );
    }

    return (
      <SmartFixItemCard key={item.id} item={item} defaultOpen>
        <ConflictActionPanel conflict={conflict} plan={plan} context={context} actions={actions} />
      </SmartFixItemCard>
    );
  };

  return (
    <div className="space-y-4">
      <SmartFixSummary result={result} onPrimaryAction={summaryAction} />

      <section className="rounded-[24px] border border-border bg-white p-4 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Aksi cepat aman</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Pilihan di sini hanya mengubah preview. Tidak ada nilai yang disimpan sebelum tahap import.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <ResolutionButton onClick={onBackToMapping}>Kembali ke pencocokan</ResolutionButton>
            <ResolutionButton tone="safe" onClick={applySafeFixes}>Pakai perbaikan aman</ResolutionButton>
            <ResolutionButton tone="warning" onClick={reviewSuggestions}>Tinjau item perlu dicek</ResolutionButton>
            <ResolutionButton onClick={actions.onBulkIgnoreDerived}>Abaikan Kolom yang Bukan Nilai</ResolutionButton>
            <ResolutionButton tone="safe" onClick={actions.onBulkTrustStudentIdWarnings}>Gunakan data siswa yang cocok dari kelas aktif</ResolutionButton>
            <ResolutionButton tone="safe" onClick={() => actions.onUpdateModeChange("fill_empty_only")}>Isi Nilai Kosong Saja</ResolutionButton>
            <ResolutionButton tone="warning" onClick={actions.onResetAllChoices}>Ulangi semua pilihan</ResolutionButton>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-3">
        {result.groups.map((group) => (
          <div
            key={group.id}
            id={group.level === "manual_required" ? "sipena-smart-fix-manual" : group.level === "needs_confirmation" ? "sipena-smart-fix-needs" : undefined}
            className="min-w-0 scroll-mt-4"
          >
            <SmartFixGroupCard
              group={group}
              defaultOpen={group.level === "manual_required" && group.itemCount > 0}
              onPrimaryAction={group.level === "auto_fixable" ? applySafeFixes : group.level === "needs_confirmation" ? reviewSuggestions : undefined}
              renderItem={renderManualChoice}
            />
          </div>
        ))}
      </div>

    </div>
  );
}

function previewColumnIndex(column: SpreadsheetPreviewColumn): number | null {
  if (!column.id.startsWith("excel-col-")) return null;
  const value = Number(column.id.replace("excel-col-", ""));
  return Number.isFinite(value) ? value : null;
}

function previewRowIndex(row: SpreadsheetPreviewRow): number {
  return row.rowIndex;
}

function previewCellPosition(cell: SpreadsheetPreviewCell): { rowIndex: number; columnIndex: number } | null {
  const rowIndex = Number(cell.rowId.replace("row-", ""));
  const columnIndex = Number(cell.columnId.replace("excel-col-", ""));
  if (!Number.isFinite(rowIndex) || !Number.isFinite(columnIndex)) return null;
  return { rowIndex, columnIndex };
}

function aiConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return "Sangat yakin";
  if (confidence >= 0.75) return "Cukup yakin";
  return "Perlu dicek";
}

function isGenericAiFallbackNote(note: string): boolean {
  return /AI (tidak tersedia|belum bisa membuat saran|tidak menemukan saran|tidak valid)/i.test(note);
}

function aiSuggestionKey(suggestion: SmartImportAssistSuggestion): string {
  return [
    suggestion.type,
    suggestion.rowIndex ?? "",
    suggestion.columnIndex ?? "",
    suggestion.targetType,
    suggestion.targetId ?? "",
    suggestion.suggestedValue ?? "",
    suggestion.suggestedAction,
  ].join("|");
}

function AiSuggestionPanel({
  aiState,
  canRequest,
  onRequest,
  plan,
  analysis,
  context,
  actions,
}: {
  aiState: AiAssistPanelState;
  canRequest: boolean;
  onRequest: () => void;
  plan: ImportPlan;
  analysis: ImportPlanInputAnalysis | null;
  context: ImportPlanContext;
  actions: ConflictResolutionActions;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const chapterById = new Map(context.chapters.map((chapter) => [chapter.id, chapter]));
  const assignmentById = new Map(context.assignments.map((assignment) => [assignment.id, assignment]));
  const studentById = new Map(context.students.map((student) => [student.id, student]));
  const tableById = new Map(buildCandidateTables(analysis).map((table) => [table.id, table]));
  const suggestions = (aiState.response?.suggestions || []).filter((suggestion) => !dismissed.has(aiSuggestionKey(suggestion)));
  const notes = aiState.response?.summary.notes || [];
  const visibleNotes = suggestions.length ? notes : notes.filter((note) => !isGenericAiFallbackNote(note));

  const dismissSuggestion = (suggestion: SmartImportAssistSuggestion) => {
    setDismissed((current) => new Set([...current, aiSuggestionKey(suggestion)]));
  };

  const applySuggestion = (suggestion: SmartImportAssistSuggestion) => {
    if (suggestion.type === "student" && suggestion.targetType === "student" && suggestion.targetId && suggestion.rowIndex) {
      if (!studentById.has(suggestion.targetId)) return;
      actions.onChooseStudent(suggestion.rowIndex, suggestion.targetId);
      dismissSuggestion(suggestion);
      return;
    }

    if ((suggestion.type === "column" || suggestion.type === "structure") && suggestion.columnIndex) {
      if (suggestion.targetType === "assignment" && suggestion.targetId && assignmentById.has(suggestion.targetId)) {
        actions.onUseExistingAssignment(suggestion.columnIndex, suggestion.targetId);
        dismissSuggestion(suggestion);
        return;
      }
      if (suggestion.targetType === "chapter" && suggestion.targetId && chapterById.has(suggestion.targetId)) {
        const mapping = plan.columnMappings.find((item) => item.columnIndex === suggestion.columnIndex);
        const assignmentName = mapping?.target?.assignmentName || mapping?.target?.sourceAssignmentName || mapping?.rawHeader || "Tugas";
        actions.onConfirmCreateAssignment(suggestion.columnIndex, suggestion.targetId, assignmentName);
        dismissSuggestion(suggestion);
        return;
      }
      if (suggestion.targetType === "ignore") {
        actions.onIgnoreColumn(suggestion.columnIndex);
        dismissSuggestion(suggestion);
      }
      return;
    }

    if (suggestion.type === "table" && suggestion.targetType === "table" && suggestion.targetId && tableById.has(suggestion.targetId)) {
      actions.onSelectRegion(suggestion.targetId);
      dismissSuggestion(suggestion);
      return;
    }

    if (suggestion.type === "value" && suggestion.targetType === "value" && suggestion.rowIndex && suggestion.columnIndex && typeof suggestion.suggestedValue === "number") {
      actions.onUseSuggestedValue(suggestion.rowIndex, suggestion.columnIndex, suggestion.suggestedValue);
      dismissSuggestion(suggestion);
      return;
    }

    if (suggestion.type === "value" && suggestion.targetType === "ignore" && suggestion.rowIndex && suggestion.columnIndex) {
      actions.onIgnoreCell(suggestion.rowIndex, suggestion.columnIndex);
      dismissSuggestion(suggestion);
    }
  };

  const renderTarget = (suggestion: SmartImportAssistSuggestion): string => {
    if (suggestion.targetType === "student" && suggestion.targetId) {
      const student = studentById.get(suggestion.targetId);
      return student ? `${student.name}${student.nisn ? ` (${student.nisn})` : ""}` : "Siswa tidak tersedia";
    }
    if (suggestion.targetType === "assignment" && suggestion.targetId) {
      const assignment = assignmentById.get(suggestion.targetId);
      if (!assignment) return "Tugas tidak tersedia";
      return [chapterById.get(assignment.chapter_id)?.name, assignment.name].filter(Boolean).join(" - ");
    }
    if (suggestion.targetType === "chapter" && suggestion.targetId) {
      return chapterById.get(suggestion.targetId)?.name || "BAB tidak tersedia";
    }
    if (suggestion.targetType === "table" && suggestion.targetId) {
      const table = tableById.get(suggestion.targetId);
      return table ? `${table.sheetName}, header baris ${table.headerRowIndex}` : "Tabel tidak tersedia";
    }
    if (suggestion.targetType === "value" && typeof suggestion.suggestedValue === "number") {
      const operation = plan.gradeOperations.find((item) => item.rowIndex === suggestion.rowIndex && item.columnIndex === suggestion.columnIndex);
      return `Nilai ${operation?.rawValue ?? "-"} -> ${suggestion.suggestedValue}`;
    }
    if (suggestion.targetType === "ignore") return "Abaikan";
    return "Perlu dicek manual";
  };

  const actionLabel = (suggestion: SmartImportAssistSuggestion): string => {
    if (suggestion.type === "student") return "Gunakan siswa ini";
    if (suggestion.type === "table") return "Gunakan tabel ini";
    if (suggestion.type === "value" && suggestion.targetType === "value") return "Gunakan nilai saran";
    if (suggestion.type === "value" && suggestion.targetType === "ignore") return "Abaikan sel";
    if (suggestion.targetType === "ignore") return "Abaikan kolom";
    if (suggestion.type === "structure") return "Buat tugas baru";
    return "Gunakan target ini";
  };

  return (
    <section className="rounded-[24px] border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-200">
            <Sparkles className="h-4 w-4 shrink-0" />
            <h3 className="text-sm font-semibold">Saran AI</h3>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Saran AI membantu menyelesaikan item yang belum jelas. Keputusan tetap bisa dicek dan tidak akan menyimpan nilai.
          </p>
        </div>
        <button
          type="button"
          disabled={!canRequest || aiState.status === "loading"}
          onClick={onRequest}
          className="min-h-11 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {aiState.status === "loading" ? "AI sedang memeriksa..." : "Minta Saran AI"}
        </button>
      </div>

      {aiState.status === "idle" ? (
        <p className="mt-3 rounded-2xl border border-blue-100 bg-white p-3 text-xs leading-5 text-muted-foreground dark:border-blue-900/50 dark:bg-slate-950">
          Minta Saran AI setelah pemeriksaan otomatis tersedia untuk membantu memberi keputusan aman.
        </p>
      ) : null}

      {aiState.status === "loading" ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-blue-100 bg-white p-3 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-slate-950 dark:text-blue-100">
          <Loader2 className="h-4 w-4 animate-spin" />
          AI sedang membantu memeriksa file...
        </div>
      ) : null}

      {aiState.status === "error" ? (
        <RiskAlert title="AI tidak tersedia" tone="warning">
          AI tidak tersedia. Anda tetap bisa lanjut dengan pemeriksaan manual.
        </RiskAlert>
      ) : null}

      {aiState.status === "success" ? (
        <div className="mt-3 space-y-3">
          {suggestions.length ? suggestions.map((suggestion) => (
            <article key={aiSuggestionKey(suggestion)} className="rounded-2xl border border-border bg-white p-3 dark:bg-slate-950">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={suggestion.confidence >= 0.9 ? "success" : suggestion.confidence >= 0.75 ? "warning" : "danger"}>
                      {aiConfidenceLabel(suggestion.confidence)}
                    </StatusBadge>
                    <StatusBadge tone="warning">Saran ini tetap perlu dicek</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{suggestion.suggestedAction}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{suggestion.reason}</p>
                  <p className="mt-2 text-xs text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">AI menyarankan: </span>{renderTarget(suggestion)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:min-w-44">
                  <ResolutionButton tone="safe" onClick={() => applySuggestion(suggestion)}>{actionLabel(suggestion)}</ResolutionButton>
                  <ResolutionButton onClick={() => dismissSuggestion(suggestion)}>Abaikan saran</ResolutionButton>
                  <ResolutionButton onClick={() => document.getElementById("sipena-smart-fix-manual")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    Pilih manual
                  </ResolutionButton>
                </div>
              </div>
            </article>
          )) : (
            <p className="rounded-2xl border border-border bg-white p-3 text-xs leading-5 text-muted-foreground dark:bg-slate-950">
              AI belum bisa membuat saran otomatis untuk file ini. Lanjutkan dengan pemeriksaan manual.
            </p>
          )}
          {visibleNotes.length ? (
            <div className="rounded-2xl border border-blue-100 bg-white p-3 text-xs leading-5 text-muted-foreground dark:border-blue-900/50 dark:bg-slate-950">
              {visibleNotes.map((note, index) => <p key={`${note}-${index}`}>{note}</p>)}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function SpreadsheetPreviewStep({
  plan,
  model,
  actions,
  selectionState,
  importContext,
  aiAssistResponse,
  onOpenIssueStep,
}: {
  plan: ImportPlan | null;
  model: SpreadsheetPreviewModel | null;
  actions: ConflictResolutionActions;
  selectionState: ImportSelectionState;
  importContext: ImportPlanContext;
  aiAssistResponse?: SmartImportAssistResponse | null;
  onOpenIssueStep: () => void;
}) {
  if (!plan || !model) {
    return <EmptyPanel title="Verifikasi belum tersedia" description="Tabel verifikasi akan muncul setelah file dianalisis." />;
  }

  const approveColumn = (column: SpreadsheetPreviewColumn) => {
    const columnIndex = previewColumnIndex(column);
    if (!columnIndex) return;
    const mapping = plan.columnMappings.find((item) => item.columnIndex === columnIndex);
    if (!mapping?.target) return;

    if (mapping.target.gradeType === "sts") {
      actions.onSetSpecialColumn(columnIndex, "sts");
      return;
    }
    if (mapping.target.gradeType === "sas") {
      actions.onSetSpecialColumn(columnIndex, "sas");
      return;
    }
    if (mapping.target.assignmentId) {
      actions.onUseExistingAssignment(columnIndex, mapping.target.assignmentId);
      return;
    }
    if (mapping.target.chapterId && mapping.target.assignmentName) {
      actions.onConfirmCreateAssignment(columnIndex, mapping.target.chapterId, mapping.target.assignmentName);
      return;
    }
    if (mapping.target.chapterName && mapping.target.assignmentName) {
      actions.onConfirmCreateChapterAndAssignment(columnIndex, mapping.target.chapterName, mapping.target.assignmentName);
    }
  };

  return (
    <SmartSpreadsheetPreview
      model={model}
      selectionState={selectionState}
      students={importContext.students}
      assignments={importContext.assignments.map((assignment) => {
        const chapter = importContext.chapters.find((item) => item.id === assignment.chapter_id);
        return {
          id: assignment.id,
          label: [chapter?.name, assignment.name].filter(Boolean).join(" - ") || assignment.name,
          chapterId: assignment.chapter_id,
          chapterName: chapter?.name,
          assignmentName: assignment.name,
        };
      })}
      chapters={importContext.chapters.map((chapter) => ({ id: chapter.id, name: chapter.name }))}
      onApplySafeFixes={actions.onApplySafeFixes}
      onApproveSuggestions={actions.onApproveSipenaSuggestions}
      onApproveColumn={approveColumn}
      onIgnoreColumn={(column) => {
        const columnIndex = previewColumnIndex(column);
        if (columnIndex) actions.onIgnoreColumn(columnIndex);
      }}
      onIgnoreCell={(cell) => {
        const position = previewCellPosition(cell);
        if (position) actions.onIgnoreCell(position.rowIndex, position.columnIndex);
      }}
      onIgnoreRow={(row) => actions.onIgnoreRow(previewRowIndex(row))}
      onResetRowSelection={(row) => actions.onResetRowSelection(previewRowIndex(row))}
      onChooseStudent={(row, studentId) => actions.onChooseStudent(previewRowIndex(row), studentId)}
      onMarkRowUnresolved={(row) => actions.onMarkRowUnresolved(previewRowIndex(row))}
      onOpenIssueStep={onOpenIssueStep}
      onSetColumnInclude={actions.onSetColumnInclude}
      onSetColumnHeader={actions.onSetColumnHeader}
      onSetColumnTarget={actions.onSetColumnTarget}
      onSetColumnValueMode={actions.onSetColumnValueMode}
      onBulkColumnAction={actions.onBulkColumnAction}
      onResetColumnSelection={actions.onResetColumnSelection}
      onSetCellInclude={actions.onSetCellInclude}
      onSetCellValueMode={actions.onSetCellValueMode}
      onAcceptSuggestedValue={actions.onAcceptSuggestedValue}
      onResetCellSelection={actions.onResetCellSelection}
      aiAssist={aiAssistResponse}
    />
  );
}

function ImportIssueStep({
  plan,
  model,
  actions,
  selectionState,
  importContext,
  aiAssistResponse,
}: {
  plan: ImportPlan | null;
  model: SpreadsheetPreviewModel | null;
  actions: ConflictResolutionActions;
  selectionState: ImportSelectionState;
  importContext: ImportPlanContext;
  aiAssistResponse?: SmartImportAssistResponse | null;
}) {
  if (!plan || !model) {
    return <EmptyPanel title="Daftar Bermasalah belum tersedia" description="Daftar masalah akan muncul setelah file dianalisis." />;
  }

  const approveColumn = (column: SpreadsheetPreviewColumn) => {
    const columnIndex = previewColumnIndex(column);
    if (!columnIndex) return;
    const mapping = plan.columnMappings.find((item) => item.columnIndex === columnIndex);
    if (!mapping?.target) return;

    if (mapping.target.gradeType === "sts") {
      actions.onSetSpecialColumn(columnIndex, "sts");
      return;
    }
    if (mapping.target.gradeType === "sas") {
      actions.onSetSpecialColumn(columnIndex, "sas");
      return;
    }
    if (mapping.target.assignmentId) {
      actions.onUseExistingAssignment(columnIndex, mapping.target.assignmentId);
      return;
    }
    if (mapping.target.chapterId && mapping.target.assignmentName) {
      actions.onConfirmCreateAssignment(columnIndex, mapping.target.chapterId, mapping.target.assignmentName);
      return;
    }
    if (mapping.target.chapterName && mapping.target.assignmentName) {
      actions.onConfirmCreateChapterAndAssignment(columnIndex, mapping.target.chapterName, mapping.target.assignmentName);
    }
  };

  return (
    <ImportIssueResolutionStep
      model={model}
      selectionState={selectionState}
      students={importContext.students}
      onApplySafeFixes={actions.onApplySafeFixes}
      onApproveSuggestions={actions.onApproveSipenaSuggestions}
      onApproveColumn={approveColumn}
      onIgnoreColumn={(column) => {
        const columnIndex = previewColumnIndex(column);
        if (columnIndex) actions.onIgnoreColumn(columnIndex);
      }}
      onIgnoreCell={(cell) => {
        const position = previewCellPosition(cell);
        if (position) actions.onIgnoreCell(position.rowIndex, position.columnIndex);
      }}
      onIgnoreRow={(row) => actions.onIgnoreRow(previewRowIndex(row))}
      onResetRowSelection={(row) => actions.onResetRowSelection(previewRowIndex(row))}
      onChooseStudent={(row, studentId) => actions.onChooseStudent(previewRowIndex(row), studentId)}
      onMarkRowUnresolved={(row) => actions.onMarkRowUnresolved(previewRowIndex(row))}
      onSetColumnInclude={actions.onSetColumnInclude}
      onSetColumnHeader={actions.onSetColumnHeader}
      onSetColumnValueMode={actions.onSetColumnValueMode}
      onBulkColumnAction={actions.onBulkColumnAction}
      onResetColumnSelection={actions.onResetColumnSelection}
      onSetCellInclude={actions.onSetCellInclude}
      onSetCellValueMode={actions.onSetCellValueMode}
      onAcceptSuggestedValue={actions.onAcceptSuggestedValue}
      onResetCellSelection={actions.onResetCellSelection}
      aiAssist={aiAssistResponse}
    />
  );
}

function HeaderConfigurationWizardStep({
  plan,
  model,
  actions,
  selectionState,
  importContext,
  aiAssistResponse,
}: {
  plan: ImportPlan | null;
  model: SpreadsheetPreviewModel | null;
  actions: ConflictResolutionActions;
  selectionState: ImportSelectionState;
  importContext: ImportPlanContext;
  aiAssistResponse?: SmartImportAssistResponse | null;
}) {
  if (!plan || !model) {
    return <EmptyPanel title="Konfigurasi Header belum tersedia" description="Header kolom akan muncul setelah file dianalisis." />;
  }

  const approveColumn = (column: SpreadsheetPreviewColumn) => {
    const columnIndex = previewColumnIndex(column);
    if (!columnIndex) return;
    const mapping = plan.columnMappings.find((item) => item.columnIndex === columnIndex);
    if (!mapping?.target) return;

    if (mapping.target.gradeType === "sts") {
      actions.onSetSpecialColumn(columnIndex, "sts");
      return;
    }
    if (mapping.target.gradeType === "sas") {
      actions.onSetSpecialColumn(columnIndex, "sas");
      return;
    }
    if (mapping.target.assignmentId) {
      actions.onUseExistingAssignment(columnIndex, mapping.target.assignmentId);
      return;
    }
    if (mapping.target.chapterId && mapping.target.assignmentName) {
      actions.onConfirmCreateAssignment(columnIndex, mapping.target.chapterId, mapping.target.assignmentName);
      return;
    }
    if (mapping.target.chapterName && mapping.target.assignmentName) {
      actions.onConfirmCreateChapterAndAssignment(columnIndex, mapping.target.chapterName, mapping.target.assignmentName);
    }
  };

  return (
    <HeaderConfigurationStep
      model={model}
      selectionState={selectionState}
      assignments={importContext.assignments.map((assignment) => {
        const chapter = importContext.chapters.find((item) => item.id === assignment.chapter_id);
        return {
          id: assignment.id,
          label: [chapter?.name, assignment.name].filter(Boolean).join(" - ") || assignment.name,
          chapterId: assignment.chapter_id,
          chapterName: chapter?.name,
          assignmentName: assignment.name,
        };
      })}
      chapters={importContext.chapters.map((chapter) => ({ id: chapter.id, name: chapter.name }))}
      aiAssist={aiAssistResponse}
      onApproveColumn={approveColumn}
      onIgnoreColumn={(column) => {
        const columnIndex = previewColumnIndex(column);
        if (columnIndex) actions.onIgnoreColumn(columnIndex);
      }}
      onSetColumnTarget={actions.onSetColumnTarget}
      onSetColumnValueMode={actions.onSetColumnValueMode}
      onBulkColumnAction={actions.onBulkColumnAction}
      onResetColumnSelection={actions.onResetColumnSelection}
    />
  );
}

function reviewDecisionValueLabel(decision: FinalReviewModel["sections"][number]["decisions"][number]) {
  const existing = decision.operation?.existingValue;
  const next = decision.value ?? decision.suggestedValue;
  if (decision.action === "skip") return "Tidak disimpan";
  if (existing !== null && existing !== undefined) return `${existing} -> ${next ?? "-"}`;
  if (decision.rawValue !== null && decision.rawValue !== undefined && decision.rawValue !== "") return `${decision.rawValue} -> ${next ?? "-"}`;
  return next ?? "-";
}

function reviewDecisionRawLabel(decision: FinalReviewModel["sections"][number]["decisions"][number]) {
  if (decision.rawValue !== null && decision.rawValue !== undefined && decision.rawValue !== "") return String(decision.rawValue);
  if (decision.operation?.value !== null && decision.operation?.value !== undefined) return String(decision.operation.value);
  return "-";
}

function reviewDecisionSourceLabel(decision: FinalReviewModel["sections"][number]["decisions"][number]) {
  const position = [
    decision.rowIndex ? `Baris ${decision.rowIndex}` : null,
    decision.columnIndex ? `Kolom ${decision.columnIndex}` : null,
  ].filter(Boolean).join(", ");
  return position || decision.sourceLabel || "-";
}

function reviewDecisionSectionLabel(sectionId: FinalReviewModel["sections"][number]["id"]) {
  if (sectionId === "changes") return "Akan diubah";
  if (sectionId === "attention") return "Perlu perhatian";
  return "Dilewati";
}

function reviewDecisionApprovalLabel(decision: FinalReviewModel["sections"][number]["decisions"][number]) {
  if (decision.approvedBy === "ai") return "Saran AI";
  if (decision.approvedBy === "user") return "Pilihan user";
  if (decision.approvedBy === "system") return "Pemeriksaan otomatis";
  return "Belum dipilih";
}

function finalResultCellValue(cell: SpreadsheetPreviewCell, column: SpreadsheetPreviewColumn): string {
  if (column.type === "identity") return cell.displayValue || "-";
  if (cell.effectiveInclude === false || cell.isAutoSkippedSameValue || cell.isManuallySkipped) {
    return String(cell.oldValue ?? cell.displayValue ?? "-");
  }
  return String(cell.resolvedValue ?? cell.newValue ?? cell.suggestedValue ?? cell.oldValue ?? "-");
}

function finalReviewOperationKey(rowId: string, columnId: string) {
  return `${rowId}:${columnId}`;
}

function FinalReviewResultTable({
  model,
  executablePlan,
  hasBlockingIssues,
}: {
  model: SpreadsheetPreviewModel;
  executablePlan: ReturnType<typeof buildExecutableImportOperations> | null;
  hasBlockingIssues: boolean;
}) {
  const needsAttention = hasBlockingIssues ? model.summary.manualRequired + model.summary.invalidCells : 0;
  const executableOperations = executablePlan?.operations || [];
  const executableRowIds = new Set(executableOperations.map((operation) => `row-${operation.rowIndex}`));
  const executableColumnIds = new Set(executableOperations.map((operation) => `excel-col-${operation.columnIndex}`));
  const executableValueKeys = new Set(executableOperations.map((operation) => (
    finalReviewOperationKey(`row-${operation.rowIndex}`, `excel-col-${operation.columnIndex}`)
  )));
  const visibleRows = model.rows.filter((row) => executableRowIds.has(row.id));
  const visibleColumns = model.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.type === "identity" ? visibleRows.length > 0 : executableColumnIds.has(column.id));
  const hasVisibleImportValues = visibleRows.length > 0 && visibleColumns.some(({ column }) => column.type !== "identity");

  return (
    <section className="rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Tabel akhir hasil</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Tampilan akhir setelah masalah dan header diselesaikan. Tabel ini hanya untuk review, tanpa pengeditan.
          </p>
        </div>
        <StatusBadge tone={needsAttention ? "warning" : "success"}>
          {needsAttention ? "Cek ulang" : "Siap import"}
        </StatusBadge>
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        {hasVisibleImportValues ? (
        <div className="max-h-[560px] overflow-auto">
          <table className="sipena-preview-table min-w-[980px]">
            <thead>
              <tr>
                {visibleColumns.map(({ column }) => (
                  <th key={column.id}>
                    <span className="block truncate">{column.header}</span>
                    {column.type !== "identity" ? (
                      <span className="sipena-preview-header-target">{column.targetLabel || column.sourceHeader || "Target tersimpan"}</span>
                    ) : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  {visibleColumns.map(({ column, index }) => {
                    const cell = row.cells[index];
                    const isImportValue = column.type !== "identity" && executableValueKeys.has(finalReviewOperationKey(row.id, column.id));
                    return (
                      <td key={cell.id} className="sipena-preview-cell">
                        {column.type === "identity" || isImportValue ? (
                          <span className="sipena-preview-cell-value">{finalResultCellValue(cell, column)}</span>
                        ) : (
                          <span className="sipena-final-result-empty" aria-label="Tidak disimpan">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="bg-slate-50 p-5 text-sm leading-6 text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
            Tidak ada nilai baru atau perubahan yang akan disimpan. Baris, kolom, dan nilai yang dilewati tidak ditampilkan di tabel akhir.
          </div>
        )}
      </div>
    </section>
  );
}

function FinalReviewDecisionSummary({
  review,
  onOpenVerificationStep,
}: {
  review: FinalReviewModel;
  onOpenVerificationStep: () => void;
}) {
  const decisionRows = review.sections.flatMap((section) => (
    section.decisions.map((decision) => ({ section, decision }))
  ));

  return (
    <details className="rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
      <summary className="flex cursor-pointer list-none flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Detail keputusan import</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Buka hanya jika ingin melihat alasan per nilai. Untuk mengubah nilai, kembali ke Verifikasi Tabel.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-10 rounded-full" onClick={onOpenVerificationStep}>
          Buka Verifikasi Tabel
        </Button>
      </summary>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border">
        {decisionRows.length ? (
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <tr>
                  <th className="border-b border-border px-3 py-3 font-semibold">Status</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Sumber Excel</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Target SIPENA</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Nilai Excel</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Nilai final</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Aksi</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Risiko</th>
                  <th className="border-b border-border px-3 py-3 font-semibold">Alasan</th>
                </tr>
              </thead>
              <tbody>
                {decisionRows.map(({ section, decision }) => (
                  <tr key={decision.id} className="bg-white align-top odd:bg-slate-50/60 dark:bg-slate-950 dark:odd:bg-slate-900/45">
                    <td className="border-b border-border px-3 py-3">
                      <StatusBadge tone={section.id === "attention" ? "warning" : section.id === "changes" ? "success" : "info"}>
                        {reviewDecisionSectionLabel(section.id)}
                      </StatusBadge>
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{reviewDecisionSourceLabel(decision)}</div>
                      <div className="mt-1 max-w-[180px] truncate text-muted-foreground" title={decision.sourceLabel}>{decision.sourceLabel}</div>
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      <div className="max-w-[210px] truncate font-semibold text-slate-900 dark:text-slate-100" title={decision.targetLabel}>
                        {decision.targetLabel || "-"}
                      </div>
                      <div className="mt-1 text-muted-foreground">{reviewDecisionApprovalLabel(decision)}</div>
                    </td>
                    <td className="border-b border-border px-3 py-3 font-semibold text-slate-700 dark:text-slate-200">
                      {reviewDecisionRawLabel(decision)}
                    </td>
                    <td className="border-b border-border px-3 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      {reviewDecisionValueLabel(decision)}
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      <StatusBadge tone={decisionActionTone(decision.action)}>{decisionActionLabel(decision.action)}</StatusBadge>
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      <StatusBadge tone={decisionRiskTone(decision.risk)}>{decisionRiskLabel(decision.risk)}</StatusBadge>
                    </td>
                    <td className="border-b border-border px-3 py-3">
                      <p className="max-w-[260px] text-xs leading-5 text-muted-foreground" title={cleanBackendText(decision.reason)}>
                        {cleanBackendText(decision.reason)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100">
            Tidak ada keputusan berisiko. Nilai yang siap disimpan sudah melewati pemeriksaan tabel.
          </div>
        )}
      </div>
    </details>
  );
}

function PreviewStep({
  plan,
  model,
  review,
  executablePlan,
  hasBlockingIssues,
  onOpenFixStep,
}: {
  plan: ImportPlan | null;
  model: SpreadsheetPreviewModel | null;
  review: FinalReviewModel | null;
  executablePlan: ReturnType<typeof buildExecutableImportOperations> | null;
  hasBlockingIssues: boolean;
  onOpenFixStep: () => void;
}) {
  if (!plan) {
    return <EmptyPanel title="Review belum tersedia" description="Ringkasan akhir akan muncul setelah file selesai dianalisis dan pencocokan aman." />;
  }

  const isBlocked = hasBlockingIssues && hasBlockedConflicts(plan);
  const reviewNeedsAttention = hasBlockingIssues && review
    ? review.summary.manualChoiceRequired + review.summary.blocked
    : 0;
  return (
    <div className="space-y-4">
      {review ? (
        <section className="rounded-[24px] border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-blue-950 dark:text-blue-100">Review akhir sebelum simpan</h3>
              <p className="mt-1 text-xs leading-5 text-blue-900/75 dark:text-blue-100/75">
                Review Akhir hanya menampilkan nilai yang akan disimpan. Ubah kolom dari Konfigurasi Header atau nilai dari Verifikasi Tabel.
              </p>
            </div>
            <StatusBadge tone={!reviewNeedsAttention ? "success" : "warning"}>
              {!reviewNeedsAttention ? "Siap simpan" : "Perlu dicek"}
            </StatusBadge>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Nilai baru" value={review.summary.save} tone="green" />
            <MetricCard label="Dikonversi" value={review.summary.convert} tone="blue" />
            <MetricCard label="Ditimpa" value={review.summary.overwrite} tone={review.summary.overwrite ? "orange" : "info"} />
            <MetricCard label="Perlu perhatian" value={reviewNeedsAttention} tone={reviewNeedsAttention ? "red" : "green"} />
          </div>
          {hasBlockingIssues && review.disabledReason ? (
            <p className="mt-3 text-xs leading-5 text-orange-700 dark:text-orange-200">{review.disabledReason}</p>
          ) : null}
        </section>
      ) : null}

      {review ? (
        model ? <FinalReviewResultTable model={model} executablePlan={executablePlan} hasBlockingIssues={hasBlockingIssues} /> : null
      ) : null}

      {review ? (
        <FinalReviewDecisionSummary review={review} onOpenVerificationStep={onOpenFixStep} />
      ) : null}

      {isBlocked ? (
        <RiskAlert title={getImportNotice("IMPORT_PLAN_BLOCKED").title} tone="blocked">
          Preview masih memiliki pilihan yang wajib diselesaikan. Tombol import tetap nonaktif sampai semua item selesai dicek.
        </RiskAlert>
      ) : null}
    </div>
  );
}

// This executor prepares UI-approved targets before handing batch persistence to
// the page callback. Database validation and rollback live in the batch save path.
async function executeClientSideImport({
  executablePlan,
  onSaveGrade,
  onSaveGradesBatch,
  onEnsureAssignmentTarget,
  onRollbackCreatedImportStructure,
  importContext,
  onProgress,
}: {
  executablePlan: ReturnType<typeof buildExecutableImportOperations>;
  onSaveGrade?: GradeImportExportDialogProps["onSaveGrade"];
  onSaveGradesBatch?: GradeImportExportDialogProps["onSaveGradesBatch"];
  onEnsureAssignmentTarget?: GradeImportExportDialogProps["onEnsureAssignmentTarget"];
  onRollbackCreatedImportStructure?: GradeImportExportDialogProps["onRollbackCreatedImportStructure"];
  importContext: ImportPlanContext;
  onProgress: (progress: ImportExecutionProgress) => void;
}): Promise<ImportExecutionSummary> {
  const summary = emptyExecutionSummary();
  const operations = executablePlan.operations;
  const warnings = new Set<string>();
  const ensuredAssignmentTargets = new Map<string, EnsuredImportTarget>();
  const createdAssignmentIds = new Set<string>();
  const createdChapterIds = new Set<string>();
  const batchItems: Parameters<NonNullable<GradeImportExportDialogProps["onSaveGradesBatch"]>>[0] = [];
  const batchOperations: GradeOperation[] = [];

  if (executablePlan.summary.blockedCount > 0 || executablePlan.summary.overwriteNeedsConfirmationCount > 0) {
    throw new Error("Import dibatalkan karena masih ada nilai yang perlu dicek atau konfirmasi timpa.");
  }

  summary.skippedCount = executablePlan.summary.totalOperations - executablePlan.summary.executableCount;
  if (executablePlan.summary.skippedManualCount > 0) warnings.add("Sebagian nilai dilewati sesuai pilihan manual.");
  if (executablePlan.summary.skippedExistingCount > 0) warnings.add("Sebagian nilai dilewati karena nilai lama sudah ada dan default aman aktif.");
  if (executablePlan.summary.skippedEmptyCount > 0) warnings.add("Sebagian sel kosong dilewati dan tidak menghapus nilai lama.");
  if (executablePlan.summary.blockedCount > 0) warnings.add("Sebagian nilai dilewati karena masih ada pilihan yang belum selesai dicek.");
  if (executablePlan.summary.overwriteNeedsConfirmationCount > 0) warnings.add("Sebagian nilai lama dilewati karena belum ada konfirmasi timpa.");

  if (!onSaveGrade && !onSaveGradesBatch) {
    return {
      ...summary,
      skippedCount: executablePlan.summary.totalOperations,
      warnings: ["Mekanisme simpan nilai belum tersedia di halaman ini."],
    };
  }

  onProgress({ current: summary.skippedCount, total: executablePlan.summary.totalOperations });

  for (const executableOperation of operations) {
    onProgress({ current: summary.successCount + summary.failedCount + summary.skippedCount, total: executablePlan.summary.totalOperations });
    const operation = executableOperation.operation;

    let operationTarget = executableOperation.target;
    if (operationTarget.gradeType === "assignment" && !operationTarget.assignmentId) {
      if (!onEnsureAssignmentTarget) {
        summary.skippedCount += 1;
        warnings.add("BAB atau tugas baru belum bisa dibuat otomatis di halaman ini.");
        continue;
      }

      const key = targetKey(operationTarget);
      try {
        if (!ensuredAssignmentTargets.has(key)) {
          ensuredAssignmentTargets.set(key, await onEnsureAssignmentTarget(operationTarget));
        }
        operationTarget = ensuredAssignmentTargets.get(key) || operationTarget;
        const ensuredTarget = ensuredAssignmentTargets.get(key);
        if (ensuredTarget?.createdAssignmentId) createdAssignmentIds.add(ensuredTarget.createdAssignmentId);
        if (ensuredTarget?.createdChapterId) createdChapterIds.add(ensuredTarget.createdChapterId);
      } catch (caught) {
        summary.failedCount += 1;
        summary.failedRows.push({
          operationId: operation.id,
          rowIndex: operation.rowIndex,
          columnIndex: operation.columnIndex,
          target: gradeTargetLabel(operationTarget),
          message: caught instanceof Error ? caught.message : "BAB atau tugas baru gagal dibuat.",
        });
        continue;
      }

      if (!operationTarget.assignmentId) {
        summary.skippedCount += 1;
        warnings.add("Tugas baru belum memiliki ID, sehingga nilainya dilewati.");
        continue;
      }
    }

    if (onSaveGradesBatch) {
      batchItems.push({
        studentId: executableOperation.studentId,
        gradeType: operationTarget.gradeType,
        value: executableOperation.value,
        assignmentId: operationTarget.gradeType === "assignment" ? operationTarget.assignmentId : undefined,
        academicYearId: importContext.academicYearId || null,
        semesterId: importContext.semesterId || null,
      });
      batchOperations.push({ ...operation, target: operationTarget });
    } else if (onSaveGrade) {
      try {
        await onSaveGrade(
          executableOperation.studentId,
          operationTarget.gradeType,
          executableOperation.value,
          operationTarget.gradeType === "assignment" ? operationTarget.assignmentId : undefined,
        );
        summary.successCount += 1;
      } catch (caught) {
        summary.failedCount += 1;
        summary.failedRows.push({
          operationId: operation.id,
          rowIndex: operation.rowIndex,
          columnIndex: operation.columnIndex,
          target: targetLabel(operation),
          message: caught instanceof Error ? cleanBackendText(caught.message) : "Gagal menyimpan nilai.",
        });
      }
    }
  }

  if (onSaveGradesBatch && batchItems.length > 0) {
    try {
      const result = await onSaveGradesBatch(batchItems);
      const batchResult = result || { savedCount: batchItems.length, skippedUnchangedCount: 0 };
      summary.successCount += batchResult.savedCount;
      summary.skippedCount += batchResult.skippedUnchangedCount || 0;
    } catch (caught) {
      if (onRollbackCreatedImportStructure && (createdAssignmentIds.size > 0 || createdChapterIds.size > 0)) {
        try {
          await onRollbackCreatedImportStructure({
            assignmentIds: Array.from(createdAssignmentIds),
            chapterIds: Array.from(createdChapterIds),
          });
          warnings.add("BAB/tugas baru yang dibuat selama import sudah dibatalkan karena nilai gagal disimpan.");
        } catch (rollbackError) {
          warnings.add(rollbackError instanceof Error
            ? `Rollback struktur import gagal: ${cleanBackendText(rollbackError.message)}`
            : "Rollback struktur import gagal. Periksa BAB/tugas baru sebelum mencoba lagi.");
        }
      }
      summary.failedCount += batchItems.length;
      batchOperations.slice(0, 20).forEach((operation) => {
        summary.failedRows.push({
          operationId: operation.id,
          rowIndex: operation.rowIndex,
          columnIndex: operation.columnIndex,
          target: targetLabel(operation),
          message: caught instanceof Error ? cleanBackendText(caught.message) : "Batch import gagal disimpan.",
        });
      });
      warnings.add("Import batch dibatalkan. Tidak ada nilai yang disimpan karena proses atomic gagal.");
    }
  }

  onProgress({ current: executablePlan.summary.totalOperations, total: executablePlan.summary.totalOperations });

  return {
    ...summary,
    warnings: Array.from(warnings),
  };
}

function ImportStep({
  state,
  plan,
  summary,
  progress,
  onDone,
  onBack,
  canUndoImport,
  canRedoImport,
  historyActionState,
  onUndoImport,
  onRedoImport,
}: {
  state: ImportExecutionState;
  plan: ImportPlan | null;
  summary: ImportExecutionSummary | null;
  progress: ImportExecutionProgress;
  onDone: () => void;
  onBack: () => void;
  canUndoImport: boolean;
  canRedoImport: boolean;
  historyActionState: ImportHistoryActionState;
  onUndoImport: () => void | Promise<void>;
  onRedoImport: () => void | Promise<void>;
}) {
  const blocked = hasBlockedConflicts(plan);
  const isSuccess = state === "success";
  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const hasFailures = Boolean(summary?.failedCount);
  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-border bg-white p-6 text-center dark:bg-slate-950">
      <div className={cn(
        "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
        hasFailures
          ? "bg-orange-50 text-orange-600 dark:bg-orange-950/30"
          : isSuccess
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
            : "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
      )}>
        {state === "importing" ? <Loader2 className="h-6 w-6 animate-spin" /> : hasFailures ? <ShieldAlert className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
        {isSuccess ? (hasFailures ? "Import selesai sebagian" : "Import aman selesai") : "Proses import aman siap"}
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {blocked
          ? "Masih ada pilihan yang wajib diselesaikan. Tahap ini tidak akan menyimpan data sebelum semua item selesai."
          : "SIPENA hanya memproses nilai yang sudah aman, memakai mekanisme simpan nilai yang ada, dan tidak menimpa nilai lama kecuali aturan import mengizinkan."}
      </p>
      {state === "importing" ? (
        <div className="mx-auto mt-5 max-w-md text-left">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Progres</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
      </div>

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Berhasil" value={summary.successCount} tone="green" />
            <MetricCard label="Dilewati" value={summary.skippedCount} tone="orange" />
            <MetricCard label="Gagal" value={summary.failedCount} tone={summary.failedCount ? "red" : "info"} />
          </div>

          {summary.warnings.length ? (
            <RiskAlert title="Catatan proses import" tone="warning">
              <ul className="space-y-1 text-left">
                {summary.warnings.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </RiskAlert>
          ) : null}

          {isSuccess ? (
            <section className="rounded-[24px] border border-blue-200 bg-blue-50 p-4 text-left dark:border-blue-900/60 dark:bg-blue-950/20">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-blue-950 dark:text-blue-100">Riwayat import tersedia</h4>
                  <p className="mt-1 text-xs leading-5 text-blue-800/80 dark:text-blue-100/75">
                    Jika hasil import belum sesuai, gunakan Undo untuk mengembalikan nilai terakhir. Redo dapat menerapkan kembali perubahan yang baru di-undo.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-full border-blue-200 bg-white text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-slate-950 dark:text-blue-100"
                    disabled={!canUndoImport || historyActionState !== "idle"}
                    onClick={onUndoImport}
                  >
                    {historyActionState === "undoing" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    Undo import terakhir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 rounded-full border-blue-200 bg-white text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-slate-950 dark:text-blue-100"
                    disabled={!canRedoImport || historyActionState !== "idle"}
                    onClick={onRedoImport}
                  >
                    {historyActionState === "redoing" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCw className="mr-2 h-4 w-4" />}
                    Redo import
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          {summary.failedRows.length ? (
            <section className="rounded-[24px] border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
              <h4 className="text-sm font-semibold text-red-950 dark:text-red-100">Baris gagal disimpan</h4>
              <div className="mt-3 grid gap-2">
                {summary.failedRows.slice(0, 10).map((item) => (
                  <div key={item.operationId} className="rounded-2xl border border-red-200 bg-white p-3 text-sm dark:border-red-900/50 dark:bg-slate-950">
                    <p className="font-medium text-slate-950 dark:text-slate-50">{item.target}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Baris {item.rowIndex} / Kolom {item.columnIndex} / {item.message}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {isSuccess ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-11 rounded-full" onClick={onBack}>
                Kembali
              </Button>
              <Button type="button" className="h-11 rounded-full bg-blue-600 hover:bg-blue-700" onClick={onDone}>
                Selesai
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function GradeImportExportDialog({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  classNameLabel,
  subjectName,
  semesterName,
  studentCount,
  chapterCount,
  assignmentCount,
  canDownloadOfficialTemplate = true,
  isDownloadingTemplate = false,
  onDownloadOfficialTemplate,
  isExportingCurrentGrades = false,
  isExportingBackup = false,
  onDownloadCurrentGrades,
  onDownloadBackup,
  onSaveGrade,
  onSaveGradesBatch,
  onEnsureAssignmentTarget,
  onRollbackCreatedImportStructure,
  onImportComplete,
  canUndoImport = false,
  canRedoImport = false,
  onUndoImport,
  onRedoImport,
  importContext,
}: GradeImportExportDialogProps) {
  const { info, success, error: showError, warning: showWarning } = useEnhancedToast();
  const [tab, setTab] = useState<GradeImportExportTab>(activeTab);
  const [exportMode, setExportMode] = useState<ExportMode>("official");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileMeta, setFileMeta] = useState<ImportFileMeta | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [analysis, setAnalysis] = useState<ImportPlanInputAnalysis | null>(null);
  const [basePlan, setBasePlan] = useState<ImportPlan | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [updateMode, setUpdateMode] = useState<UpdateMode>("fill_empty_only");
  const [resolverState, setResolverState] = useState<ImportResolverState>(emptyResolverState);
  const [selectionState, setSelectionState] = useState<ImportSelectionState>(emptyImportSelectionState);
  const [executionState, setExecutionState] = useState<ImportExecutionState>("idle");
  const [historyActionState, setHistoryActionState] = useState<ImportHistoryActionState>("idle");
  const [executionSummary, setExecutionSummary] = useState<ImportExecutionSummary | null>(null);
  const [executionProgress, setExecutionProgress] = useState<ImportExecutionProgress>({ current: 0, total: 0 });
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisErrorCode, setAnalysisErrorCode] = useState<ImportUiErrorCode | null>(null);
  const [aiAssist, setAiAssist] = useState<AiAssistPanelState>(emptyAiAssistPanelState);
  const [aiAssistCache, setAiAssistCache] = useState<Record<string, SmartImportAssistResponse>>({});
  const importBodyRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTab(activeTab);
  }, [activeTab, open]);

  useEffect(() => {
    if (!open || tab !== "import") return;
    window.requestAnimationFrame(() => {
      importBodyRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [open, stepIndex, tab]);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setFileName(null);
      setFileMeta(null);
      setAnalysis(null);
      setBasePlan(null);
      setPlan(null);
      setUpdateMode("fill_empty_only");
      setResolverState(emptyResolverState);
      setSelectionState(emptyImportSelectionState);
      setExecutionState("idle");
      setHistoryActionState("idle");
      setExecutionSummary(null);
      setExecutionProgress({ current: 0, total: 0 });
      setAnalysisError(null);
      setAnalysisErrorCode(null);
      setAiAssist(emptyAiAssistPanelState);
    }
  }, [open]);

  const effectiveUpdateMode = updateMode;
  const effectiveResolverState = resolverState;
  const effectiveSelectionState = selectionState;

  useEffect(() => {
    if (!analysis) return;
    const nextBasePlan = buildImportPlan(analysis, importContext, {
      updateMode: effectiveUpdateMode,
      selectedRegionId: isFreeExcelAnalysis(analysis) ? analysis.selectedRegionId : undefined,
    });
    setBasePlan(nextBasePlan);
    setPlan(applyResolverToPlan(nextBasePlan, effectiveResolverState, importContext, effectiveUpdateMode));
  }, [analysis, effectiveResolverState, effectiveUpdateMode, importContext]);

  const contextLabel = useMemo(() => (
    [classNameLabel, subjectName, semesterName || "Semester aktif"].filter(Boolean).join(" / ")
  ), [classNameLabel, semesterName, subjectName]);

  const selectImportRegion = useCallback((regionId: string) => {
    setAnalysis((current) => {
      if (!isFreeExcelAnalysis(current)) return current;
      const region = current.regions.find((item) => item.id === regionId);
      if (!region) return current;
      return {
        ...current,
        selectedRegionId: regionId,
      };
    });
    setResolverState(emptyResolverState);
    setSelectionState(emptyImportSelectionState);
    setAiAssist(emptyAiAssistPanelState);
    success("Tabel nilai dipilih", "Preview import diperbarui dari tabel yang Anda pilih.");
  }, [success]);

  const updateResolver = useCallback((updater: (current: ImportResolverState) => ImportResolverState) => {
    setResolverState((current) => updater(current));
  }, []);

  const resolverActions = useMemo<ConflictResolutionActions>(() => ({
    onUseCurrentStudent: (rowIndex, studentId) => updateResolver((current) => ({
      ...current,
      ignoredRows: current.ignoredRows.filter((item) => item !== rowIndex),
      unresolvedRows: current.unresolvedRows.filter((item) => item !== rowIndex),
      studentOverrides: { ...current.studentOverrides, [rowIndex]: studentId },
    })),
    onChooseStudent: (rowIndex, studentId) => updateResolver((current) => ({
      ...current,
      ignoredRows: current.ignoredRows.filter((item) => item !== rowIndex),
      unresolvedRows: current.unresolvedRows.filter((item) => item !== rowIndex),
      studentOverrides: { ...current.studentOverrides, [rowIndex]: studentId },
    })),
    onIgnoreRow: (rowIndex) => updateResolver((current) => {
      const { [rowIndex]: _removed, ...studentOverrides } = current.studentOverrides;
      return {
        ...current,
        ignoredRows: uniqueNumbersForState([...current.ignoredRows, rowIndex]),
        unresolvedRows: current.unresolvedRows.filter((item) => item !== rowIndex),
        studentOverrides,
      };
    }),
    onResetRowSelection: (rowIndex) => {
      updateResolver((current) => {
        const { [rowIndex]: _removed, ...studentOverrides } = current.studentOverrides;
        return {
          ...current,
          ignoredRows: current.ignoredRows.filter((item) => item !== rowIndex),
          unresolvedRows: current.unresolvedRows.filter((item) => item !== rowIndex),
          ignoredCells: current.ignoredCells.filter((item) => !item.startsWith(`${rowIndex}:`)),
          studentOverrides,
          resolvedConflictKeys: current.resolvedConflictKeys.filter((item) => !item.includes(`:${rowIndex}:`)),
        };
      });
      setSelectionState((current) => {
        const cellSettings = { ...current.cellSettings };
        Object.keys(cellSettings).forEach((cellId) => {
          if (cellSettings[cellId]?.rowId === `row-${rowIndex}`) delete cellSettings[cellId];
        });
        return { ...current, cellSettings };
      });
    },
    onMarkRowUnresolved: (rowIndex) => updateResolver((current) => {
      const { [rowIndex]: _removed, ...studentOverrides } = current.studentOverrides;
      return {
        ...current,
        ignoredRows: current.ignoredRows.filter((item) => item !== rowIndex),
        unresolvedRows: uniqueNumbersForState([...current.unresolvedRows, rowIndex]),
        studentOverrides,
      };
    }),
    onUseExistingAssignment: (columnIndex, assignmentId) => updateResolver((current) => ({
      ...current,
      ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
      columnOverrides: {
        ...current.columnOverrides,
        [columnIndex]: { kind: "existing_assignment", assignmentId },
      },
    })),
    onConfirmCreateAssignment: (columnIndex, chapterId, assignmentName) => updateResolver((current) => {
      const chapter = importContext.chapters.find((item) => item.id === chapterId);
      return {
        ...current,
        ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
        columnOverrides: {
          ...current.columnOverrides,
          [columnIndex]: {
            kind: "create_assignment",
            chapterId,
            chapterName: chapter?.name,
            assignmentName,
            confirmed: true,
          },
        },
      };
    }),
    onConfirmCreateChapterAndAssignment: (columnIndex, chapterName, assignmentName) => updateResolver((current) => ({
      ...current,
      ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
      columnOverrides: {
        ...current.columnOverrides,
        [columnIndex]: {
          kind: "create_chapter_and_assignment",
          chapterName,
          assignmentName,
          confirmed: true,
        },
      },
    })),
    onSetSpecialColumn: (columnIndex, kind) => updateResolver((current) => ({
      ...current,
      ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
      columnOverrides: {
        ...current.columnOverrides,
        [columnIndex]: { kind },
      },
    })),
    onIgnoreColumn: (columnIndex) => updateResolver((current) => ({
      ...current,
      ignoredColumns: uniqueNumbersForState([...current.ignoredColumns, columnIndex]),
      columnOverrides: Object.fromEntries(Object.entries(current.columnOverrides).filter(([key]) => Number(key) !== columnIndex)),
    })),
    onIgnoreCell: (rowIndex, columnIndex) => updateResolver((current) => ({
      ...current,
      ignoredCells: uniqueStrings([...current.ignoredCells, `${rowIndex}:${columnIndex}`]),
    })),
    onResolveConflict: (conflict) => updateResolver((current) => ({
      ...current,
      resolvedConflictKeys: uniqueStrings([...current.resolvedConflictKeys, conflictKey(conflict)]),
    })),
    onResetConflictChoice: (conflict) => updateResolver((current) => {
      const rowIndex = conflict.rowIndex;
      const columnIndex = conflict.columnIndex;
      const studentOverrides = rowIndex
        ? Object.fromEntries(Object.entries(current.studentOverrides).filter(([key]) => Number(key) !== rowIndex))
        : current.studentOverrides;
      const columnOverrides = columnIndex
        ? Object.fromEntries(Object.entries(current.columnOverrides).filter(([key]) => Number(key) !== columnIndex))
        : current.columnOverrides;
      return {
        ...current,
        ignoredRows: rowIndex ? current.ignoredRows.filter((item) => item !== rowIndex) : current.ignoredRows,
        unresolvedRows: rowIndex ? current.unresolvedRows.filter((item) => item !== rowIndex) : current.unresolvedRows,
        studentOverrides,
        ignoredColumns: columnIndex ? current.ignoredColumns.filter((item) => item !== columnIndex) : current.ignoredColumns,
        ignoredCells: rowIndex && columnIndex
          ? current.ignoredCells.filter((item) => item !== `${rowIndex}:${columnIndex}`)
          : current.ignoredCells,
        columnOverrides,
        resolvedConflictKeys: current.resolvedConflictKeys.filter((item) => item !== conflictKey(conflict)),
      };
    }),
    onKeepDuplicateColumn: (conflict, keepColumnIndex) => updateResolver((current) => {
      const optionHeaders = new Set(conflict.options || []);
      const duplicateColumns = (plan?.columnMappings || [])
        .filter((mapping) => optionHeaders.has(mapping.rawHeader) && mapping.columnIndex !== keepColumnIndex)
        .map((mapping) => mapping.columnIndex);
      return {
        ...current,
        ignoredColumns: uniqueNumbersForState([...current.ignoredColumns, ...duplicateColumns]),
        resolvedConflictKeys: uniqueStrings([
          ...current.resolvedConflictKeys,
          ...(plan?.conflicts || [])
            .filter((item) => item.code === "IMPORT_DUPLICATE_COLUMN_TARGET" && (item.options || []).join("|") === (conflict.options || []).join("|"))
            .map(conflictKey),
        ]),
      };
    }),
    onBulkIgnoreDerived: () => updateResolver((current) => ({
      ...current,
      ignoredColumns: uniqueNumbersForState([
        ...current.ignoredColumns,
        ...(plan?.columnMappings || [])
          .filter((mapping) => mapping.parsedHeader.derived || mapping.parsedHeader.reserved)
          .map((mapping) => mapping.columnIndex),
      ]),
    })),
    onBulkUseSafeMappings: () => updateResolver((current) => ({
      ...current,
      resolvedConflictKeys: uniqueStrings([
        ...current.resolvedConflictKeys,
        ...(plan?.conflicts || []).filter((item) => {
          if (!["student", "column", "structure"].includes(item.type)) return false;
          const student = item.rowIndex ? plan?.studentMappings.find((mapping) => mapping.rowIndex === item.rowIndex) : undefined;
          const column = item.columnIndex ? plan?.columnMappings.find((mapping) => mapping.columnIndex === item.columnIndex) : undefined;
          return Boolean(
            (student && student.status === "safe")
            || (column && (column.status === "safe" || column.parsedHeader.derived || column.parsedHeader.reserved)),
          );
        }).map(conflictKey),
      ]),
    })),
    onBulkTrustStudentIdWarnings: () => updateResolver((current) => ({
      ...current,
      studentOverrides: {
        ...current.studentOverrides,
        ...Object.fromEntries((plan?.studentMappings || [])
          .filter((mapping) => mapping.matchedBy === "student_id" && mapping.status === "warning" && mapping.studentId)
          .map((mapping) => [String(mapping.rowIndex), mapping.studentId as string])),
      },
    })),
    onApplySafeFixes: () => {
      setUpdateMode("fill_empty_only");
      updateResolver((current) => ({
        ...current,
        ignoredColumns: uniqueNumbersForState([
          ...current.ignoredColumns,
          ...(plan?.columnMappings || [])
            .filter((mapping) => mapping.parsedHeader.derived || mapping.parsedHeader.reserved)
            .map((mapping) => mapping.columnIndex),
        ]),
        ignoredRows: uniqueNumbersForState([
          ...current.ignoredRows,
          ...(plan?.studentMappings || [])
            .filter((mapping) => mapping.status === "missing_in_web" && Boolean(plan && !rowHasImportableValue(plan, mapping.rowIndex)))
            .map((mapping) => mapping.rowIndex),
        ]),
        resolvedConflictKeys: uniqueStrings([
          ...current.resolvedConflictKeys,
          ...(plan?.warnings || [])
            .filter((item) => [
              "GRADE_VALUE_DECIMAL_COMMA",
              "GRADE_VALUE_PERCENT",
              "GRADE_VALUE_FRACTION_100",
            ].includes(item.code))
            .map(simplifiedWarningKey),
          ...(plan?.conflicts || [])
            .filter((item) => {
              if (item.type === "column") {
                const column = item.columnIndex ? plan?.columnMappings.find((mapping) => mapping.columnIndex === item.columnIndex) : undefined;
                return Boolean(column?.parsedHeader.derived || column?.parsedHeader.reserved);
              }
              return false;
            })
            .map(conflictKey),
        ]),
      }));
    },
    onApproveSipenaSuggestions: () => updateResolver((current) => {
      const columnOverrides = { ...current.columnOverrides };
      const resolvedConflictKeys: string[] = [...current.resolvedConflictKeys];

      (plan?.columnMappings || []).forEach((mapping) => {
        const codes = new Set([
          ...mapping.warnings.map((warning) => warning.code),
          ...mapping.conflicts.map((conflict) => conflict.code),
        ]);
        const canUseExisting = mapping.target?.assignmentId
          && (codes.has("COLUMN_ASSIGNMENT_SIMILAR_MATCH")
            || codes.has("COLUMN_CHAPTER_SIMILAR_MATCH")
            || codes.has("COLUMN_METADATA_INVALID_HEADER_CLEAR")
            || codes.has("COLUMN_METADATA_VS_HEADER_CHANGED"));

        if (canUseExisting) {
          columnOverrides[String(mapping.columnIndex)] = {
            kind: "existing_assignment",
            assignmentId: mapping.target?.assignmentId,
          };
        }

        if (columnOverrides[String(mapping.columnIndex)]) {
          resolvedConflictKeys.push(
            ...(plan?.conflicts || [])
              .filter((conflict) => conflict.columnIndex === mapping.columnIndex && conflict.severity !== "blocked")
              .map(conflictKey),
          );
        }
      });

      resolvedConflictKeys.push(
        ...(plan?.warnings || [])
          .filter((warning) => [
            "COLUMN_ASSIGNMENT_SIMILAR_MATCH",
            "COLUMN_CHAPTER_SIMILAR_MATCH",
            "COLUMN_METADATA_INVALID_HEADER_CLEAR",
            "COLUMN_METADATA_VS_HEADER_CHANGED",
            "IMPORT_HEADER_CHANGED",
            "IMPORT_ADDED_HEADER_DETECTED",
            "IMPORT_UNSIGNED_TEMPLATE",
            "GRADE_VALUE_FRACTION_SCALED",
          ].includes(warning.code))
          .map(simplifiedWarningKey),
      );

      return {
        ...current,
        columnOverrides,
        resolvedConflictKeys: uniqueStrings(resolvedConflictKeys),
      };
    }),
    onResetAllChoices: () => {
      updateResolver(() => emptyResolverState);
      setSelectionState(emptyImportSelectionState);
    },
    onUpdateModeChange: (mode) => setUpdateMode(mode),
    onSelectRegion: selectImportRegion,
    onSetColumnInclude: (column, include) => {
      const columnIndex = previewColumnIndex(column);
      if (columnIndex) {
        updateResolver((current) => ({
          ...current,
          ignoredColumns: include
            ? current.ignoredColumns.filter((item) => item !== columnIndex)
            : uniqueNumbersForState([...current.ignoredColumns, columnIndex]),
        }));
      }
      setSelectionState((current) => ({
        ...current,
        columnSettings: {
          ...current.columnSettings,
          [column.id]: {
            ...(current.columnSettings[column.id] || defaultColumnImportSetting(column.id, columnIndex || undefined)),
            include,
            updatedAt: nowSelectionTimestamp(),
          },
        },
      }));
    },
    onSetColumnHeader: (column, header) => setSelectionState((current) => {
      const trimmedHeader = header.trim();
      const existing = current.columnSettings[column.id] || defaultColumnImportSetting(column.id, previewColumnIndex(column) || undefined);
      return {
        ...current,
        columnSettings: {
          ...current.columnSettings,
          [column.id]: {
            ...existing,
            include: existing.include ?? column.effectiveInclude !== false,
            headerOverride: trimmedHeader || column.sourceHeader || column.header,
            updatedAt: nowSelectionTimestamp(),
          },
        },
      };
    }),
    onSetColumnTarget: (column, target) => {
      const columnIndex = previewColumnIndex(column);
      if (!columnIndex) return;
      updateResolver((current) => {
        const columnOverrides = { ...current.columnOverrides };
        if (target.kind === "ignore") {
          delete columnOverrides[String(columnIndex)];
          return {
            ...current,
            ignoredColumns: uniqueNumbersForState([...current.ignoredColumns, columnIndex]),
            columnOverrides,
          };
        }

        columnOverrides[String(columnIndex)] = target.kind === "create_assignment"
          ? { ...target, confirmed: true }
          : target.kind === "create_chapter_and_assignment"
            ? { ...target, confirmed: true }
            : target;

        return {
          ...current,
          ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
          columnOverrides,
          resolvedConflictKeys: uniqueStrings([
            ...current.resolvedConflictKeys,
            ...(plan?.conflicts || [])
              .filter((conflict) => conflict.columnIndex === columnIndex)
              .map(conflictKey),
          ]),
        };
      });
    },
    onSetColumnValueMode: (column, mode, overwriteConfirmed = false) => setSelectionState((current) => ({
      ...current,
      columnSettings: {
        ...current.columnSettings,
        [column.id]: {
          ...(current.columnSettings[column.id] || defaultColumnImportSetting(column.id, previewColumnIndex(column) || undefined)),
          include: current.columnSettings[column.id]?.include ?? column.effectiveInclude !== false,
          valueMode: mode,
          overwriteConfirmed,
          updatedAt: nowSelectionTimestamp(),
        },
      },
    })),
    onBulkColumnAction: (column, action) => {
      const columnIndex = previewColumnIndex(column) || undefined;
      if (columnIndex) {
        updateResolver((current) => ({
          ...current,
          ignoredColumns: action === "skip_all"
            ? uniqueNumbersForState([...current.ignoredColumns, columnIndex])
            : current.ignoredColumns.filter((item) => item !== columnIndex),
          columnOverrides: action === "reset"
            ? Object.fromEntries(Object.entries(current.columnOverrides).filter(([key]) => Number(key) !== columnIndex))
            : current.columnOverrides,
          ignoredCells: action === "reset"
            ? current.ignoredCells.filter((item) => !item.endsWith(`:${columnIndex}`))
            : current.ignoredCells,
        }));
      }
      setSelectionState((current) => {
        const nextColumnSettings = { ...current.columnSettings };
        const nextCellSettings = { ...current.cellSettings };
        if (action === "reset") {
          delete nextColumnSettings[column.id];
          Object.keys(nextCellSettings).forEach((cellId) => {
            if (nextCellSettings[cellId]?.columnId === column.id) delete nextCellSettings[cellId];
          });
          return { columnSettings: nextColumnSettings, cellSettings: nextCellSettings };
        }
        nextColumnSettings[column.id] = {
          ...(nextColumnSettings[column.id] || defaultColumnImportSetting(column.id, columnIndex)),
          include: action !== "skip_all",
          valueMode: action === "skip_existing" ? "skip_existing" : nextColumnSettings[column.id]?.valueMode || "fill_empty_only",
          overwriteConfirmed: action === "skip_all" ? false : nextColumnSettings[column.id]?.overwriteConfirmed,
          updatedAt: nowSelectionTimestamp(),
        };
        return { columnSettings: nextColumnSettings, cellSettings: nextCellSettings };
      });
    },
    onResetColumnSelection: (column) => {
      const columnIndex = previewColumnIndex(column);
      if (columnIndex) {
        updateResolver((current) => ({
          ...current,
          ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
          ignoredCells: current.ignoredCells.filter((item) => !item.endsWith(`:${columnIndex}`)),
          columnOverrides: Object.fromEntries(Object.entries(current.columnOverrides).filter(([key]) => Number(key) !== columnIndex)),
        }));
      }
      setSelectionState((current) => {
        const columnSettings = { ...current.columnSettings };
        const cellSettings = { ...current.cellSettings };
        delete columnSettings[column.id];
        Object.keys(cellSettings).forEach((cellId) => {
          if (cellSettings[cellId]?.columnId === column.id) delete cellSettings[cellId];
        });
        return { columnSettings, cellSettings };
      });
    },
    onSetCellInclude: (cell, row, column, include) => {
      const position = previewCellPosition(cell);
      if (position) {
        updateResolver((current) => ({
          ...current,
          ignoredCells: include
            ? current.ignoredCells.filter((item) => item !== `${position.rowIndex}:${position.columnIndex}`)
            : uniqueStrings([...current.ignoredCells, `${position.rowIndex}:${position.columnIndex}`]),
        }));
      }
      setSelectionState((current) => ({
        ...current,
        cellSettings: {
          ...current.cellSettings,
          [cell.id]: {
            ...(current.cellSettings[cell.id] || defaultCellImportSetting(cell.id, row.id, column.id, row.studentId)),
            include,
            overwriteConfirmed: include ? current.cellSettings[cell.id]?.overwriteConfirmed : false,
            acceptedSuggestedValue: include ? current.cellSettings[cell.id]?.acceptedSuggestedValue : false,
            resolvedValue: include ? current.cellSettings[cell.id]?.resolvedValue : null,
            updatedAt: nowSelectionTimestamp(),
          },
        },
      }));
    },
    onSetCellValueMode: (cell, row, column, mode, overwriteConfirmed = false) => setSelectionState((current) => ({
      ...current,
      cellSettings: {
        ...current.cellSettings,
        [cell.id]: {
          ...(current.cellSettings[cell.id] || defaultCellImportSetting(cell.id, row.id, column.id, row.studentId)),
          include: current.cellSettings[cell.id]?.include ?? true,
          valueMode: mode,
          overwriteConfirmed,
          updatedAt: nowSelectionTimestamp(),
        },
      },
    })),
    onAcceptSuggestedValue: (cell, row, column) => {
      if (typeof cell.suggestedValue !== "number" || !Number.isFinite(cell.suggestedValue) || cell.suggestedValue < 0 || cell.suggestedValue > 100) {
        return;
      }
      const position = previewCellPosition(cell);
      if (position) {
        updateResolver((current) => ({
          ...current,
          ignoredCells: current.ignoredCells.filter((item) => item !== `${position.rowIndex}:${position.columnIndex}`),
        }));
      }
      setSelectionState((current) => ({
        ...current,
        cellSettings: {
          ...current.cellSettings,
          [cell.id]: {
            ...(current.cellSettings[cell.id] || defaultCellImportSetting(cell.id, row.id, column.id, row.studentId)),
            include: true,
            acceptedSuggestedValue: true,
            resolvedValue: cell.suggestedValue,
            reason: `Pakai nilai saran ${cell.suggestedValue}`,
            updatedAt: nowSelectionTimestamp(),
          },
        },
      }));
    },
    onUseSuggestedValue: (rowIndex, columnIndex, value) => {
      if (!Number.isFinite(value) || value < 0 || value > 100) return;
      const rowId = `row-${rowIndex}`;
      const columnId = `excel-col-${columnIndex}`;
      const cellId = `${rowId}:${columnId}`;
      const studentId = plan?.studentMappings.find((mapping) => mapping.rowIndex === rowIndex)?.studentId;
      updateResolver((current) => ({
        ...current,
        ignoredCells: current.ignoredCells.filter((item) => item !== `${rowIndex}:${columnIndex}`),
      }));
      setSelectionState((current) => ({
        ...current,
        cellSettings: {
          ...current.cellSettings,
          [cellId]: {
            ...(current.cellSettings[cellId] || defaultCellImportSetting(cellId, rowId, columnId, studentId)),
            include: true,
            acceptedSuggestedValue: true,
            resolvedValue: value,
            reason: `Pakai nilai saran AI ${value}`,
            updatedAt: nowSelectionTimestamp(),
          },
        },
      }));
    },
    onResetCellSelection: (cell) => {
      const position = previewCellPosition(cell);
      if (position) {
        updateResolver((current) => ({
          ...current,
          ignoredCells: current.ignoredCells.filter((item) => item !== `${position.rowIndex}:${position.columnIndex}`),
        }));
      }
      setSelectionState((current) => {
        const cellSettings = { ...current.cellSettings };
        delete cellSettings[cell.id];
        return { ...current, cellSettings };
      });
    },
  }), [importContext.chapters, plan, selectImportRegion, updateResolver]);

  const hasPlan = Boolean(plan || basePlan);
  const blocked = hasBlockedConflicts(plan);
  const unsupported = plan?.sourceType === "unsupported"
    || (plan?.sourceType === "free_unstructured" && plan.gradeOperations.length === 0);
  const regionSelectionPending = isRegionSelectionPending(analysis);
  const smartFixResult = useMemo(() => (
    plan ? simplifyImportConflicts({ plan, resolverState: effectiveResolverState, updateMode: effectiveUpdateMode }) : null
  ), [effectiveResolverState, effectiveUpdateMode, plan]);
  const spreadsheetPreview = useMemo<SpreadsheetPreviewModel | null>(() => (
    plan ? buildSpreadsheetPreviewModel({ plan, resolverState: effectiveResolverState, updateMode: effectiveUpdateMode, selectionState: effectiveSelectionState }) : null
  ), [effectiveResolverState, effectiveSelectionState, effectiveUpdateMode, plan]);
  const activeImportIssues = useMemo(() => getActiveImportIssues(spreadsheetPreview), [spreadsheetPreview]);
  const activeImportIssueCount = activeImportIssues.length;
  const activeHeaderIssues = useMemo(
    () => getActiveHeaderConfigurationIssues(spreadsheetPreview, effectiveSelectionState),
    [effectiveSelectionState, spreadsheetPreview],
  );
  const activeHeaderIssueCount = activeHeaderIssues.length;
  const workflowIssuesResolved = activeImportIssueCount === 0 && activeHeaderIssueCount === 0;
  const executableImportPlan = useMemo(() => (
    plan ? buildExecutableImportOperations({ plan, resolverState: effectiveResolverState, selectionState: effectiveSelectionState, updateMode: effectiveUpdateMode }) : null
  ), [effectiveResolverState, effectiveSelectionState, effectiveUpdateMode, plan]);
  const importDecisionGraph = useMemo<ImportDecisionGraph | null>(() => {
    if (!plan || !executableImportPlan) return null;
    const graph = buildImportDecisionGraph(plan, executableImportPlan);
    if (aiAssist.response && aiAssist.status === "success") {
      return resolveImportDecisionGraphWithAi(graph, aiAssist.response, { mode: "fast" });
    }
    return graph;
  }, [aiAssist.response, aiAssist.status, executableImportPlan, plan]);
  const finalReviewModel = useMemo(() => (
    importDecisionGraph ? buildFinalReviewModel(importDecisionGraph) : null
  ), [importDecisionGraph]);
  const aiAssistCacheKey = useMemo(() => (
    smartImportAssistCacheKey(fileMeta, plan, analysis)
  ), [analysis, fileMeta, plan]);
  const hasAiAssistableItems = Boolean(
    plan
    && plan.sourceType !== "official_exact"
    && !unsupported
    && !regionSelectionPending
    && (
      (smartFixResult?.manualRequiredCount || 0) > 0
      || (smartFixResult?.needsConfirmationCount || 0) > 0
      || plan.conflicts.length > 0
      || plan.warnings.some((warning) => warning.severity !== "info")
    ),
  );
  const handleRequestAiAssist = useCallback(async () => {
    if (!plan || !analysis) {
      showWarning("Saran AI belum siap", "Upload file dan tunggu pemeriksaan otomatis selesai dulu.");
      return;
    }
    if (!hasAiAssistableItems) {
      info("Belum ada item untuk AI", "Tidak ada item ambigu atau konflik yang perlu dimintakan saran AI.");
      return;
    }
    const cacheKey = aiAssistCacheKey || smartImportAssistCacheKey(fileMeta, plan, analysis);
    if (cacheKey && aiAssistCache[cacheKey]) {
      setAiAssist({ status: "success", response: aiAssistCache[cacheKey], error: null, cacheKey });
      info("Saran AI ditampilkan lagi", "Saran sebelumnya dipakai dari cache file ini.");
      return;
    }

    setAiAssist({ status: "loading", response: null, error: null, cacheKey });
    try {
      const request = buildSmartImportAssistRequest(analysis, plan, importContext, fileMeta);
      const response = sanitizeSmartImportAssistResponse(
        await requestSmartImportAssist(request),
        request,
      );
      setAiAssist({ status: "success", response, error: null, cacheKey });
      if (cacheKey) {
        setAiAssistCache((current) => ({ ...current, [cacheKey]: response }));
      }
      if (response.suggestions.length === 0) {
        info("Saran AI belum menemukan pilihan aman", "Lanjutkan dengan pemeriksaan manual.");
      }
    } catch (caught) {
      const fallback = createSmartImportAssistFallback("AI tidak tersedia. Lanjutkan dengan pemeriksaan manual.");
      setAiAssist({
        status: "error",
        response: fallback,
        error: caught instanceof Error ? caught.message : "AI tidak tersedia.",
        cacheKey,
      });
      showWarning("AI tidak tersedia", "Anda tetap bisa lanjut dengan pemeriksaan manual.");
    }
  }, [
    aiAssistCache,
    aiAssistCacheKey,
    analysis,
    fileMeta,
    hasAiAssistableItems,
    importContext,
    info,
    plan,
    regionSelectionPending,
    showWarning,
    smartFixResult?.manualRequiredCount,
    smartFixResult?.needsConfirmationCount,
    unsupported,
  ]);
  useEffect(() => {
    if (!open || tab !== "import" || stepIndex !== 3 || aiAssist.status !== "idle" || !hasAiAssistableItems) return;
    void handleRequestAiAssist();
  }, [aiAssist.status, handleRequestAiAssist, hasAiAssistableItems, open, stepIndex, tab]);

  const canGoNext = useMemo(() => {
    return getImportStepReadiness({
      stepIndex,
      stepCount: importSteps.length,
      hasPlan,
      unsupported,
      regionSelectionPending,
      activeImportIssueCount,
      activeHeaderIssueCount,
    });
  }, [
    activeHeaderIssueCount,
    activeImportIssueCount,
    hasPlan,
    regionSelectionPending,
    stepIndex,
    unsupported,
  ]);

  const handleTabChange = useCallback((value: string) => {
    const nextTab = value === "export" ? "export" : "import";
    setTab(nextTab);
    onTabChange(nextTab);
  }, [onTabChange]);

  const handleSelectRegion = useCallback((regionId: string) => {
    selectImportRegion(regionId);
  }, [selectImportRegion]);

  const showPlaceholder = useCallback((title: string, description: string) => {
    info(title, description);
  }, [info]);

  const handleFileSelected = useCallback(async (file: File) => {
    setFileName(file.name);
    setFileMeta({ name: file.name, size: file.size, lastModified: file.lastModified });
    setStepIndex(0);
    setAnalysis(null);
    setBasePlan(null);
    setPlan(null);
    setResolverState(emptyResolverState);
    setAnalysisError(null);
    setAnalysisErrorCode(null);
    setExecutionSummary(null);
    setExecutionProgress({ current: 0, total: 0 });
    setHistoryActionState("idle");
    setAiAssist(emptyAiAssistPanelState);
    setExecutionState("analyzing");

    try {
      if (file.size > maxImportFileBytes) {
        const fileTooLarge = getImportErrorMessage("IMPORT_FILE_TOO_LARGE");
        setAnalysisError(fileTooLarge.message);
        setAnalysisErrorCode("IMPORT_FILE_TOO_LARGE");
        setExecutionState("failed");
        showError(fileTooLarge.title, fileTooLarge.message);
        return;
      }

      const workbook = await readWorkbookFile(file);
      if (!workbook.ok) {
        const readError = "error" in workbook ? workbook.error : { message: "Workbook tidak bisa dibaca." };
        const code = normalizeImportErrorCode("code" in readError ? readError.code : undefined);
        const displayError = getImportErrorMessage(code, readError.message);
        setAnalysisError(displayError.message);
        setAnalysisErrorCode(code);
        setExecutionState("failed");
        showError(displayError.title, displayError.message);
        return;
      }

      const detectedSource = detectGradeImportSource(workbook, importContext);
      const nextAnalysis = detectedSource.analysis;
      const nextPlan = buildImportPlan(nextAnalysis, importContext, {
        updateMode: effectiveUpdateMode,
        selectedRegionId: isFreeExcelAnalysis(nextAnalysis) ? nextAnalysis.selectedRegionId : undefined,
      });
      const needsRegionSelection = isRegionSelectionPending(nextAnalysis);

      setSelectionState(emptyImportSelectionState);
      setAnalysis(nextAnalysis);
      setBasePlan(nextPlan);
      setPlan(applyResolverToPlan(nextPlan, emptyResolverState, importContext, effectiveUpdateMode));
      setStepIndex(nextPlan.sourceType === "official_exact" && !needsRegionSelection ? 2 : 1);
      setExecutionState("ready");
      setAnalysisErrorCode(null);
      if (needsRegionSelection) {
        showWarning("Pilih tabel nilai dulu", "Workbook memiliki beberapa tabel nilai. Pilih tabel yang benar sebelum lanjut.");
      } else if (nextPlan.sourceType === "official_exact") {
        success("Template resmi siap diperiksa", "Identitas template SIPENA valid. Periksa Daftar Bermasalah dulu sebelum melihat tabel verifikasi.");
      } else {
        success("Preview import siap", "File sudah dianalisis sebagai preview. Belum ada data yang disimpan.");
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "File gagal dianalisis.";
      setAnalysisError(message);
      setAnalysisErrorCode("IMPORT_WORKBOOK_READ_FAILED");
      setExecutionState("failed");
      showError("IMPORT_WORKBOOK_READ_FAILED", message);
    }
  }, [effectiveUpdateMode, importContext, showError, showWarning, success]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handleUndoImport = useCallback(async () => {
    if (!onUndoImport || !canUndoImport || historyActionState !== "idle") return;
    setHistoryActionState("undoing");
    try {
      await onUndoImport();
      await onImportComplete?.();
      success("Undo import berhasil", "Perubahan import terakhir sudah dikembalikan.");
    } catch (caught) {
      showError("Undo import gagal", caught instanceof Error ? cleanBackendText(caught.message) : "Perubahan import belum bisa dikembalikan.");
    } finally {
      setHistoryActionState("idle");
    }
  }, [canUndoImport, historyActionState, onImportComplete, onUndoImport, showError, success]);

  const handleRedoImport = useCallback(async () => {
    if (!onRedoImport || !canRedoImport || historyActionState !== "idle") return;
    setHistoryActionState("redoing");
    try {
      await onRedoImport();
      await onImportComplete?.();
      success("Redo import berhasil", "Perubahan import sudah diterapkan kembali.");
    } catch (caught) {
      showError("Redo import gagal", caught instanceof Error ? cleanBackendText(caught.message) : "Perubahan import belum bisa diterapkan kembali.");
    } finally {
      setHistoryActionState("idle");
    }
  }, [canRedoImport, historyActionState, onImportComplete, onRedoImport, showError, success]);

  const handlePrimaryAction = useCallback(async () => {
    if (tab === "import") {
      if (stepIndex === 0) {
        uploadInputRef.current?.click();
        return;
      }
      if (stepIndex === 6) {
        if (executionState === "success") {
          handleClose();
          return;
        }

        if (activeImportIssueCount > 0 || activeHeaderIssueCount > 0) {
          showWarning(
            "Import belum siap",
            activeImportIssueCount > 0
              ? `Lanjut belum bisa - selesaikan ${activeImportIssueCount} masalah di Daftar Bermasalah.`
              : activeHeaderIssueCount > 0
                ? `Lanjut belum bisa - selesaikan ${activeHeaderIssueCount} header di Konfigurasi Header.`
                : "Lanjut belum bisa - masih ada item yang wajib dicek.",
          );
          return;
        }
        if (!plan) {
          showWarning("Preview import belum siap", "Upload file dan selesaikan preview sebelum menjalankan proses simpan.");
          return;
        }

        const executablePlan = buildExecutableImportOperations({
          plan,
          resolverState: effectiveResolverState,
          selectionState: effectiveSelectionState,
          updateMode: effectiveUpdateMode,
        });
        if (executablePlan.summary.overwriteNeedsConfirmationCount > 0) {
          setStepIndex(3);
          showWarning(
            "Nilai lama perlu dikonfirmasi dulu.",
            `Simpan belum bisa karena ${executablePlan.summary.overwriteNeedsConfirmationCount} nilai lama belum dikonfirmasi untuk diganti.`,
          );
          return;
        }
        if (executablePlan.summary.blockedCount > 0) {
          setStepIndex(activeImportIssueCount > 0 ? 2 : activeHeaderIssueCount > 0 ? 3 : 4);
          showWarning(
            "Simpan belum bisa karena masih ada item yang perlu dipilih.",
            `${executablePlan.summary.blockedCount} item masih perlu dicek sebelum nilai disimpan.`,
          );
          return;
        }
        if (executablePlan.summary.executableCount === 0) {
          showWarning(
            "Tidak ada nilai siap import.",
            `0 nilai akan disimpan, ${executablePlan.summary.skippedEmptyCount + executablePlan.summary.skippedExistingCount + executablePlan.summary.skippedManualCount} dilewati karena kosong/nilai lama/pilihan manual.`,
          );
          return;
        }

        setExecutionState("importing");
        setExecutionSummary(null);
        setExecutionProgress({ current: 0, total: executablePlan.summary.totalOperations });

        try {
          const summary = await executeClientSideImport({
            executablePlan,
            onSaveGrade,
            onSaveGradesBatch,
            onEnsureAssignmentTarget,
            onRollbackCreatedImportStructure,
            importContext,
            onProgress: setExecutionProgress,
          });
          setExecutionSummary(summary);
          setExecutionState(summary.failedCount > 0 && summary.successCount === 0 ? "failed" : "success");
          if (summary.successCount > 0) {
            await onImportComplete?.();
          }
          if (summary.failedCount > 0 && summary.successCount === 0) {
            showError("Import dibatalkan", `Tidak ada nilai disimpan. ${summary.failedCount} nilai batal karena proses atomic gagal.`);
          } else if (summary.failedCount > 0) {
            showWarning("Import selesai sebagian", `${summary.successCount} nilai tersimpan, ${summary.failedCount} gagal, ${summary.skippedCount} dilewati.`);
          } else {
            success(
              "Import aman selesai",
              `${summary.successCount} nilai tersimpan. ${executablePlan.summary.executableCount} nilai akan disimpan, ${summary.skippedCount} dilewati karena kosong/nilai lama/pilihan manual.`,
            );
          }
        } catch (caught) {
          setExecutionState("failed");
          showError("Import gagal", caught instanceof Error ? cleanBackendText(caught.message) : "Proses simpan berhenti sebelum selesai.");
        }
        return;
      }

      if (!canGoNext) {
        const smartFixMessage = activeImportIssueCount > 0
          ? `Lanjut belum bisa - selesaikan ${activeImportIssueCount} masalah di Daftar Bermasalah.`
          : activeHeaderIssueCount > 0
            ? `Lanjut belum bisa - selesaikan ${activeHeaderIssueCount} header di Konfigurasi Header.`
            : "Upload file yang valid dulu untuk membuat preview import.";
        showWarning(
          stepIndex === 2 || stepIndex === 3 ? "Perbaikan belum selesai" : "Preview import belum siap",
          stepIndex === 2 || stepIndex === 3 ? smartFixMessage : "Upload file yang valid dulu untuk membuat preview import.",
        );
        return;
      }

      setStepIndex((current) => Math.min(current + 1, importSteps.length - 1));
      return;
    }

    if (exportMode === "official" && onDownloadOfficialTemplate) {
      await onDownloadOfficialTemplate();
      return;
    }
    if (exportMode === "current" && onDownloadCurrentGrades) {
      await onDownloadCurrentGrades();
      return;
    }
    if (exportMode === "backup" && onDownloadBackup) {
      await onDownloadBackup();
      return;
    }

    showPlaceholder(
      exportMode === "current" ? "Export nilai saat ini belum dijalankan" : "Backup lengkap belum dijalankan",
      "Pilih kelas dan mata pelajaran yang valid sebelum membuat workbook export.",
    );
  }, [
    blocked,
    activeHeaderIssueCount,
    activeImportIssueCount,
    canGoNext,
    executionState,
    exportMode,
    handleClose,
    onDownloadOfficialTemplate,
    onDownloadBackup,
    onDownloadCurrentGrades,
    onImportComplete,
    onSaveGrade,
    onSaveGradesBatch,
    onEnsureAssignmentTarget,
    onRollbackCreatedImportStructure,
    plan,
    effectiveResolverState,
    effectiveSelectionState,
    effectiveUpdateMode,
    spreadsheetPreview,
    showError,
    showPlaceholder,
    showWarning,
    stepIndex,
    success,
    tab,
    workflowIssuesResolved,
  ]);

  const handleBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const modeLabel = exportMode === "official"
    ? "Template Resmi SIPENA"
    : exportMode === "current"
      ? "Export Nilai Saat Ini"
      : "Backup Lengkap";
  const backupIncompleteWarning = exportMode === "backup" && (
    !importContext.classId
    || !importContext.subjectId
    || !importContext.academicYearId
    || studentCount === 0
    || chapterCount === 0
    || assignmentCount === 0
  )
    ? "Sebagian data belum tersedia untuk export lengkap."
    : null;
  const exportActionLoading = exportMode === "official"
    ? isDownloadingTemplate
    : exportMode === "current"
      ? isExportingCurrentGrades
      : isExportingBackup;
  const templateDownloadReason = useMemo(() => {
    if (!onDownloadOfficialTemplate) return "Download template belum tersedia dari halaman ini.";
    if (!canDownloadOfficialTemplate) return "Lengkapi kelas, mapel, semester, dan tahun ajaran aktif sebelum download template.";
    return null;
  }, [canDownloadOfficialTemplate, onDownloadOfficialTemplate]);
  const readyImportCount = finalReviewModel
    ? finalReviewModel.summary.save + finalReviewModel.summary.convert + finalReviewModel.summary.overwrite
    : executableImportPlan?.summary.executableCount ?? plan?.summary.readyImportCount ?? 0;
  const rawNeedsCheckCount = (smartFixResult?.needsConfirmationCount || 0)
    + (smartFixResult?.manualRequiredCount || 0)
    + (executableImportPlan?.summary.overwriteNeedsConfirmationCount || 0);
  const rawBlockedItemCount = finalReviewModel?.summary.blocked
    ?? executableImportPlan?.summary.blockedCount
    ?? plan?.conflicts.filter((item) => item.severity === "blocked").length
    ?? 0;
  const needsCheckCount = workflowIssuesResolved && stepIndex >= 4 ? 0 : rawNeedsCheckCount;
  const blockedItemCount = workflowIssuesResolved && stepIndex >= 4 ? 0 : rawBlockedItemCount;
  const overwriteNeedsConfirmationCount = workflowIssuesResolved && stepIndex >= 4
    ? 0
    : executableImportPlan?.summary.overwriteNeedsConfirmationCount || 0;
  const importReadinessMessage = useMemo(() => {
    if (tab !== "import") {
      if (exportMode === "official") return "Template kosong untuk input nilai baru.";
      if (exportMode === "current") return "Workbook berisi nilai tersimpan untuk dicek atau dilengkapi.";
      return "Backup menyertakan metadata tersembunyi untuk arsip pemeriksaan.";
    }
    if (regionSelectionPending) return "Pilih tabel nilai yang ingin dipakai.";
    if (unsupported) return "Format file belum bisa dibaca.";
    if (stepIndex === 2 && activeImportIssueCount > 0) {
      return `Selesaikan ${activeImportIssueCount} masalah utama dulu. Header dan nilai kolom diatur pada langkah berikutnya.`;
    }
    if (stepIndex === 3 && activeHeaderIssueCount > 0) {
      return `Selesaikan ${activeHeaderIssueCount} header di Konfigurasi Header terlebih dahulu.`;
    }
    if (stepIndex === 6 && overwriteNeedsConfirmationCount > 0) {
      return "Nilai lama yang akan diganti harus dikonfirmasi dulu.";
    }
    if (stepIndex === 6 && blockedItemCount > 0) {
      return `Simpan belum bisa karena masih ada ${blockedItemCount} item yang perlu dipilih.`;
    }
    if (stepIndex === 6 && workflowIssuesResolved) return "Masalah utama dan header sudah selesai. Tabel akhir sudah konkret dan siap disimpan.";
    if (stepIndex === 4 || stepIndex === 5) {
      return "Masalah utama dan header sudah selesai. Periksa tabel lalu lanjut.";
    }
    if (stepIndex >= 2 && executableImportPlan) {
      const skipped = executableImportPlan.summary.skippedEmptyCount
        + executableImportPlan.summary.skippedExistingCount
        + executableImportPlan.summary.skippedManualCount;
      if (executableImportPlan.summary.executableCount === 0) return "Tidak ada nilai siap import.";
      return `${executableImportPlan.summary.executableCount} nilai akan disimpan, ${skipped} dilewati karena kosong/nilai lama.`;
    }
    return "Default aman aktif: SIPENA hanya mengisi nilai yang masih kosong.";
  }, [activeHeaderIssueCount, activeImportIssueCount, blockedItemCount, executableImportPlan, exportMode, overwriteNeedsConfirmationCount, regionSelectionPending, stepIndex, tab, unsupported, workflowIssuesResolved]);

  const primaryLabel = useMemo(() => {
    if (tab === "export") {
      if (exportActionLoading) return "Menyiapkan...";
      if (exportMode === "official") return "Download Template Resmi";
      if (exportMode === "current") return "Download Export Nilai";
      return "Download Backup";
    }
    if (stepIndex === 0) return executionState === "analyzing" ? "Menganalisis..." : "Upload Excel dulu";
    if (stepIndex === 6 && executionState === "success") return "Selesai";
    if (stepIndex === 6) {
      if (executionState === "importing") return "Memproses...";
      if (overwriteNeedsConfirmationCount > 0) return "Konfirmasi nilai lama";
      if (blockedItemCount > 0 || activeImportIssueCount > 0 || activeHeaderIssueCount > 0) return "Selesaikan pilihan";
      return "Simpan nilai";
    }
    return "Lanjut";
  }, [activeHeaderIssueCount, activeImportIssueCount, blockedItemCount, executionState, exportActionLoading, exportMode, overwriteNeedsConfirmationCount, stepIndex, tab]);
  const importPrimaryDisabledReason = useMemo(() => {
    if (tab !== "import") return null;
    if (executionState === "analyzing") return "File sedang diperiksa.";
    if (executionState === "importing") return "Nilai sedang disimpan.";
    if (regionSelectionPending) return "Pilih tabel nilai yang ingin dipakai.";
    if (unsupported) return "Format file belum bisa dibaca.";
    if (stepIndex > 0 && stepIndex < 6 && !canGoNext) {
      if ((plan?.conflicts || []).some((item) => item.code.includes("CONTEXT") || item.code.includes("SEMESTER"))) {
        return "Download template baru jika file berasal dari kelas/mapel/semester lain.";
      }
      if (stepIndex === 2 && activeImportIssueCount > 0) return `Selesaikan ${activeImportIssueCount} masalah utama terlebih dahulu.`;
      if (stepIndex === 3 && activeHeaderIssueCount > 0) return `Selesaikan ${activeHeaderIssueCount} header terlebih dahulu.`;
      if (activeImportIssueCount > 0) return "Selesaikan masalah di Daftar Bermasalah terlebih dahulu.";
      if (activeHeaderIssueCount > 0) return "Selesaikan Konfigurasi Header terlebih dahulu.";
      return "Periksa item yang perlu dicek terlebih dahulu.";
    }
    if (stepIndex === 6) {
      if (activeImportIssueCount > 0) return "Selesaikan masalah di Daftar Bermasalah terlebih dahulu.";
      if (activeHeaderIssueCount > 0) return "Selesaikan Konfigurasi Header terlebih dahulu.";
      if (!workflowIssuesResolved) {
        if (blocked || blockedItemCount > 0) return "Selesaikan item yang wajib dipilih terlebih dahulu.";
        if (needsCheckCount > 0) return "Periksa item yang perlu dicek terlebih dahulu.";
      }
      if (readyImportCount === 0) return "Tidak ada nilai siap import.";
    }
    return null;
  }, [
    blocked,
    blockedItemCount,
    activeHeaderIssueCount,
    activeImportIssueCount,
    canGoNext,
    executionState,
    needsCheckCount,
    plan?.conflicts,
    readyImportCount,
    regionSelectionPending,
    stepIndex,
    tab,
    unsupported,
    workflowIssuesResolved,
  ]);
  const importPrimaryDisabled = tab === "import" && (
    executionState === "analyzing"
    || executionState === "importing"
    || (stepIndex > 0 && stepIndex < 6 && !canGoNext)
    || (stepIndex === 6 && readyImportCount === 0)
  );
  const exportPrimaryDisabled = tab === "export" && (
    exportActionLoading
    || (exportMode === "official" && (!canDownloadOfficialTemplate || !onDownloadOfficialTemplate))
    || (exportMode === "current" && !onDownloadCurrentGrades)
    || (exportMode === "backup" && !onDownloadBackup)
  );
  const dialogDescription = tab === "import"
    ? "Upload template SIPENA atau Excel bebas. SIPENA akan membaca dan memeriksa otomatis sebelum nilai disimpan."
    : contextLabel || "Pilih kelas, mapel, dan semester terlebih dahulu";
  const isPreviewFixStep = tab === "import" && (stepIndex === 2 || stepIndex === 3 || stepIndex === 4);
  const footerStatusLabel = useMemo(() => {
    if (tab === "export") return modeLabel;
    if (regionSelectionPending) return "Pilih tabel";
    if (unsupported) return "File belum valid";
    if (stepIndex === 2 && activeImportIssueCount > 0) return `${activeImportIssueCount} masalah tersisa`;
    if (stepIndex === 3 && activeHeaderIssueCount > 0) return `${activeHeaderIssueCount} header tersisa`;
    if (stepIndex === 6 && overwriteNeedsConfirmationCount > 0) return `${overwriteNeedsConfirmationCount} timpa perlu konfirmasi`;
    if (stepIndex === 6 && blockedItemCount > 0) return `${blockedItemCount} perlu diselesaikan`;
    if (workflowIssuesResolved && stepIndex >= 4) return "Siap diverifikasi";
    if (readyImportCount > 0) return `${readyImportCount} siap import`;
    return "Pemeriksaan aman";
  }, [
    activeHeaderIssueCount,
    activeImportIssueCount,
    blockedItemCount,
    overwriteNeedsConfirmationCount,
    readyImportCount,
    regionSelectionPending,
    stepIndex,
    modeLabel,
    tab,
    unsupported,
    workflowIssuesResolved,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sipena-grade-import-dialog flex h-[calc(100dvh-0.25rem)] max-h-[980px] w-[calc(100vw-0.25rem)] max-w-[1880px] grid-rows-none flex-col gap-0 overflow-hidden rounded-[24px] border-slate-300 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:h-[min(96dvh,980px)] sm:w-[calc(100vw-0.75rem)] xl:w-[min(98vw,1880px)]">
        <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/95 px-3 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-5">
            <div className="flex min-w-0 flex-col gap-2 pr-10 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/70">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <DialogTitle className="text-base font-semibold tracking-normal text-slate-950 dark:text-slate-50">
                      {tab === "import" ? "Import Nilai" : "Export Nilai"}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="mt-0.5 max-w-[min(76vw,920px)] truncate text-xs leading-5 text-muted-foreground" title={dialogDescription}>
                    {dialogDescription}
                  </DialogDescription>
                </div>
              </div>
              <TabsList aria-label="Mode export dan import nilai" className="grid h-10 w-full max-w-sm shrink-0 grid-cols-2 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900 lg:w-80">
                <TabsTrigger value="import" className="h-8 gap-1.5 rounded-full text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm">
                  <UploadCloud className="h-3.5 w-3.5" />
                  Import Nilai
                </TabsTrigger>
                <TabsTrigger value="export" className="h-8 gap-1.5 rounded-full text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm sm:text-sm">
                  <Download className="h-3.5 w-3.5" />
                  Export Nilai
                </TabsTrigger>
              </TabsList>
            </div>
          </header>

          <div
            ref={importBodyRef}
            className={cn(
              "min-h-0 flex-1 overscroll-contain overflow-y-auto overflow-x-hidden bg-slate-50/70 px-3 py-2.5 dark:bg-slate-950 sm:px-5",
              tab === "import" && stepIndex === 2 && "sipena-import-body--issue-step",
            )}
          >
            <TabsContent value="import" className="m-0 min-w-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <div className="grid min-w-0 grid-cols-1 gap-4">
                <main className="min-w-0 space-y-4">
                  <section className="min-w-0 rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
                    <ImportStepper steps={importSteps} currentIndex={stepIndex} />
                  </section>

                  {stepIndex === 0 ? (
                    <>
                      <ImportStartPanel
                        fileName={fileName}
                        canDownloadOfficialTemplate={canDownloadOfficialTemplate}
                        isDownloadingTemplate={isDownloadingTemplate}
                        onDownloadOfficialTemplate={onDownloadOfficialTemplate}
                        onFileSelected={handleFileSelected}
                        downloadReason={templateDownloadReason}
                        uploadInputRef={uploadInputRef}
                      />

                      {executionState === "analyzing" ? (
                        <RiskAlert title="File sedang dianalisis" tone="info">
                          SIPENA membaca workbook, mendeteksi jenis file, lalu membuat preview import.
                        </RiskAlert>
                      ) : null}

                      {analysisError ? (
                        <RiskAlert title={getImportErrorMessage(analysisErrorCode, analysisError).title} tone="blocked">
                          {analysisError}
                        </RiskAlert>
                      ) : null}

                      {studentCount === 0 ? (
                        <RiskAlert title="Belum ada siswa" tone="warning" className="rounded-2xl">
                          Tambahkan siswa pada kelas aktif sebelum import nilai.
                        </RiskAlert>
                      ) : null}
                    </>
                  ) : null}

                  {stepIndex === 1 ? <AnalysisStep plan={plan} analysis={analysis} onSelectRegion={handleSelectRegion} /> : null}
                  {stepIndex === 2 ? (
                    <ImportIssueStep
                      plan={plan}
                      model={spreadsheetPreview}
                      actions={resolverActions}
                      selectionState={effectiveSelectionState}
                      importContext={importContext}
                      aiAssistResponse={aiAssist.response}
                    />
                  ) : null}
                  {stepIndex === 3 ? (
                    <HeaderConfigurationWizardStep
                      plan={plan}
                      model={spreadsheetPreview}
                      actions={resolverActions}
                      selectionState={effectiveSelectionState}
                      importContext={importContext}
                      aiAssistResponse={aiAssist.response}
                    />
                  ) : null}
                  {stepIndex === 4 ? (
                    <SpreadsheetPreviewStep
                      plan={plan}
                      model={spreadsheetPreview}
                      actions={resolverActions}
                      selectionState={effectiveSelectionState}
                      importContext={importContext}
                      aiAssistResponse={aiAssist.response}
                      onOpenIssueStep={() => setStepIndex(2)}
                    />
                  ) : null}
                  {stepIndex === 5 ? (
                    <PreviewStep
                      plan={plan}
                      model={spreadsheetPreview}
                      review={finalReviewModel}
                      executablePlan={executableImportPlan}
                      hasBlockingIssues={!workflowIssuesResolved}
                      onOpenFixStep={() => setStepIndex(4)}
                    />
                  ) : null}
                  {stepIndex === 6 ? (
                    <ImportStep
                      state={executionState}
                      plan={plan}
                      summary={executionSummary}
                      progress={executionProgress}
                      onDone={handleClose}
                      onBack={handleBack}
                      canUndoImport={canUndoImport}
                      canRedoImport={canRedoImport}
                      historyActionState={historyActionState}
                      onUndoImport={handleUndoImport}
                      onRedoImport={handleRedoImport}
                    />
                  ) : null}
                </main>

              </div>
            </TabsContent>

            <TabsContent value="export" className="m-0 min-w-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
                <main className="min-w-0 space-y-3">
                  <div className="grid min-w-0 items-stretch gap-3 md:grid-cols-3 xl:auto-rows-fr">
                    <ExportOptionCard
                      title="Template Resmi SIPENA"
                      description="File kosong sesuai kelas, mapel, semester, siswa, BAB, dan tugas aktif."
                      meta="Paling terarah untuk input nilai baru"
                      selected={exportMode === "official"}
                      tone="official"
                      icon={<FileSpreadsheet className="h-5 w-5" />}
                      onClick={() => setExportMode("official")}
                    />
                    <ExportOptionCard
                      title="Export Nilai Saat Ini"
                      description="Berisi nilai yang sudah tersimpan untuk dicek atau dilengkapi."
                      meta="Untuk pemeriksaan nilai saat ini"
                      selected={exportMode === "current"}
                      tone="current"
                      icon={<Download className="h-5 w-5" />}
                      onClick={() => setExportMode("current")}
                    />
                    <ExportOptionCard
                      title="Backup Lengkap"
                      description="Arsip workbook sebelum perubahan besar."
                      meta="Arsip pemeriksaan sebelum import massal"
                      selected={exportMode === "backup"}
                      tone="backup"
                      icon={<Archive className="h-5 w-5" />}
                      onClick={() => setExportMode("backup")}
                    />
                  </div>

                  {backupIncompleteWarning ? (
                    <RiskAlert title="Export lengkap belum membawa semua konteks" tone="warning">
                      {backupIncompleteWarning} Workbook tetap akan dibuat dari siswa, struktur, dan nilai yang tersedia saat ini.
                    </RiskAlert>
                  ) : (
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Export tidak mengubah nilai dan tidak menyimpan data baru.
                    </div>
                  )}
                </main>

                <WorkbookPreviewPanel
                  classNameLabel={classNameLabel}
                  subjectName={subjectName}
                  semesterName={semesterName}
                  studentCount={studentCount}
                  chapterCount={chapterCount}
                  assignmentCount={assignmentCount}
                  modeLabel={modeLabel}
                  sheetNames={exportSheetsByMode[exportMode]}
                  warning={backupIncompleteWarning}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <footer className="z-20 shrink-0 border-t border-slate-200 bg-white/95 px-3 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-5">
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/70" title={importReadinessMessage}>
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="truncate">{footerStatusLabel}</span>
              </span>
              {importPrimaryDisabledReason ? (
                <span id="sipena-import-disabled-reason" className="max-w-[min(78vw,720px)] truncate text-orange-700 dark:text-orange-300" title={importPrimaryDisabledReason}>
                  {importPrimaryDisabledReason}
                </span>
              ) : (
                <span className="max-w-[min(78vw,760px)] truncate" title={importReadinessMessage}>
                  {importReadinessMessage}
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
              {tab === "import" && stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-10 w-full rounded-full sm:w-auto"
                  onClick={handleBack}
                >
                  Kembali
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={
                  exportPrimaryDisabled
                  || importPrimaryDisabled
                }
                aria-describedby={importPrimaryDisabledReason ? "sipena-import-disabled-reason" : undefined}
                className={cn(
                  "min-h-10 w-full min-w-0 gap-2 rounded-full text-white sm:w-auto",
                  tab === "export" ? "bg-violet-600 hover:bg-violet-700" : "bg-blue-600 hover:bg-blue-700",
                )}
                onClick={handlePrimaryAction}
              >
                {tab === "import" ? (
                  <>
                    {executionState === "analyzing" || executionState === "importing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {primaryLabel}
                  </>
                ) : exportMode === "official" ? (
                  <>
                    {exportActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {primaryLabel}
                  </>
                ) : (
                  <>
                    {exportActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {primaryLabel}
                  </>
                )}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
