import type { ConflictSimplifierResolverState } from "./conflictSimplifier";
import { getSimplifiedConflictSourceId } from "./conflictSimplifier";
import { buildExecutableImportOperations, resolveOperationValue } from "./executableImportBuilder";
import type { CellValueMode, ColumnValueMode, ImportSelectionState } from "./importSelection";
import type { ColumnMapping, GradeOperation, ImportConflict, ImportPlan, StudentMapping, UpdateMode } from "./types";

export type PreviewCellStatus =
  | "unchanged"
  | "included"
  | "new_value"
  | "changed"
  | "new_column"
  | "needs_check"
  | "manual_required"
  | "ignored"
  | "invalid"
  | "skipped"
  | "manual_included"
  | "manual_skipped"
  | "blocked"
  | "overwrite";

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
  sourceHeader?: string;
  chapterId?: string;
  assignmentId?: string;
  chapterName?: string;
  assignmentName?: string;
  gradeType?: "assignment" | "sts" | "sas";
  isNewStructure?: boolean;
  isIgnored?: boolean;
  effectiveInclude?: boolean;
  effectiveValueMode?: ColumnValueMode;
  isManuallyIncluded?: boolean;
  isManuallySkipped?: boolean;
  overwriteConfirmed?: boolean;
  stats?: {
    validValues: number;
    willImport: number;
    willFill: number;
    skippedExisting: number;
    skippedManual: number;
    invalid: number;
    overwrite: number;
    blocked: number;
  };
  conflictIds?: string[];
};

export type SpreadsheetPreviewCell = {
  id: string;
  rowId: string;
  columnId: string;
  displayValue: string;
  rawValue?: string | number | null;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  suggestedValue?: number;
  resolvedValue?: number | null;
  acceptedSuggestedValue?: boolean;
  status: PreviewCellStatus;
  message?: string;
  recommendedActionLabel?: string;
  conflictIds?: string[];
  operationIds?: string[];
  editable?: boolean;
  effectiveInclude?: boolean;
  effectiveValueMode?: CellValueMode | ColumnValueMode;
  isManuallyIncluded?: boolean;
  isManuallySkipped?: boolean;
  isBlockedByColumn?: boolean;
  isBlockedByRow?: boolean;
  isBlockedByTarget?: boolean;
  canToggleInclude?: boolean;
  canOverwrite?: boolean;
  requiresConfirmation?: boolean;
  overwriteConfirmed?: boolean;
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
    includedCells: number;
    skippedCells: number;
    manualIncludedCells: number;
    manualSkippedCells: number;
    overwriteCells: number;
    blockedCells: number;
    overwriteNeedsConfirmation: number;
    missingInExcelStudents: number;
  };
};

export interface SpreadsheetPreviewResolverState extends ConflictSimplifierResolverState {
  ignoredCells?: string[];
}

export interface BuildSpreadsheetPreviewModelInput {
  plan: ImportPlan;
  resolverState?: SpreadsheetPreviewResolverState;
  updateMode?: UpdateMode;
  selectionState?: ImportSelectionState;
}

const identityColumns: SpreadsheetPreviewColumn[] = [
  { id: "identity-no", header: "No", type: "identity", status: "unchanged" },
  { id: "identity-nisn", header: "NISN", type: "identity", status: "unchanged" },
  { id: "identity-name", header: "Nama", type: "identity", status: "unchanged" },
];

const statusRank: Record<PreviewCellStatus, number> = {
  unchanged: 0,
  ignored: 1,
  skipped: 1,
  included: 2,
  new_value: 2,
  manual_included: 3,
  manual_skipped: 3,
  changed: 3,
  overwrite: 4,
  new_column: 4,
  needs_check: 5,
  blocked: 6,
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

function columnIdFor(columnIndex: number): string {
  return `excel-col-${columnIndex}`;
}

function rowIdFor(rowIndex: number): string {
  return `row-${rowIndex}`;
}

function operationCellId(rowIndex: number, columnIndex: number): string {
  return `${rowIdFor(rowIndex)}:${columnIdFor(columnIndex)}`;
}

function columnValueModeFromUpdateMode(updateMode: UpdateMode): ColumnValueMode {
  if (updateMode === "overwrite_existing" || updateMode === "overwrite_selected_columns") return "overwrite_existing";
  if (updateMode === "skip_existing") return "skip_existing";
  return "fill_empty_only";
}

function columnSelection(
  mapping: ColumnMapping,
  status: PreviewCellStatus,
  selectionState: ImportSelectionState | undefined,
  updateMode: UpdateMode,
) {
  const columnId = columnIdFor(mapping.columnIndex);
  const setting = selectionState?.columnSettings[columnId];
  const defaultInclude = status !== "ignored" && status !== "manual_required" && Boolean(mapping.target);
  const effectiveInclude = setting ? setting.include : defaultInclude;
  return {
    columnId,
    setting,
    effectiveInclude,
    effectiveValueMode: setting?.valueMode || columnValueModeFromUpdateMode(updateMode),
    isManuallyIncluded: setting?.include === true && !defaultInclude,
    isManuallySkipped: setting?.include === false,
    overwriteConfirmed: Boolean(setting?.overwriteConfirmed),
  };
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

function buildPreviewColumns(
  plan: ImportPlan,
  resolverState: SpreadsheetPreviewResolverState | undefined,
  selectionState: ImportSelectionState | undefined,
  updateMode: UpdateMode,
): SpreadsheetPreviewColumn[] {
  const gradeColumns = plan.columnMappings.map((mapping) => {
    const status = statusFromMapping(mapping, resolverState);
    const selection = columnSelection(mapping, status, selectionState, updateMode);
    return {
      id: selection.columnId,
      header: selection.setting?.headerOverride?.trim() || mapping.rawHeader,
      type: columnType(mapping),
      status: selection.isManuallySkipped ? "manual_skipped" : selection.isManuallyIncluded ? "manual_included" : status,
      targetLabel: targetLabel(mapping),
      sourceHeader: mapping.rawHeader,
      chapterId: mapping.target?.chapterId,
      assignmentId: mapping.target?.assignmentId,
      chapterName: mapping.target?.chapterName,
      assignmentName: mapping.target?.assignmentName,
      gradeType: mapping.target?.gradeType,
      isNewStructure: isNewStructure(mapping),
      isIgnored: status === "ignored" || !selection.effectiveInclude,
      effectiveInclude: selection.effectiveInclude,
      effectiveValueMode: selection.effectiveValueMode,
      isManuallyIncluded: selection.isManuallyIncluded,
      isManuallySkipped: selection.isManuallySkipped,
      overwriteConfirmed: selection.overwriteConfirmed,
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

function rowStatus(
  mapping: StudentMapping,
  resolverState?: SpreadsheetPreviewResolverState,
  forceManualRequired = false,
): PreviewCellStatus {
  if (resolverState?.ignoredRows?.includes(mapping.rowIndex)) return "ignored";
  if (forceManualRequired) return "manual_required";
  if (hasBlockingConflict(mapping.conflicts, resolverState)) return "manual_required";
  if (mapping.status === "missing_in_web" || mapping.status === "missing_in_excel") return "ignored";
  if (["ambiguous", "blocked", "missing"].includes(mapping.status)) return "manual_required";
  if (mapping.status === "warning" || mapping.status === "needs_confirmation") return "needs_check";
  return "unchanged";
}

type PreviewCellDecision = {
  status: PreviewCellStatus;
  effectiveInclude: boolean;
  effectiveValueMode: CellValueMode | ColumnValueMode;
  isManuallyIncluded: boolean;
  isManuallySkipped: boolean;
  isBlockedByColumn: boolean;
  isBlockedByRow: boolean;
  isBlockedByTarget: boolean;
  canToggleInclude: boolean;
  canOverwrite: boolean;
  requiresConfirmation: boolean;
  overwriteConfirmed: boolean;
};

function operationDecision(
  operation: GradeOperation | undefined,
  column: SpreadsheetPreviewColumn,
  row: StudentMapping,
  resolverState: SpreadsheetPreviewResolverState | undefined,
  updateMode: UpdateMode,
  selectionState: ImportSelectionState | undefined,
): PreviewCellDecision {
  const rowStatusValue = rowStatus(row, resolverState);
  const columnIndex = Number(column.id.replace("excel-col-", ""));
  const cellId = operation ? operationCellId(operation.rowIndex, operation.columnIndex) : `${rowIdFor(row.rowIndex)}:${column.id}`;
  const cellSetting = selectionState?.cellSettings[cellId];
  const columnMode = column.effectiveValueMode || columnValueModeFromUpdateMode(updateMode);
  const effectiveValueMode = cellSetting?.valueMode && cellSetting.valueMode !== "inherit_column" ? cellSetting.valueMode : columnMode;
  const resolvedValue = operation ? resolveOperationValue(operation, cellSetting) : null;
  const isManuallySkipped = cellSetting?.include === false || resolverState?.ignoredCells?.includes(`${row.rowIndex}:${columnIndex}`) || false;
  const isManuallyIncluded = cellSetting?.include === true;
  const isColumnExplicitlySkipped = column.isIgnored
    || resolverState?.ignoredColumns?.includes(columnIndex)
    || (column.status !== "manual_required" && !column.effectiveInclude)
    || false;
  const isBlockedByColumn = isColumnExplicitlySkipped;
  const isIgnoredByRow = resolverState?.ignoredRows?.includes(row.rowIndex) || rowStatusValue === "ignored" || false;
  const isBlockedByRow = rowStatusValue === "manual_required";
  const isBlockedByTarget = column.status === "manual_required" || !column.gradeType && column.type !== "identity";
  const overwriteConfirmed = Boolean(cellSetting?.overwriteConfirmed || column.overwriteConfirmed);
  const base: Omit<PreviewCellDecision, "status" | "effectiveInclude"> = {
    effectiveValueMode,
    isManuallyIncluded,
    isManuallySkipped,
    isBlockedByColumn,
    isBlockedByRow,
    isBlockedByTarget,
    canToggleInclude: Boolean(operation) && !isBlockedByRow && !isBlockedByTarget,
    canOverwrite: Boolean(operation?.existingValue !== null && operation?.existingValue !== undefined && resolvedValue !== null),
    requiresConfirmation: false,
    overwriteConfirmed,
  };

  if (isIgnoredByRow) return { ...base, status: "ignored", effectiveInclude: false };
  if (isBlockedByColumn) {
    return {
      ...base,
      status: column.status === "ignored" ? "ignored" : isManuallySkipped ? "manual_skipped" : "skipped",
      effectiveInclude: false,
    };
  }
  if (!operation) {
    const status = column.status === "new_column" ? "new_column" : column.status === "manual_required" ? "blocked" : "unchanged";
    return { ...base, status, effectiveInclude: false };
  }
  if (operation.action === "manual_skip_row" || operation.action === "manual_skip_column" || operation.action === "manual_skip_cell") {
    return { ...base, status: "manual_skipped", effectiveInclude: false };
  }
  if (isManuallySkipped) return { ...base, status: "manual_skipped", effectiveInclude: false };
  if (hasInvalidConflict(operation.conflicts, resolverState)) {
    return { ...base, status: "invalid", effectiveInclude: true };
  }
  if (isBlockedByRow) return { ...base, status: "blocked", effectiveInclude: false };
  if (hasBlockingConflict(operation.conflicts, resolverState)) return { ...base, status: "blocked", effectiveInclude: false };
  if (isBlockedByTarget) return { ...base, status: "blocked", effectiveInclude: false };
  if (resolvedValue === null) {
    if (operation.suggestedValue !== undefined) {
      return { ...base, status: "blocked", effectiveInclude: true, requiresConfirmation: true };
    }
    return { ...base, status: "skipped", effectiveInclude: false };
  }
  if (operation.action === "skip_empty") return { ...base, status: "skipped", effectiveInclude: false };

  const oldValue = operation.existingValue;
  const hasOldValue = oldValue !== null && oldValue !== undefined;
  if (!hasOldValue) {
    return {
      ...base,
      status: isManuallyIncluded ? "manual_included" : column.status === "new_column" ? "new_column" : "new_value",
      effectiveInclude: true,
    };
  }
  if (Number(oldValue) !== Number(resolvedValue)) {
    if (effectiveValueMode === "overwrite_existing") {
      if (!overwriteConfirmed) {
        return { ...base, status: "blocked", effectiveInclude: true, requiresConfirmation: true };
      }
      return { ...base, status: "overwrite", effectiveInclude: true };
    }
    return { ...base, status: isManuallyIncluded ? "manual_included" : "skipped", effectiveInclude: false };
  }
  return { ...base, status: isManuallyIncluded ? "manual_included" : "included", effectiveInclude: true };
}

function cellMessage(status: PreviewCellStatus): string {
  if (status === "included") return "Nilai ini akan ikut diimport.";
  if (status === "new_value") return "Nilai ini akan diisi ke sel yang masih kosong.";
  if (status === "changed") return "Nilai lama berbeda dari nilai Excel.";
  if (status === "new_column") return "Kolom ini berasal dari struktur baru yang perlu disetujui.";
  if (status === "needs_check") return "Bagian ini punya saran yang bisa dicek sebelum lanjut.";
  if (status === "manual_required") return "Bagian merah ini harus dipilih manual.";
  if (status === "ignored") return "Bagian ini tidak akan diimport.";
  if (status === "invalid") return "Nilai tidak valid dan tidak bisa diimport.";
  if (status === "skipped") return "Nilai ini akan dilewati.";
  if (status === "manual_included") return "Nilai ini dipilih manual untuk ikut import.";
  if (status === "manual_skipped") return "Nilai ini dilewati manual.";
  if (status === "blocked") return "Bagian ini perlu target atau konfirmasi sebelum bisa diimport.";
  if (status === "overwrite") return "Nilai lama akan ditimpa karena sudah dikonfirmasi.";
  return "Tidak ada perubahan.";
}

function recommendedAction(status: PreviewCellStatus): string | undefined {
  if (status === "included") return "Biarkan";
  if (status === "new_value") return "Biarkan";
  if (status === "changed") return "Biarkan default aman";
  if (status === "new_column") return "Setujui kolom baru";
  if (status === "needs_check") return "Setujui saran SIPENA";
  if (status === "manual_required") return "Pilih sekarang";
  if (status === "invalid") return "Abaikan nilai";
  if (status === "skipped") return "Include nilai ini";
  if (status === "manual_included") return "Biarkan";
  if (status === "manual_skipped") return "Include nilai ini";
  if (status === "blocked") return "Pilih target";
  if (status === "overwrite") return "Biarkan";
  return undefined;
}

function suggestedDisplayValue(operation: GradeOperation): string {
  const suggested = operation.suggestedValue === undefined ? "" : `Saran ${operation.suggestedValue}`;
  if (operation.rawValue === null || operation.rawValue === undefined || operation.rawValue === "") return suggested;
  return `${operation.rawValue} -> ${suggested}`;
}

function rowMessage(
  mapping: StudentMapping,
  status: PreviewCellStatus,
  rowConflicts: string[],
): string | undefined {
  const context = [mapping.status, ...mapping.conflicts.map((conflict) => conflict.code), ...rowConflicts].join(" ");
  if (context.includes("MISSING_IN_WEB") || mapping.status === "missing_in_web") {
    return "Siswa belum ada di kelas aktif. Pilih siswa existing, lewati baris, atau tambahkan siswa dulu lalu upload ulang.";
  }
  if (context.includes("DUPLICATE") || context.includes("AMBIGUOUS") || mapping.status === "ambiguous") {
    return "Baris ini cocok ke lebih dari satu siswa atau sama dengan baris lain. Pilih satu siswa yang benar atau lewati baris ini.";
  }
  if (status === "manual_required") return "Data siswa pada baris ini perlu dipilih manual.";
  if (status === "ignored") return "Baris ini tidak akan diimport.";
  return cellMessage(status);
}

function identityCell(rowId: string, columnId: string, displayValue: string, rowStatusValue: PreviewCellStatus, message?: string): SpreadsheetPreviewCell {
  return {
    id: `${rowId}:${columnId}`,
    rowId,
    columnId,
    displayValue,
    status: rowStatusValue === "manual_required" ? "manual_required" : rowStatusValue === "ignored" ? "ignored" : "unchanged",
    message: rowStatusValue === "manual_required" ? message || "Data siswa pada baris ini perlu dipilih manual." : undefined,
  };
}

export function buildSpreadsheetPreviewModel({
  plan,
  resolverState,
  updateMode = plan.updateMode,
  selectionState,
}: BuildSpreadsheetPreviewModelInput): SpreadsheetPreviewModel {
  const executablePlan = buildExecutableImportOperations({ plan, resolverState, updateMode, selectionState });
  const columns = buildPreviewColumns(plan, resolverState, selectionState, updateMode);
  const operationsByRowAndColumn = new Map<string, GradeOperation>();
  const operationsByRow = new Map<number, GradeOperation[]>();
  plan.gradeOperations.forEach((operation) => {
    operationsByRowAndColumn.set(`${operation.rowIndex}:${operation.columnIndex}`, operation);
    operationsByRow.set(operation.rowIndex, [...(operationsByRow.get(operation.rowIndex) || []), operation]);
  });

  const rows = plan.studentMappings.map((studentMapping, index) => {
    const rowId = `row-${studentMapping.rowIndex}`;
    const rowOperations = operationsByRow.get(studentMapping.rowIndex) || [];
    const unresolvedStudentConflicts = rowOperations
      .flatMap((operation) => operation.conflicts)
      .filter((conflict) => conflict.type === "student" && !isResolved(conflict, resolverState));
    const currentRowStatus = rowStatus(studentMapping, resolverState, unresolvedStudentConflicts.length > 0);
    const gradeCells = columns.slice(3).map((column) => {
      const columnIndex = Number(column.id.replace("excel-col-", ""));
      const operation = operationsByRowAndColumn.get(`${studentMapping.rowIndex}:${columnIndex}`);
      const decision = operationDecision(operation, column, studentMapping, resolverState, updateMode, selectionState);
      const status = decision.status;
      const cellId = `${rowId}:${column.id}`;
      const cellSetting = selectionState?.cellSettings[cellId];
      const resolvedValue = operation ? resolveOperationValue(operation, cellSetting) : null;
      const displayValue = operation
        ? operation.value === null || operation.value === undefined
          ? operation.suggestedValue === undefined ? "" : suggestedDisplayValue(operation)
          : String(operation.value)
        : "";
      const conflicts = operation?.conflicts || [];
      const cellConflictIds = [
        ...(column.conflictIds || []),
        ...conflictIdsFor(conflicts, resolverState),
      ];

      return {
        id: cellId,
        rowId,
        columnId: column.id,
        displayValue,
        rawValue: operation?.rawValue,
        oldValue: operation?.existingValue,
        newValue: resolvedValue ?? operation?.value ?? operation?.suggestedValue,
        suggestedValue: operation?.suggestedValue,
        resolvedValue,
        acceptedSuggestedValue: Boolean(cellSetting?.acceptedSuggestedValue),
        status,
        message: operation?.suggestedValue !== undefined && resolvedValue === null
          ? `Pakai nilai saran ${operation.suggestedValue} jika konversi ini benar.`
          : cellMessage(status),
        recommendedActionLabel: recommendedAction(status),
        conflictIds: cellConflictIds,
        operationIds: operation ? [operation.id] : [],
        editable: status === "invalid" || status === "changed",
        effectiveInclude: decision.effectiveInclude,
        effectiveValueMode: decision.effectiveValueMode,
        isManuallyIncluded: decision.isManuallyIncluded,
        isManuallySkipped: decision.isManuallySkipped,
        isBlockedByColumn: decision.isBlockedByColumn,
        isBlockedByRow: decision.isBlockedByRow,
        isBlockedByTarget: decision.isBlockedByTarget,
        canToggleInclude: decision.canToggleInclude,
        canOverwrite: decision.canOverwrite,
        requiresConfirmation: decision.requiresConfirmation,
        overwriteConfirmed: decision.overwriteConfirmed,
      } satisfies SpreadsheetPreviewCell;
    });

    const rowConflictIds = conflictIdsFor([...studentMapping.conflicts, ...unresolvedStudentConflicts], resolverState);
    const message = rowMessage(studentMapping, currentRowStatus, rowConflictIds);
    const cells = [
      identityCell(rowId, "identity-no", String(index + 1), currentRowStatus, message),
      identityCell(rowId, "identity-nisn", studentMapping.webNisn || studentMapping.excelNisn || "-", currentRowStatus, message),
      identityCell(rowId, "identity-name", studentMapping.webName || studentMapping.excelName || "Siswa tidak dikenal", currentRowStatus, message),
      ...gradeCells,
    ];

    return {
      id: rowId,
      rowIndex: studentMapping.rowIndex,
      studentId: studentMapping.studentId,
      studentName: studentMapping.webName || studentMapping.excelName || "Siswa tidak dikenal",
      nisn: studentMapping.webNisn || studentMapping.excelNisn,
      status: maxStatus(cells.map((cell) => cell.status)),
      message,
      conflictIds: rowConflictIds,
      cells,
    } satisfies SpreadsheetPreviewRow;
  });

  const allCells = rows.flatMap((row) => row.cells);
  const columnStats = new Map<string, NonNullable<SpreadsheetPreviewColumn["stats"]>>();
  columns.slice(3).forEach((column) => {
    const cells = rows.map((row) => row.cells.find((cell) => cell.columnId === column.id)).filter(Boolean) as SpreadsheetPreviewCell[];
    columnStats.set(column.id, {
      validValues: cells.filter((cell) => cell.newValue !== null && cell.newValue !== undefined && cell.status !== "invalid").length,
      willImport: cells.filter((cell) => cell.effectiveInclude && !cell.requiresConfirmation && !["invalid", "blocked"].includes(cell.status)).length,
      willFill: cells.filter((cell) => cell.status === "new_value" || cell.status === "manual_included").length,
      skippedExisting: cells.filter((cell) => cell.status === "skipped" && cell.oldValue !== null && cell.oldValue !== undefined).length,
      skippedManual: cells.filter((cell) => cell.status === "manual_skipped").length,
      invalid: cells.filter((cell) => cell.status === "invalid").length,
      overwrite: cells.filter((cell) => cell.status === "overwrite").length,
      blocked: cells.filter((cell) => cell.status === "blocked" || cell.requiresConfirmation).length,
    });
  });
  const columnsWithStats = columns.map((column) => ({
    ...column,
    stats: columnStats.get(column.id) || column.stats,
  }));
  const summary = {
    totalRows: rows.length,
    totalColumns: columns.length,
    readyCells: allCells.filter((cell) => ["unchanged", "included", "new_value", "manual_included", "overwrite"].includes(cell.status)).length,
    newValueCells: allCells.filter((cell) => cell.status === "new_value").length,
    changedCells: allCells.filter((cell) => cell.status === "changed").length,
    newColumns: columns.filter((column) => column.status === "new_column").length,
    needsCheck: allCells.filter((cell) => cell.status === "needs_check").length
      + columns.filter((column) => column.status === "needs_check").length,
    manualRequired: allCells.filter((cell) => cell.status === "manual_required" || cell.status === "blocked" || cell.requiresConfirmation).length
      + columns.filter((column) => column.status === "manual_required" || column.status === "blocked").length,
    ignoredCells: allCells.filter((cell) => cell.status === "ignored" || cell.status === "skipped" || cell.status === "manual_skipped").length,
    invalidCells: allCells.filter((cell) => cell.status === "invalid").length,
    includedCells: executablePlan.summary.executableCount,
    skippedCells: executablePlan.summary.skippedEmptyCount + executablePlan.summary.skippedExistingCount,
    manualIncludedCells: allCells.filter((cell) => cell.status === "manual_included").length,
    manualSkippedCells: executablePlan.summary.skippedManualCount,
    overwriteCells: allCells.filter((cell) => cell.status === "overwrite").length,
    blockedCells: executablePlan.summary.blockedCount,
    overwriteNeedsConfirmation: executablePlan.summary.overwriteNeedsConfirmationCount,
    missingInExcelStudents: plan.missingInExcelStudents.length,
  };

  return { columns: columnsWithStats, rows, summary };
}
