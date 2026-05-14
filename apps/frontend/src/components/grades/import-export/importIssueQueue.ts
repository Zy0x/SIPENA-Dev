import type {
  ColumnValueMode,
  ImportSelectionState,
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

export type InvalidIssueKind = "cell" | "row" | "column";
export type InvalidIssueRootCause =
  | "invalid_value"
  | "student_duplicate"
  | "student_missing"
  | "student_ambiguous"
  | "column_target"
  | "overwrite";

export interface InvalidIssue {
  id: string;
  kind: InvalidIssueKind;
  fixKind: "student" | "column" | "cell";
  row?: SpreadsheetPreviewRow;
  relatedRows?: SpreadsheetPreviewRow[];
  column?: SpreadsheetPreviewColumn;
  cell?: SpreadsheetPreviewCell;
  scope: InvalidIssueKind;
  rootCause: InvalidIssueRootCause;
  title: string;
  description: string;
  detailTitle: string;
  detailBullets: string[];
  primaryActionLabel: string;
  skipActionLabel: string;
}

export type HeaderConfigurationCategory = "target_required" | "overwrite" | "new_values" | "skipped";

export interface HeaderConfigurationIssue {
  id: string;
  column: SpreadsheetPreviewColumn;
  category: HeaderConfigurationCategory;
  categoryLabel: string;
  title: string;
  description: string;
  detailTitle: string;
  detailBullets: string[];
  counts: {
    newValues: number;
    skipped: number;
    overwrite: number;
    invalid: number;
    blocked: number;
    valid: number;
  };
  valueMode: ColumnValueMode;
  isResolved: boolean;
  requiresOverwriteConfirmation: boolean;
  recommendedActionLabel: string;
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "kosong";
  return String(value);
}

function textIncludes(value: string | undefined, patterns: string[]): boolean {
  const text = (value || "").toLowerCase();
  return patterns.some((pattern) => text.includes(pattern));
}

function duplicateStudentDetail(message?: string) {
  if (!textIncludes(message, ["duplikat", "duplicate", "lebih dari satu", "beberapa siswa", "ambiguous", "ambigu"])) return null;
  return {
    title: "Nama siswa perlu dipilih",
    bullets: [
      "Baris ini cocok ke lebih dari satu siswa atau sama dengan baris lain.",
      "Pilih siswa yang benar, atau lewati salah satu baris agar nilai tidak masuk ganda.",
    ],
  };
}

function missingStudentDetail(message?: string) {
  if (!textIncludes(message, ["missing_in_web", "belum ada", "tidak ditemukan", "siswa baru", "tidak cocok"])) return null;
  return {
    title: "Siswa belum ada di kelas",
    bullets: [
      "Baris Excel ini memiliki nilai, tetapi siswanya belum ditemukan di kelas aktif.",
      "Pilih siswa existing jika sebenarnya siswa yang sama, atau lewati baris ini.",
      "Jika memang siswa baru, tambahkan dulu di Data Siswa lalu upload ulang.",
    ],
  };
}

function duplicateTargetDetail(message?: string) {
  if (!textIncludes(message, ["target dobel", "target ganda", "duplicate column target", "target yang sama"])) return null;
  return {
    title: "Target kolom ganda",
    bullets: [
      "Kolom ini mengarah ke target yang sama dengan kolom lain.",
      "Pilih salah satu target atau lewati salah satu kolom.",
    ],
  };
}

export function buildCellDetailCopy(cell: SpreadsheetPreviewCell, row?: SpreadsheetPreviewRow, column?: SpreadsheetPreviewColumn) {
  const rawValue = formatValue(cell.rawValue ?? cell.displayValue);
  const rowContext = [row?.message, ...(row?.conflictIds || [])].join(" ");
  const duplicateStudent = duplicateStudentDetail(rowContext || cell.message);
  if (duplicateStudent) return duplicateStudent;
  const missingStudent = missingStudentDetail(rowContext || cell.message);
  if (missingStudent) return missingStudent;

  const duplicateTarget = duplicateTargetDetail([column?.targetLabel, column?.sourceHeader, ...(column?.conflictIds || []), cell.message].join(" "));
  if (duplicateTarget) return duplicateTarget;

  if (cell.status === "invalid") {
    return {
      title: "Nilai tidak valid",
      bullets: [
        `Excel berisi "${rawValue}".`,
        "Nilai harus angka 0-100.",
        "Lewati nilai ini atau perbaiki file Excel lalu upload ulang.",
      ],
    };
  }

  if (cell.status === "blocked" || cell.status === "manual_required" || cell.isBlockedByColumn || cell.isBlockedByRow || cell.isBlockedByTarget) {
    return {
      title: "Target belum aman",
      bullets: [
        "Nilai belum bisa disimpan karena siswa, kolom, atau targetnya belum aman.",
        "Atur item ini dulu agar nilai tidak masuk ke tempat yang salah.",
      ],
    };
  }

  if (cell.status === "changed" || cell.requiresConfirmation) {
    return {
      title: "Nilai lama berbeda",
      bullets: [
        `Nilai SIPENA ${formatValue(cell.oldValue)}, Excel ${rawValue}.`,
        "Default aman melewati nilai ini agar tidak menimpa tanpa konfirmasi.",
      ],
    };
  }

  return {
    title: "Detail nilai",
    bullets: [cell.message || "Nilai mengikuti aturan kolom saat ini."],
  };
}

export function buildRowDetailCopy(row: SpreadsheetPreviewRow) {
  const context = [row.message, ...(row.conflictIds || [])].join(" ");
  const duplicateStudent = duplicateStudentDetail(context);
  if (duplicateStudent) return duplicateStudent;
  const missingStudent = missingStudentDetail(context);
  if (missingStudent) return missingStudent;

  return {
    title: "Siswa perlu dicek",
    bullets: [
      row.message || "Baris siswa belum aman untuk dipakai otomatis.",
      "Pilih siswa yang benar atau lewati baris ini.",
    ],
  };
}

export function buildColumnDetailCopy(column: SpreadsheetPreviewColumn) {
  const duplicateTarget = duplicateTargetDetail([column.targetLabel, column.sourceHeader, ...(column.conflictIds || [])].join(" "));
  if (duplicateTarget) return duplicateTarget;

  if (column.status === "manual_required" || column.status === "blocked" || column.status === "invalid") {
    return {
      title: "Target kolom belum aman",
      bullets: [
        "Kolom ini memiliki nilai, tetapi targetnya belum aman.",
        "Pilih STS, SAS, tugas existing, buat target baru, atau lewati kolom.",
      ],
    };
  }

  if (column.status === "new_column" || column.isNewStructure) {
    return {
      title: "Kolom baru perlu konfirmasi",
      bullets: [
        "SIPENA membaca kolom ini sebagai target baru.",
        "Konfirmasi hanya jika BAB atau tugas baru memang benar.",
      ],
    };
  }

  return {
    title: "Detail kolom",
    bullets: [column.targetLabel ? `Target saat ini: ${column.targetLabel}.` : "Target kolom belum dipilih."],
  };
}

function isIssueCell(cell: SpreadsheetPreviewCell): boolean {
  if (cell.effectiveInclude === false || cell.isManuallySkipped) return false;
  if (cell.status === "invalid") return true;
  if (cell.isBlockedByColumn || cell.isBlockedByTarget) return false;
  return (cell.status === "blocked" || cell.status === "manual_required") && !cell.isBlockedByRow;
}

function cellPriority(cell: SpreadsheetPreviewCell): number {
  if (cell.status === "invalid") return 0;
  if (cell.status === "blocked" || cell.isBlockedByColumn || cell.isBlockedByRow || cell.isBlockedByTarget) return 1;
  return 2;
}

function rowRootCause(row: SpreadsheetPreviewRow): InvalidIssueRootCause {
  const context = [row.message, ...(row.conflictIds || [])].join(" ").toLowerCase();
  if (textIncludes(context, ["missing_in_web", "belum ada", "tidak ditemukan"])) return "student_missing";
  if (textIncludes(context, ["duplicate", "duplikat", "ganda"])) return "student_duplicate";
  return "student_ambiguous";
}

function normalizedKey(value: string | undefined): string {
  return (value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function duplicateStudentKey(row: SpreadsheetPreviewRow): string {
  if (row.studentId) return `student:${row.studentId}`;
  return `name:${normalizedKey(row.studentName)}:${normalizedKey(row.nisn)}`;
}

function columnRootCause(column: SpreadsheetPreviewColumn): InvalidIssueRootCause {
  const context = [column.targetLabel, column.sourceHeader, ...(column.conflictIds || [])].join(" ").toLowerCase();
  if (textIncludes(context, ["duplicate", "target ganda", "target dobel"])) return "column_target";
  return "column_target";
}

function isStudentRowIssue(row: SpreadsheetPreviewRow): boolean {
  const context = [row.message, ...(row.conflictIds || [])].join(" ").toLowerCase();
  return textIncludes(context, [
    "student:",
    "student_",
    "import_student_missing_in_web_for_value",
    "missing_in_web",
    "duplicate",
    "duplikat",
    "ambiguous",
    "ambigu",
    "belum ada",
    "tidak ditemukan",
  ]);
}

function isOnlyBlockedByStudentRow(cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow): boolean {
  return isStudentRowIssue(row)
    && cell.status !== "invalid"
    && Boolean(cell.isBlockedByRow)
    && !cell.isBlockedByColumn
    && !cell.isBlockedByTarget;
}

export function buildInvalidIssueQueue(model: SpreadsheetPreviewModel): InvalidIssue[] {
  const issues: Array<InvalidIssue & { priority: number }> = [];
  const studentIssueRows = model.rows.filter((row) =>
    row.status === "manual_required" && isStudentRowIssue(row));
  const duplicateRows = studentIssueRows.filter((row) => rowRootCause(row) === "student_duplicate");
  const duplicateGroups = new Map<string, SpreadsheetPreviewRow[]>();
  const groupedDuplicateRowIds = new Set<string>();

  duplicateRows.forEach((row) => {
    const key = duplicateStudentKey(row);
    duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), row]);
  });

  duplicateGroups.forEach((rows) => {
    if (!rows.length) return;
    rows.forEach((row) => groupedDuplicateRowIds.add(row.id));
    const representative = rows[0];
    const detail = buildRowDetailCopy(representative);
    const rowNumbers = rows.map((row) => row.rowIndex).join(", ");
    issues.push({
      id: `row-duplicate:${duplicateStudentKey(representative)}`,
      kind: "row",
      fixKind: "student",
      scope: "row",
      rootCause: "student_duplicate",
      row: representative,
      relatedRows: rows,
      title: "Nama siswa redundan",
      description: `${representative.studentName}: baris Excel ${rowNumbers} menuju siswa yang sama. Pilih satu baris yang dipakai.`,
      detailTitle: detail.title,
      detailBullets: [
        "Beberapa baris Excel cocok ke siswa yang sama.",
        "Bandingkan isi nilai per baris, pilih satu baris yang benar, lalu baris lain akan dilewati.",
      ],
      primaryActionLabel: "Pilih baris",
      skipActionLabel: "Lewati baris",
      priority: 2,
    });
  });

  for (const row of model.rows) {
    for (const cell of row.cells) {
      if (!isIssueCell(cell)) continue;
      if (isOnlyBlockedByStudentRow(cell, row)) continue;
      const column = model.columns.find((item) => item.id === cell.columnId);
      if (!column || column.type === "identity") continue;
      const detail = buildCellDetailCopy(cell, row, column);
      issues.push({
        id: `cell:${cell.id}`,
        kind: "cell",
        fixKind: "cell",
        scope: "cell",
        rootCause: cell.status === "invalid" ? "invalid_value" : "overwrite",
        row,
        column,
        cell,
        title: cell.status === "invalid" ? "Nilai tidak valid" : "Nilai perlu dicek",
        description: `${row.studentName} - ${column.header}: ${detail.bullets[0]}`,
        detailTitle: detail.title,
        detailBullets: detail.bullets,
        primaryActionLabel: "Atur item ini",
        skipActionLabel: "Lewati item",
        priority: cellPriority(cell),
      });
    }

    if (row.status === "manual_required" && isStudentRowIssue(row) && !groupedDuplicateRowIds.has(row.id)) {
      const detail = buildRowDetailCopy(row);
      issues.push({
        id: `row:${row.id}`,
        kind: "row",
        fixKind: "student",
        scope: "row",
        rootCause: rowRootCause(row),
        row,
        relatedRows: [row],
        title: "Siswa perlu dicek",
        description: `${row.studentName}: ${detail.bullets[0]}`,
        detailTitle: detail.title,
        detailBullets: detail.bullets,
        primaryActionLabel: "Atur siswa",
        skipActionLabel: "Lewati baris",
        priority: 2,
      });
    }
  }

  return issues
    .sort((left, right) => left.priority - right.priority)
    .map((issue) => ({
      id: issue.id,
      kind: issue.kind,
      fixKind: issue.fixKind,
      row: issue.row,
      relatedRows: issue.relatedRows,
      column: issue.column,
      cell: issue.cell,
      scope: issue.scope,
      rootCause: issue.rootCause,
      title: issue.title,
      description: issue.description,
      detailTitle: issue.detailTitle,
      detailBullets: issue.detailBullets,
      primaryActionLabel: issue.primaryActionLabel,
      skipActionLabel: issue.skipActionLabel,
    }));
}

export function getActiveImportIssues(model: SpreadsheetPreviewModel | null | undefined): InvalidIssue[] {
  return model ? buildInvalidIssueQueue(model) : [];
}

function columnCells(model: SpreadsheetPreviewModel, column: SpreadsheetPreviewColumn): SpreadsheetPreviewCell[] {
  return model.rows
    .map((row) => row.cells.find((cell) => cell.columnId === column.id))
    .filter(Boolean) as SpreadsheetPreviewCell[];
}

function hasColumnTargetIssue(column: SpreadsheetPreviewColumn, cells: SpreadsheetPreviewCell[]): boolean {
  if (column.effectiveInclude === false || column.isIgnored) return false;
  const hasUnresolvedConfirmation = column.status === "needs_check" && Boolean(column.conflictIds?.length);
  return column.status === "manual_required"
    || column.status === "blocked"
    || column.status === "invalid"
    || column.status === "new_column"
    || hasUnresolvedConfirmation
    || Boolean(column.isNewStructure)
    || cells.some((cell) => cell.isBlockedByColumn || cell.isBlockedByTarget);
}

function columnCounts(column: SpreadsheetPreviewColumn, cells: SpreadsheetPreviewCell[]): HeaderConfigurationIssue["counts"] {
  return {
    newValues: cells.filter((cell) => ["new_value", "manual_included", "included"].includes(cell.status) && cell.effectiveInclude !== false).length,
    skipped: cells.filter((cell) =>
      cell.effectiveInclude === false
      || cell.isAutoSkippedSameValue
      || ["skipped", "manual_skipped", "ignored"].includes(cell.status)).length,
    overwrite: cells.filter((cell) =>
      cell.requiresConfirmation
      || cell.status === "changed"
      || cell.status === "overwrite"
      || (
        cell.oldValue !== null
        && cell.oldValue !== undefined
        && cell.newValue !== null
        && cell.newValue !== undefined
        && String(cell.oldValue) !== String(cell.newValue)
      )).length,
    invalid: cells.filter((cell) => cell.status === "invalid").length,
    blocked: cells.filter((cell) => cell.status === "blocked" || cell.status === "manual_required" || cell.isBlockedByColumn || cell.isBlockedByTarget).length,
    valid: column.stats?.validValues ?? cells.filter((cell) => cell.newValue !== null && cell.newValue !== undefined && cell.status !== "invalid").length,
  };
}

function headerCategory(column: SpreadsheetPreviewColumn, counts: HeaderConfigurationIssue["counts"], hasTargetIssue: boolean): HeaderConfigurationCategory {
  if (hasTargetIssue) return "target_required";
  if (counts.overwrite > 0) return "overwrite";
  if (counts.newValues > 0) return "new_values";
  return "skipped";
}

function headerCategoryLabel(category: HeaderConfigurationCategory): string {
  if (category === "target_required") return "Perlu target";
  if (category === "overwrite") return "Akan ditimpa";
  if (category === "new_values") return "Akan ditambahkan";
  return "Akan dilewati";
}

function headerActionLabel(category: HeaderConfigurationCategory, valueMode: ColumnValueMode): string {
  if (category === "target_required") return "Atur target kolom";
  if (category === "overwrite" && valueMode !== "overwrite_existing") return "Pilih mode nilai";
  if (category === "overwrite") return "Konfirmasi timpa";
  if (category === "new_values") return "Isi nilai kosong";
  return "Lewati nilai";
}

export function buildHeaderConfigurationQueue(
  model: SpreadsheetPreviewModel | null | undefined,
  selectionState?: ImportSelectionState,
): HeaderConfigurationIssue[] {
  if (!model) return [];
  return model.columns
    .filter((column) => column.type !== "identity")
    .map((column) => {
      const cells = columnCells(model, column);
      const counts = columnCounts(column, cells);
      return { column, cells, counts };
    })
    .filter(({ column, counts }) =>
      column.effectiveInclude !== false
      || counts.valid > 0
      || counts.skipped > 0
      || counts.overwrite > 0
      || counts.newValues > 0
      || counts.blocked > 0)
    .map(({ column, cells, counts }) => {
      const setting = selectionState?.columnSettings[column.id];
      const valueMode = setting?.valueMode || column.effectiveValueMode || "fill_empty_only";
      const hasTargetIssue = hasColumnTargetIssue(column, cells);
      const category = headerCategory(column, counts, hasTargetIssue);
      const detail = buildColumnDetailCopy(column);
      const include = setting?.include ?? column.effectiveInclude !== false;
      const requiresOverwriteConfirmation = include && counts.overwrite > 0 && valueMode === "overwrite_existing" && !setting?.overwriteConfirmed && !column.overwriteConfirmed;
      const isResolved = !include
        || (
          !hasTargetIssue
          && (
            counts.overwrite === 0
            || (Boolean(setting) && (valueMode !== "overwrite_existing" || Boolean(setting?.overwriteConfirmed || column.overwriteConfirmed)))
          )
        );

      return {
        id: `header:${column.id}`,
        column,
        category,
        categoryLabel: headerCategoryLabel(category),
        title: column.header,
        description: `${headerCategoryLabel(category)} - ${counts.valid} nilai terbaca, ${counts.overwrite} timpa, ${counts.newValues} baru, ${counts.skipped} dilewati.`,
        detailTitle: detail.title,
        detailBullets: detail.bullets,
        counts,
        valueMode,
        isResolved,
        requiresOverwriteConfirmation,
        recommendedActionLabel: headerActionLabel(category, valueMode),
      };
    });
}

export function getActiveHeaderConfigurationIssues(
  model: SpreadsheetPreviewModel | null | undefined,
  selectionState?: ImportSelectionState,
): HeaderConfigurationIssue[] {
  return buildHeaderConfigurationQueue(model, selectionState).filter((issue) => !issue.isResolved);
}
