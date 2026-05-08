import type { ConflictSimplifierResolverState } from "./conflictSimplifier";
import { getSimplifiedConflictSourceId } from "./conflictSimplifier";
import type { ColumnMapping, GradeOperation, ImportConflict, ImportPlan, StudentMapping, UpdateMode } from "./types";

export type PreviewCellStatus =
  | "unchanged"
  | "new_value"
  | "changed"
  | "new_column"
  | "needs_check"
  | "manual_required"
  | "ignored"
  | "invalid";

export type PreviewColumnType =
  | "identity"
  | "assignment"
  | "sts"
  | "sas"
  | "derived"
  | "unknown";

export type SpreadsheetPreviewColumn = {
  id: string;
  header: string;
  type: PreviewColumnType;
  status: PreviewCellStatus;
  targetLabel?: string;
  chapterName?: string;
  assignmentName?: string;
  gradeType?: "assignment" | "sts" | "sas";
  isNewStructure?: boolean;
  isIgnored?: boolean;
  conflictIds?: string[];
};

export type SpreadsheetPreviewCell = {
  id: string;
  rowId: string;
  columnId: string;
  displayValue: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  status: PreviewCellStatus;
  message?: string;
  recommendedActionLabel?: string;
  conflictIds?: string[];
  operationIds?: string[];
  editable?: boolean;
};

export type SpreadsheetPreviewRow = {
  id: string;
  rowIndex: number;
  studentId?: string;
  studentName: string;
  nisn?: string;
  status: PreviewCellStatus;
  message?: string;
  conflictIds?: string[];
  cells: SpreadsheetPreviewCell[];
};

export type SpreadsheetPreviewModel = {
  columns: SpreadsheetPreviewColumn[];
  rows: SpreadsheetPreviewRow[];
  summary: {
    totalRows: number;
    totalColumns: number;
    readyCells: number;
    newValueCells: number;
    changedCells: number;
    newColumns: number;
    needsCheck: number;
    manualRequired: number;
    ignoredCells: number;
    invalidCells: number;
  };
};

export interface SpreadsheetPreviewResolverState extends ConflictSimplifierResolverState {
  ignoredCells?: string[];
}

export interface BuildSpreadsheetPreviewModelInput {
  plan: ImportPlan;
  resolverState?: SpreadsheetPreviewResolverState;
  updateMode?: UpdateMode;
}

const identityColumns: SpreadsheetPreviewColumn[] = [
  { id: "identity-no", header: "No", type: "identity", status: "unchanged" },
  { id: "identity-nisn", header: "NISN", type: "identity", status: "unchanged" },
  { id: "identity-name", header: "Nama", type: "identity", status: "unchanged" },
];

const statusRank: Record<PreviewCellStatus, number> = {
  unchanged: 0,
  ignored: 1,
  new_value: 2,
  changed: 3,
  new_column: 4,
  needs_check: 5,
  invalid: 6,
  manual_required: 7,
};

function maxStatus(statuses: PreviewCellStatus[]): PreviewCellStatus {
  return statuses.reduce<PreviewCellStatus>((current, next) =>
    statusRank[next] > statusRank[current] ? next : current, "unchanged");
}

function isResolved(
  item: ImportConflict | { type?: string; code: string; rowIndex?: number; columnIndex?: number; message?: string },
  resolverState?: SpreadsheetPreviewResolverState,
): boolean {
  const key = getSimplifiedConflictSourceId(item);
  if (resolverState?.resolvedConflictKeys?.includes(key)) return true;
  if (item.rowIndex && resolverState?.ignoredRows?.includes(item.rowIndex)) return true;
  if (item.rowIndex && resolverState?.studentOverrides?.[String(item.rowIndex)]) return true;
  if (item.columnIndex && resolverState?.ignoredColumns?.includes(item.columnIndex)) return true;
  if (item.columnIndex && resolverState?.columnOverrides?.[String(item.columnIndex)]) return true;
  return false;
}

function conflictIdsFor(
  items: Array<ImportConflict | { type?: string; code: string; rowIndex?: number; columnIndex?: number; message?: string }>,
  resolverState?: SpreadsheetPreviewResolverState,
): string[] {
  return items
    .filter((item) => !isResolved(item, resolverState))
    .map(getSimplifiedConflictSourceId);
}

function hasBlockingConflict(conflicts: ImportConflict[], resolverState?: SpreadsheetPreviewResolverState): boolean {
  return conflicts.some((conflict) => conflict.severity === "blocked" && !isResolved(conflict, resolverState));
}

function hasInvalidConflict(conflicts: ImportConflict[], resolverState?: SpreadsheetPreviewResolverState): boolean {
  return conflicts.some((conflict) =>
    !isResolved(conflict, resolverState)
    && (conflict.type === "grade_value" || conflict.code.includes("INVALID") || conflict.code.includes("TEXTUAL")),
  );
}

function statusFromMapping(mapping: ColumnMapping, resolverState?: SpreadsheetPreviewResolverState): PreviewCellStatus {
  if (resolverState?.ignoredColumns?.includes(mapping.columnIndex)) return "ignored";
  if (mapping.parsedHeader.derived || mapping.parsedHeader.reserved) return "ignored";
  if (hasBlockingConflict(mapping.conflicts, resolverState)) return "manual_required";
  if (mapping.status === "blocked" || mapping.status === "ambiguous" || mapping.status === "missing") return "manual_required";
  if (mapping.status === "needs_confirmation" || mapping.status === "warning") {
    if (isNewStructure(mapping)) return "new_column";
    return "needs_check";
  }
  if (isNewStructure(mapping)) return "new_column";
  return "unchanged";
}

function isNewStructure(mapping: ColumnMapping): boolean {
  if (!mapping.target) return false;
  if (mapping.target.gradeType !== "assignment") return false;
  return !mapping.target.assignmentId || Boolean(mapping.conflicts.concat(mapping.warnings as unknown as ImportConflict[]).some((item) =>
    ["COLUMN_CREATE_ASSIGNMENT_SUGGESTED", "COLUMN_CREATE_CHAPTER_AND_ASSIGNMENT_SUGGESTED", "IMPORT_NEW_STRUCTURE_NOT_CONFIRMED"].includes(item.code),
  ));
}

function columnType(mapping: ColumnMapping): PreviewColumnType {
  if (mapping.parsedHeader.derived || mapping.parsedHeader.reserved) return "derived";
  if (mapping.target?.gradeType === "assignment" || mapping.parsedHeader.headerType === "assignment") return "assignment";
  if (mapping.target?.gradeType === "sts" || mapping.parsedHeader.headerType === "sts") return "sts";
  if (mapping.target?.gradeType === "sas" || mapping.parsedHeader.headerType === "sas") return "sas";
  return "unknown";
}

function targetLabel(mapping: ColumnMapping): string | undefined {
  if (!mapping.target) return undefined;
  if (mapping.target.gradeType === "sts") return "STS";
  if (mapping.target.gradeType === "sas") return "SAS";
  return [mapping.target.chapterName, mapping.target.assignmentName].filter(Boolean).join(" - ") || mapping.rawHeader;
}

function buildPreviewColumns(plan: ImportPlan, resolverState?: SpreadsheetPreviewResolverState): SpreadsheetPreviewColumn[] {
  const gradeColumns = plan.columnMappings.map((mapping) => {
    const status = statusFromMapping(mapping, resolverState);
    return {
      id: `excel-col-${mapping.columnIndex}`,
      header: mapping.rawHeader,
      type: columnType(mapping),
      status,
      targetLabel: targetLabel(mapping),
      chapterName: mapping.target?.chapterName,
      assignmentName: mapping.target?.assignmentName,
      gradeType: mapping.target?.gradeType,
      isNewStructure: isNewStructure(mapping),
      isIgnored: status === "ignored",
      conflictIds: conflictIdsFor([
        ...mapping.conflicts,
        ...mapping.warnings.map((warning) => ({
          type: "column",
          code: warning.code,
          severity: warning.severity,
          message: warning.message,
          columnIndex: warning.columnIndex,
        })),
      ], resolverState),
    } satisfies SpreadsheetPreviewColumn;
  });

  return [...identityColumns, ...gradeColumns];
}

function rowStatus(mapping: StudentMapping, resolverState?: SpreadsheetPreviewResolverState): PreviewCellStatus {
  if (resolverState?.ignoredRows?.includes(mapping.rowIndex)) return "ignored";
  if (hasBlockingConflict(mapping.conflicts, resolverState)) return "manual_required";
  if (["ambiguous", "blocked", "missing", "missing_in_web"].includes(mapping.status)) return "manual_required";
  if (mapping.status === "warning" || mapping.status === "needs_confirmation") return "needs_check";
  return "unchanged";
}

function operationStatus(
  operation: GradeOperation | undefined,
  column: SpreadsheetPreviewColumn,
  row: StudentMapping,
  resolverState: SpreadsheetPreviewResolverState | undefined,
  updateMode: UpdateMode,
): PreviewCellStatus {
  if (resolverState?.ignoredRows?.includes(row.rowIndex)) return "ignored";
  if (column.isIgnored || resolverState?.ignoredColumns?.includes(Number(column.id.replace("excel-col-", "")))) return "ignored";
  if (!operation) return column.status === "manual_required" ? "manual_required" : column.status === "new_column" ? "new_column" : "unchanged";
  if (resolverState?.ignoredCells?.includes(`${operation.rowIndex}:${operation.columnIndex}`)) return "ignored";
  if (hasInvalidConflict(operation.conflicts, resolverState)) return "invalid";
  if (hasBlockingConflict(operation.conflicts, resolverState)) return "manual_required";
  if (column.status === "manual_required" || rowStatus(row, resolverState) === "manual_required") return "manual_required";
  if (column.status === "new_column") return "new_column";
  if (operation.value === null || operation.action === "skip_empty") return "ignored";

  const oldValue = operation.existingValue;
  const hasOldValue = oldValue !== null && oldValue !== undefined;
  if (!hasOldValue) return "new_value";
  if (Number(oldValue) !== Number(operation.value)) {
    if (operation.action === "overwrite" || updateMode === "overwrite_existing" || updateMode === "overwrite_selected_columns") return "changed";
    return "needs_check";
  }
  return "unchanged";
}

function cellMessage(status: PreviewCellStatus): string {
  if (status === "new_value") return "Nilai ini akan diisi ke sel yang masih kosong.";
  if (status === "changed") return "Nilai lama berbeda dari nilai Excel.";
  if (status === "new_column") return "Kolom ini berasal dari struktur baru yang perlu disetujui.";
  if (status === "needs_check") return "Bagian ini punya saran yang bisa dicek sebelum lanjut.";
  if (status === "manual_required") return "Bagian merah ini harus dipilih manual.";
  if (status === "ignored") return "Bagian ini tidak akan diimport.";
  if (status === "invalid") return "Nilai tidak valid dan tidak bisa diimport.";
  return "Tidak ada perubahan.";
}

function recommendedAction(status: PreviewCellStatus): string | undefined {
  if (status === "new_value") return "Biarkan";
  if (status === "changed") return "Biarkan mode aman";
  if (status === "new_column") return "Setujui kolom baru";
  if (status === "needs_check") return "Setujui saran SIPENA";
  if (status === "manual_required") return "Pilih sekarang";
  if (status === "invalid") return "Abaikan nilai";
  return undefined;
}

function identityCell(rowId: string, columnId: string, displayValue: string, rowStatusValue: PreviewCellStatus): SpreadsheetPreviewCell {
  return {
    id: `${rowId}:${columnId}`,
    rowId,
    columnId,
    displayValue,
    status: rowStatusValue === "manual_required" ? "manual_required" : rowStatusValue === "ignored" ? "ignored" : "unchanged",
    message: rowStatusValue === "manual_required" ? "Data siswa pada baris ini perlu dipilih manual." : undefined,
  };
}

export function buildSpreadsheetPreviewModel({
  plan,
  resolverState,
  updateMode = plan.updateMode,
}: BuildSpreadsheetPreviewModelInput): SpreadsheetPreviewModel {
  const columns = buildPreviewColumns(plan, resolverState);
  const operationsByRowAndColumn = new Map<string, GradeOperation>();
  plan.gradeOperations.forEach((operation) => {
    operationsByRowAndColumn.set(`${operation.rowIndex}:${operation.columnIndex}`, operation);
  });

  const rows = plan.studentMappings.map((studentMapping, index) => {
    const rowId = `row-${studentMapping.rowIndex}`;
    const currentRowStatus = rowStatus(studentMapping, resolverState);
    const gradeCells = columns.slice(3).map((column) => {
      const columnIndex = Number(column.id.replace("excel-col-", ""));
      const operation = operationsByRowAndColumn.get(`${studentMapping.rowIndex}:${columnIndex}`);
      const status = operationStatus(operation, column, studentMapping, resolverState, updateMode);
      const displayValue = operation
        ? operation.value === null || operation.value === undefined ? "" : String(operation.value)
        : "";
      const conflicts = operation?.conflicts || [];
      const cellConflictIds = [
        ...(column.conflictIds || []),
        ...conflictIdsFor(conflicts, resolverState),
      ];

      return {
        id: `${rowId}:${column.id}`,
        rowId,
        columnId: column.id,
        displayValue,
        oldValue: operation?.existingValue,
        newValue: operation?.value,
        status,
        message: cellMessage(status),
        recommendedActionLabel: recommendedAction(status),
        conflictIds: cellConflictIds,
        operationIds: operation ? [operation.id] : [],
        editable: status === "invalid" || status === "changed",
      } satisfies SpreadsheetPreviewCell;
    });

    const cells = [
      identityCell(rowId, "identity-no", String(index + 1), currentRowStatus),
      identityCell(rowId, "identity-nisn", studentMapping.webNisn || studentMapping.excelNisn || "-", currentRowStatus),
      identityCell(rowId, "identity-name", studentMapping.webName || studentMapping.excelName || "Siswa tidak dikenal", currentRowStatus),
      ...gradeCells,
    ];

    return {
      id: rowId,
      rowIndex: studentMapping.rowIndex,
      studentId: studentMapping.studentId,
      studentName: studentMapping.webName || studentMapping.excelName || "Siswa tidak dikenal",
      nisn: studentMapping.webNisn || studentMapping.excelNisn,
      status: maxStatus(cells.map((cell) => cell.status)),
      message: cellMessage(maxStatus(cells.map((cell) => cell.status))),
      conflictIds: conflictIdsFor(studentMapping.conflicts, resolverState),
      cells,
    } satisfies SpreadsheetPreviewRow;
  });

  const allCells = rows.flatMap((row) => row.cells);
  const summary = {
    totalRows: rows.length,
    totalColumns: columns.length,
    readyCells: allCells.filter((cell) => ["unchanged", "new_value"].includes(cell.status)).length,
    newValueCells: allCells.filter((cell) => cell.status === "new_value").length,
    changedCells: allCells.filter((cell) => cell.status === "changed").length,
    newColumns: columns.filter((column) => column.status === "new_column").length,
    needsCheck: allCells.filter((cell) => cell.status === "needs_check").length
      + columns.filter((column) => column.status === "needs_check").length,
    manualRequired: allCells.filter((cell) => cell.status === "manual_required").length
      + columns.filter((column) => column.status === "manual_required").length,
    ignoredCells: allCells.filter((cell) => cell.status === "ignored").length,
    invalidCells: allCells.filter((cell) => cell.status === "invalid").length,
  };

  return { columns, rows, summary };
}
