import type {
  ColumnMapping,
  GradeOperation,
  ImportConflict,
  ImportPlan,
  StudentMapping,
  UpdateMode,
} from "./types";

export type SimplifiedConflictLevel =
  | "auto_fixable"
  | "needs_confirmation"
  | "manual_required";

export type SimplifiedConflictActionKind =
  | "apply_safe_fix"
  | "approve_sipena_suggestion"
  | "ignore_non_grade_columns"
  | "use_web_student_data"
  | "use_safe_update_mode"
  | "choose_student"
  | "choose_column_target"
  | "confirm_structure_creation"
  | "resolve_duplicate_target"
  | "fix_invalid_value"
  | "change_import_context"
  | "open_advanced_options";

export type SimplifiedConflictItem = {
  id: string;
  sourceConflictIds: string[];
  level: SimplifiedConflictLevel;
  title: string;
  description: string;
  recommendedActionLabel: string;
  secondaryActionLabel?: string;
  detailLabel?: string;
  canApplyRecommended: boolean;
  requiresManualChoice: boolean;
  reason?: string;
  rawType?: string;
  metadata?: Record<string, unknown>;
};

export type SimplifiedConflictGroup = {
  id: string;
  level: SimplifiedConflictLevel;
  title: string;
  description: string;
  recommendedActionLabel: string;
  secondaryActionLabel?: string;
  canBulkApply: boolean;
  itemCount: number;
  blockingCount: number;
  items: SimplifiedConflictItem[];
};

export type ConflictSimplifierResult = {
  groups: SimplifiedConflictGroup[];
  autoFixableCount: number;
  needsConfirmationCount: number;
  manualRequiredCount: number;
  blockingCount: number;
  isReadyForPreview: boolean;
  headline: string;
  description: string;
  primaryActionLabel: string;
};

export interface ConflictSimplifierResolverState {
  ignoredRows?: number[];
  unresolvedRows?: number[];
  studentOverrides?: Record<string, string>;
  ignoredColumns?: number[];
  columnOverrides?: Record<string, unknown>;
  resolvedConflictKeys?: string[];
}

export interface SimplifyImportConflictsInput {
  plan: ImportPlan;
  resolverState?: ConflictSimplifierResolverState;
  updateMode?: UpdateMode;
}

const autoFixableConflictCodes = new Set([
  "STUDENT_ID_NAME_CHANGED",
  "STUDENT_ID_NISN_CHANGED",
  "STUDENT_NISN_NORMALIZED_MATCH",
  "STUDENT_NAME_NORMALIZED_MATCH",
  "GRADE_VALUE_DECIMAL_COMMA",
  "GRADE_VALUE_PERCENT",
  "GRADE_VALUE_FRACTION_100",
]);

const confirmationConflictCodes = new Set([
  "COLUMN_CREATE_ASSIGNMENT_SUGGESTED",
  "COLUMN_CREATE_CHAPTER_AND_ASSIGNMENT_SUGGESTED",
  "COLUMN_ASSIGNMENT_SIMILAR_MATCH",
  "COLUMN_CHAPTER_SIMILAR_MATCH",
  "COLUMN_METADATA_INVALID_HEADER_CLEAR",
  "COLUMN_METADATA_VS_HEADER_CHANGED",
  "IMPORT_HEADER_CHANGED",
  "IMPORT_ADDED_HEADER_DETECTED",
  "IMPORT_UNSIGNED_TEMPLATE",
  "GRADE_VALUE_FRACTION_SCALED",
  "STUDENT_FUZZY_MATCH",
]);

const manualConflictCodes = new Set([
  "COLUMN_ASSIGNMENT_WITHOUT_CHAPTER",
  "COLUMN_ASSIGNMENT_WITHOUT_CHAPTER_AMBIGUOUS",
  "COLUMN_ASSIGNMENT_AMBIGUOUS",
  "COLUMN_UNRESOLVED",
  "GRADE_VALUE_INVALID",
  "GRADE_VALUE_TEXTUAL_BLOCKED",
  "IMPORT_COLUMN_NOT_SAFE_FOR_VALUE",
  "IMPORT_CONTEXT_MISMATCH",
  "IMPORT_CONTEXT_MISMATCH_BLOCKED",
  "IMPORT_DUPLICATE_COLUMN_TARGET",
  "IMPORT_INVALID_VALUE_STRICT",
  "IMPORT_NEW_STRUCTURE_NOT_CONFIRMED",
  "IMPORT_NO_FREE_EXCEL_REGION",
  "IMPORT_NO_GRADE_COLUMNS",
  "IMPORT_NO_SUPPORTED_TEMPLATE_STRUCTURE",
  "IMPORT_SEMESTER_MISMATCH",
  "IMPORT_STUDENT_NOT_SAFE_FOR_VALUE",
  "STUDENT_DUPLICATE_EXCEL_MATCH",
  "STUDENT_FUZZY_AMBIGUOUS",
  "STUDENT_MARKED_UNRESOLVED",
  "STUDENT_MATCH_AMBIGUOUS",
  "STUDENT_MATCH_DUPLICATE_WEB_CANDIDATE",
  "STUDENT_MISSING_IN_WEB",
]);

export function getSimplifiedConflictSourceId(
  item: ImportConflict | { type?: string; code: string; rowIndex?: number; columnIndex?: number; message?: string },
): string {
  return [item.type ?? "", item.code, item.rowIndex ?? "", item.columnIndex ?? "", item.message ?? ""].join(":");
}

function hasResolvedSource(
  item: ImportConflict | { type?: string; code: string; rowIndex?: number; columnIndex?: number; message?: string },
  resolverState?: ConflictSimplifierResolverState,
): boolean {
  const key = getSimplifiedConflictSourceId(item);
  if (resolverState?.resolvedConflictKeys?.includes(key)) return true;
  if (item.rowIndex && resolverState?.ignoredRows?.includes(item.rowIndex)) return true;
  if (item.rowIndex && resolverState?.studentOverrides?.[String(item.rowIndex)]) return true;
  if (item.columnIndex && resolverState?.ignoredColumns?.includes(item.columnIndex)) return true;
  if (item.columnIndex && resolverState?.columnOverrides?.[String(item.columnIndex)]) return true;
  return false;
}

function columnTitle(mapping?: ColumnMapping): string {
  if (!mapping) return "Kolom Excel perlu dicek";
  if (mapping.parsedHeader.derived || mapping.parsedHeader.reserved) return `Abaikan kolom "${mapping.rawHeader}"`;
  return `Cek kolom "${mapping.rawHeader}"`;
}

function columnTargetLabel(mapping?: ColumnMapping): string {
  if (!mapping?.target) return "Target kolom nilai belum jelas.";
  if (mapping.target.gradeType === "sts") return "Kolom ini dapat dipakai sebagai nilai STS.";
  if (mapping.target.gradeType === "sas") return "Kolom ini dapat dipakai sebagai nilai SAS.";
  return `Kolom ini menuju ${[mapping.target.chapterName, mapping.target.assignmentName].filter(Boolean).join(" - ")}.`;
}

function studentTitle(mapping?: StudentMapping): string {
  if (!mapping) return "Data siswa perlu dicek";
  return `Cek siswa "${mapping.excelName || mapping.webName || "baris Excel"}"`;
}

function operationTitle(operation?: GradeOperation): string {
  if (!operation) return "Nilai perlu dicek";
  if (operation.value === null) return `Lewati nilai kosong baris ${operation.rowIndex}`;
  return `Cek nilai baris ${operation.rowIndex}, kolom ${operation.columnIndex}`;
}

function makeItem(
  level: SimplifiedConflictLevel,
  input: {
    id: string;
    sourceConflictIds?: string[];
    title: string;
    description: string;
    recommendedActionLabel: string;
    secondaryActionLabel?: string;
    detailLabel?: string;
    canApplyRecommended?: boolean;
    requiresManualChoice?: boolean;
    reason?: string;
    rawType?: string;
    metadata?: Record<string, unknown>;
  },
): SimplifiedConflictItem {
  return {
    level,
    sourceConflictIds: input.sourceConflictIds || [],
    canApplyRecommended: input.canApplyRecommended ?? level !== "manual_required",
    requiresManualChoice: input.requiresManualChoice ?? level === "manual_required",
    ...input,
  };
}

function classifyConflict(
  conflict: ImportConflict,
  plan: ImportPlan,
): SimplifiedConflictItem {
  const student = conflict.rowIndex
    ? plan.studentMappings.find((mapping) => mapping.rowIndex === conflict.rowIndex)
    : undefined;
  const column = conflict.columnIndex
    ? plan.columnMappings.find((mapping) => mapping.columnIndex === conflict.columnIndex)
    : undefined;
  const operation = conflict.rowIndex && conflict.columnIndex
    ? plan.gradeOperations.find((item) => item.rowIndex === conflict.rowIndex && item.columnIndex === conflict.columnIndex)
    : undefined;
  const id = getSimplifiedConflictSourceId(conflict);
  const sourceConflictIds = [id];
  const metadata = {
    code: conflict.code,
    rowIndex: conflict.rowIndex,
    columnIndex: conflict.columnIndex,
    options: conflict.options,
    rawHeader: column?.rawHeader,
    excelName: student?.excelName,
    webName: student?.webName,
  };

  if (autoFixableConflictCodes.has(conflict.code)) {
    if (conflict.type === "student") {
      return makeItem("auto_fixable", {
        id,
        sourceConflictIds,
        title: studentTitle(student),
        description: "Data dari Excel cocok dengan siswa di web. SIPENA dapat memakai data web sebagai acuan.",
        recommendedActionLabel: "Gunakan data web",
        detailLabel: "Lihat alasan SIPENA",
        reason: conflict.message,
        rawType: conflict.type,
        metadata,
      });
    }

    return makeItem("auto_fixable", {
      id,
      sourceConflictIds,
      title: operationTitle(operation),
      description: "Format nilai dapat dibaca dengan aman tanpa mengubah nilai lama.",
      recommendedActionLabel: "Terapkan perbaikan aman",
      detailLabel: "Lihat alasan SIPENA",
      reason: conflict.message,
      rawType: conflict.type,
      metadata,
    });
  }

  if (manualConflictCodes.has(conflict.code) || conflict.severity === "blocked") {
    const isContext = conflict.type === "context" || conflict.code.includes("CONTEXT") || conflict.code.includes("SEMESTER");
    const isDuplicateTarget = conflict.code === "IMPORT_DUPLICATE_COLUMN_TARGET";
    const isInvalidValue = conflict.type === "grade_value" || conflict.code.includes("INVALID") || conflict.code.includes("TEXTUAL");
    const isStudent = conflict.type === "student";

    return makeItem("manual_required", {
      id,
      sourceConflictIds,
      title: isContext
        ? "File berbeda kelas/mapel/semester"
        : isDuplicateTarget
          ? "Ada 2 kolom menuju tugas yang sama"
          : isInvalidValue
            ? "Nilai tidak valid"
            : isStudent
              ? "Pilih siswa yang benar"
              : columnTitle(column),
      description: isContext
        ? "File ini tampaknya bukan dari halaman yang sedang dibuka."
        : isDuplicateTarget
          ? "Pilih kolom mana yang dipakai agar nilai tidak dobel."
          : isInvalidValue
            ? "SIPENA tidak bisa membaca nilai ini sebagai angka 0-100."
            : isStudent
              ? "Nama dari Excel cocok dengan beberapa siswa atau belum ditemukan di web."
              : "Target kolom nilai belum cukup aman untuk dipilih otomatis.",
      recommendedActionLabel: isContext ? "Pilih konteks yang sesuai" : "Pilih sekarang",
      secondaryActionLabel: "Abaikan data ini",
      detailLabel: "Lihat alasan SIPENA",
      canApplyRecommended: false,
      requiresManualChoice: true,
      reason: conflict.message,
      rawType: conflict.type,
      metadata,
    });
  }

  if (confirmationConflictCodes.has(conflict.code) || conflict.severity === "warning") {
    return makeItem("needs_confirmation", {
      id,
      sourceConflictIds,
      title: column?.target?.chapterName || column?.target?.assignmentName
        ? `Konfirmasi ${[column.target?.chapterName, column.target?.assignmentName].filter(Boolean).join(" - ")}`
        : columnTitle(column),
      description: conflict.type === "student"
        ? "SIPENA menemukan kandidat siswa yang kuat, tetapi tetap perlu persetujuan Anda."
        : "SIPENA punya saran target, tetapi perlu persetujuan sebelum dipakai.",
      recommendedActionLabel: "Setujui saran SIPENA",
      secondaryActionLabel: "Pilih manual",
      detailLabel: "Lihat alasan SIPENA",
      reason: conflict.message,
      rawType: conflict.type,
      metadata,
    });
  }

  return makeItem("manual_required", {
    id,
    sourceConflictIds,
    title: conflict.type === "student" ? studentTitle(student) : columnTitle(column),
    description: "SIPENA belum bisa menentukan pilihan aman untuk data ini.",
    recommendedActionLabel: "Pilih sekarang",
    secondaryActionLabel: "Abaikan data ini",
    detailLabel: "Lihat alasan SIPENA",
    canApplyRecommended: false,
    requiresManualChoice: true,
    reason: conflict.message,
    rawType: conflict.type,
    metadata,
  });
}

function autoItemsFromPlan(plan: ImportPlan, updateMode: UpdateMode): SimplifiedConflictItem[] {
  const items: SimplifiedConflictItem[] = [];
  const seen = new Set<string>();

  if (updateMode === "fill_empty_only") {
    items.push(makeItem("auto_fixable", {
      id: "update-mode-fill-empty-only",
      title: "Mode aman aktif",
      description: "SIPENA hanya mengisi nilai yang masih kosong.",
      recommendedActionLabel: "Pertahankan mode aman",
      detailLabel: "Lihat alasan SIPENA",
      reason: "Mode ini tidak menimpa nilai lama.",
      rawType: "update_mode",
      metadata: { updateMode },
    }));
  }

  plan.columnMappings.forEach((mapping) => {
    const id = `column-${mapping.columnIndex}-${mapping.parsedHeader.headerType}`;
    if (seen.has(id)) return;
    if (mapping.parsedHeader.derived || mapping.parsedHeader.reserved) {
      seen.add(id);
      items.push(makeItem("auto_fixable", {
        id,
        title: columnTitle(mapping),
        description: "Kolom ini bukan kolom nilai input dan aman untuk diabaikan.",
        recommendedActionLabel: "Abaikan kolom ini",
        detailLabel: "Lihat alasan SIPENA",
        reason: "Kolom ringkasan seperti Rapor, Ranking, Rata-rata, Total, Predikat, Status, atau KKM tidak diimport sebagai nilai tugas.",
        rawType: "column",
        metadata: { columnIndex: mapping.columnIndex, rawHeader: mapping.rawHeader },
      }));
      return;
    }

    if (mapping.target?.gradeType === "sts" && /(^|\s)(uts|pts)(\s|$)/i.test(mapping.rawHeader)) {
      seen.add(id);
      items.push(makeItem("auto_fixable", {
        id,
        title: `Jadikan "${mapping.rawHeader}" sebagai STS`,
        description: "UTS atau PTS adalah istilah yang dapat dibaca sebagai STS.",
        recommendedActionLabel: "Pakai sebagai STS",
        detailLabel: "Lihat alasan SIPENA",
        reason: "Alias nilai tengah semester terdeteksi.",
        rawType: "column",
        metadata: { columnIndex: mapping.columnIndex, rawHeader: mapping.rawHeader },
      }));
      return;
    }

    if (mapping.target?.gradeType === "sas" && /(^|\s)(uas|pas)(\s|$)/i.test(mapping.rawHeader)) {
      seen.add(id);
      items.push(makeItem("auto_fixable", {
        id,
        title: `Jadikan "${mapping.rawHeader}" sebagai SAS`,
        description: "UAS atau PAS adalah istilah yang dapat dibaca sebagai SAS.",
        recommendedActionLabel: "Pakai sebagai SAS",
        detailLabel: "Lihat alasan SIPENA",
        reason: "Alias nilai akhir semester terdeteksi.",
        rawType: "column",
        metadata: { columnIndex: mapping.columnIndex, rawHeader: mapping.rawHeader },
      }));
      return;
    }

    if (mapping.status === "safe" && mapping.target && mapping.parsedHeader.headerType !== "unknown") {
      seen.add(id);
      items.push(makeItem("auto_fixable", {
        id,
        title: columnTitle(mapping),
        description: columnTargetLabel(mapping),
        recommendedActionLabel: "Gunakan target kolom",
        detailLabel: "Lihat alasan SIPENA",
        reason: "Header cocok dengan struktur nilai di web.",
        rawType: "column",
        metadata: { columnIndex: mapping.columnIndex, rawHeader: mapping.rawHeader },
      }));
    }
  });

  plan.studentMappings.forEach((mapping) => {
    if (mapping.matchedBy === "student_id" && mapping.status === "warning" && mapping.studentId) {
      items.push(makeItem("auto_fixable", {
        id: `student-web-data-${mapping.rowIndex}`,
        title: studentTitle(mapping),
        description: "student_id cocok. Jika nama atau NISN di Excel berbeda, data siswa di web tetap dipakai.",
        recommendedActionLabel: "Gunakan data siswa dari web",
        detailLabel: "Lihat alasan SIPENA",
        reason: "Data web adalah acuan utama untuk siswa.",
        rawType: "student",
        metadata: { rowIndex: mapping.rowIndex, studentId: mapping.studentId, excelName: mapping.excelName, webName: mapping.webName },
      }));
    }
  });

  plan.gradeOperations.forEach((operation) => {
    if (operation.action === "skip_empty") {
      items.push(makeItem("auto_fixable", {
        id: `skip-empty-${operation.rowIndex}-${operation.columnIndex}`,
        title: operationTitle(operation),
        description: "Sel kosong akan dilewati dan tidak menghapus nilai lama.",
        recommendedActionLabel: "Lewati sel kosong",
        detailLabel: "Lihat alasan SIPENA",
        reason: "Sel kosong tidak dianggap sebagai perintah menghapus nilai.",
        rawType: "grade_value",
        metadata: { rowIndex: operation.rowIndex, columnIndex: operation.columnIndex },
      }));
    }
  });

  return items;
}

function dedupeItems(items: SimplifiedConflictItem[]): SimplifiedConflictItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function makeGroup(
  level: SimplifiedConflictLevel,
  items: SimplifiedConflictItem[],
): SimplifiedConflictGroup {
  if (level === "auto_fixable") {
    return {
      id: "auto_fixable",
      level,
      title: "Perbaikan Otomatis",
      description: "SIPENA menemukan beberapa hal yang aman untuk diperbaiki tanpa mengubah nilai lama.",
      recommendedActionLabel: "Terapkan Semua yang Aman",
      secondaryActionLabel: "Lihat detail",
      canBulkApply: items.some((item) => item.canApplyRecommended),
      itemCount: items.length,
      blockingCount: 0,
      items,
    };
  }

  if (level === "needs_confirmation") {
    return {
      id: "needs_confirmation",
      level,
      title: "Butuh Konfirmasi",
      description: "SIPENA punya saran, tetapi perlu persetujuan Anda sebelum dipakai.",
      recommendedActionLabel: "Setujui Saran SIPENA",
      secondaryActionLabel: "Pilih manual",
      canBulkApply: items.some((item) => item.canApplyRecommended),
      itemCount: items.length,
      blockingCount: items.length,
      items,
    };
  }

  return {
    id: "manual_required",
    level,
    title: "Harus Dipilih Manual",
    description: "Ada data yang tidak bisa diputuskan otomatis agar nilai tidak masuk ke tempat yang salah.",
    recommendedActionLabel: "Pilih Sekarang",
    secondaryActionLabel: "Abaikan item",
    canBulkApply: false,
    itemCount: items.length,
    blockingCount: items.length,
    items,
  };
}

export function simplifyImportConflicts({
  plan,
  resolverState,
  updateMode = plan.updateMode,
}: SimplifyImportConflictsInput): ConflictSimplifierResult {
  const unresolvedConflicts = plan.conflicts.filter((conflict) => !hasResolvedSource(conflict, resolverState));
  const conflictItems = unresolvedConflicts.map((conflict) => classifyConflict(conflict, plan));
  const warningItems = plan.warnings
    .filter((warning) => !hasResolvedSource(warning, resolverState))
    .map((warning) => classifyConflict({
      code: warning.code,
      severity: warning.severity,
      message: warning.message,
      type: warning.code.includes("STUDENT") ? "student" : warning.code.includes("CONTEXT") || warning.code.includes("SEMESTER") ? "context" : "column",
      rowIndex: warning.rowIndex,
      columnIndex: warning.columnIndex,
    }, plan));

  const autoFixable = dedupeItems([
    ...autoItemsFromPlan(plan, updateMode),
    ...conflictItems.filter((item) => item.level === "auto_fixable"),
    ...warningItems.filter((item) => item.level === "auto_fixable"),
  ]);
  const needsConfirmation = dedupeItems([
    ...conflictItems.filter((item) => item.level === "needs_confirmation"),
    ...warningItems.filter((item) => item.level === "needs_confirmation"),
  ]);
  const manualRequired = dedupeItems([
    ...conflictItems.filter((item) => item.level === "manual_required"),
    ...warningItems.filter((item) => item.level === "manual_required"),
  ]);

  const autoFixableCount = autoFixable.length;
  const needsConfirmationCount = needsConfirmation.length;
  const manualRequiredCount = manualRequired.length;
  const blockingCount = manualRequiredCount + needsConfirmationCount;

  const headline = manualRequiredCount > 0
    ? "Perlu dicek sebelum import"
    : needsConfirmationCount > 0
      ? "Hampir siap diimport"
      : "Siap diimport";
  const description = manualRequiredCount > 0
    ? "Selesaikan pilihan manual terlebih dahulu agar nilai tidak masuk ke data yang salah."
    : needsConfirmationCount > 0
      ? "SIPENA hanya membutuhkan beberapa konfirmasi ringan."
      : "SIPENA tidak menemukan masalah penting. Mode aman aktif.";
  const primaryActionLabel = manualRequiredCount > 0
    ? "Pilih Sekarang"
    : needsConfirmationCount > 0
      ? "Setujui Saran SIPENA"
      : autoFixableCount > 0
        ? "Terapkan Semua yang Aman"
        : "Lanjut ke Preview";

  return {
    groups: [
      makeGroup("auto_fixable", autoFixable),
      makeGroup("needs_confirmation", needsConfirmation),
      makeGroup("manual_required", manualRequired),
    ],
    autoFixableCount,
    needsConfirmationCount,
    manualRequiredCount,
    blockingCount,
    isReadyForPreview: blockingCount === 0,
    headline,
    description,
    primaryActionLabel,
  };
}
