import type {
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
  row?: SpreadsheetPreviewRow;
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
  return cell.status === "invalid"
    || cell.status === "blocked"
    || cell.status === "manual_required"
    || cell.isBlockedByColumn
    || cell.isBlockedByRow
    || cell.isBlockedByTarget;
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

    if (row.status === "manual_required" && isStudentRowIssue(row)) {
      const detail = buildRowDetailCopy(row);
      issues.push({
        id: `row:${row.id}`,
        kind: "row",
        scope: "row",
        rootCause: rowRootCause(row),
        row,
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

  for (const column of model.columns) {
    if (column.type === "identity" || column.effectiveInclude === false || column.isIgnored) continue;
    if (column.status !== "manual_required" && column.status !== "blocked" && column.status !== "invalid") continue;
    const detail = buildColumnDetailCopy(column);
    issues.push({
      id: `column:${column.id}`,
      kind: "column",
      scope: "column",
      rootCause: columnRootCause(column),
      column,
      title: "Target kolom perlu dicek",
      description: `${column.header}: ${detail.bullets[0]}`,
      detailTitle: detail.title,
      detailBullets: detail.bullets,
      primaryActionLabel: "Atur kolom",
      skipActionLabel: "Lewati kolom",
      priority: 1,
    });
  }

  return issues
    .sort((left, right) => left.priority - right.priority)
    .map((issue) => ({
      id: issue.id,
      kind: issue.kind,
      row: issue.row,
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
