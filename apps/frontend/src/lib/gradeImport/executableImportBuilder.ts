import type { ConflictSimplifierResolverState } from "./conflictSimplifier";
import { getSimplifiedConflictSourceId } from "./conflictSimplifier";
import type { CellImportSetting, CellValueMode, ColumnValueMode, ImportSelectionState } from "./importSelection";
import type { ColumnMapping, GradeOperation, GradeTarget, ImportConflict, ImportPlan, StudentMapping, UpdateMode } from "./types";

export type ExecutableImportAction = "fill_empty" | "overwrite";

export type ExecutableImportBlockedReason =
  | "blocked_operation"
  | "invalid_value"
  | "missing_student"
  | "unresolved_student"
  | "unresolved_column"
  | "structure_unconfirmed"
  | "overwrite_needs_confirmation";

export type ExecutableImportSkippedReason =
  | "empty_value"
  | "existing_value"
  | "manual_skip";

export interface ExecutableImportOperation {
  operationId: string;
  operation: GradeOperation;
  rowIndex: number;
  columnIndex: number;
  sourceRowIndex?: number;
  sourceColumnIndex?: number;
  studentId: string;
  target: GradeTarget;
  value: number;
  action: ExecutableImportAction;
}

export interface ExecutableImportBlockedItem {
  operationId: string;
  rowIndex: number;
  columnIndex: number;
  reason: ExecutableImportBlockedReason;
  message: string;
  conflictCodes: string[];
}

export interface ExecutableImportSkippedItem {
  operationId: string;
  rowIndex: number;
  columnIndex: number;
  reason: ExecutableImportSkippedReason;
  message: string;
}

export interface ExecutableImportSummary {
  totalOperations: number;
  executableCount: number;
  fillEmptyCount: number;
  overwriteCount: number;
  skippedEmptyCount: number;
  skippedExistingCount: number;
  skippedManualCount: number;
  blockedCount: number;
  invalidCount: number;
  unresolvedStudentCount: number;
  unresolvedColumnCount: number;
  overwriteNeedsConfirmationCount: number;
}

export interface ExecutableImportPlan {
  operations: ExecutableImportOperation[];
  blockedItems: ExecutableImportBlockedItem[];
  skippedItems: ExecutableImportSkippedItem[];
  summary: ExecutableImportSummary;
}

export interface BuildExecutableImportOperationsInput {
  plan: ImportPlan;
  resolverState?: ConflictSimplifierResolverState & { ignoredCells?: string[] };
  selectionState?: ImportSelectionState;
  updateMode?: UpdateMode;
}

type ColumnOverride = {
  kind?: string;
  confirmed?: boolean;
  assignmentId?: string;
  target?: GradeTarget;
};

function columnIdFor(columnIndex: number): string {
  return `excel-col-${columnIndex}`;
}

function rowIdFor(rowIndex: number): string {
  return `row-${rowIndex}`;
}

function cellIdFor(rowIndex: number, columnIndex: number): string {
  return `${rowIdFor(rowIndex)}:${columnIdFor(columnIndex)}`;
}

function hasExistingGrade(operation: GradeOperation): boolean {
  return operation.existingValue !== null && operation.existingValue !== undefined;
}

function isInvalidOperation(operation: GradeOperation): boolean {
  return operation.conflicts.some((conflict) =>
    conflict.type === "grade_value"
    || conflict.code.includes("INVALID")
    || conflict.code.includes("TEXTUAL"),
  );
}

function isValidGradeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

export function resolveOperationValue(
  operation: GradeOperation,
  cellSetting?: CellImportSetting,
): number | null {
  if (isValidGradeNumber(operation.value)) return operation.value;
  if (cellSetting?.acceptedSuggestedValue && isValidGradeNumber(operation.suggestedValue)) {
    return operation.suggestedValue;
  }
  if (isValidGradeNumber(cellSetting?.resolvedValue)) return cellSetting.resolvedValue;
  return null;
}

function isResolved(
  conflict: ImportConflict,
  resolverState: BuildExecutableImportOperationsInput["resolverState"],
): boolean {
  const key = getSimplifiedConflictSourceId(conflict);
  if (resolverState?.resolvedConflictKeys?.includes(key)) return true;
  if (conflict.rowIndex && resolverState?.ignoredRows?.includes(conflict.rowIndex)) return true;
  if (conflict.rowIndex && resolverState?.studentOverrides?.[String(conflict.rowIndex)]) return true;
  if (conflict.columnIndex && resolverState?.ignoredColumns?.includes(conflict.columnIndex)) return true;
  if (conflict.columnIndex && resolverState?.columnOverrides?.[String(conflict.columnIndex)]) return true;
  return false;
}

function unresolvedConflicts(
  operation: GradeOperation,
  resolverState: BuildExecutableImportOperationsInput["resolverState"],
): ImportConflict[] {
  return operation.conflicts.filter((conflict) => !isResolved(conflict, resolverState));
}

function columnOverrideFor(
  resolverState: BuildExecutableImportOperationsInput["resolverState"],
  columnIndex: number,
): ColumnOverride | undefined {
  return resolverState?.columnOverrides?.[String(columnIndex)] as ColumnOverride | undefined;
}

function effectiveStudentId(
  mapping: StudentMapping | undefined,
  resolverState: BuildExecutableImportOperationsInput["resolverState"],
  rowIndex: number,
): string | undefined {
  return resolverState?.studentOverrides?.[String(rowIndex)] || mapping?.studentId;
}

function effectiveColumnTarget(
  mapping: ColumnMapping | undefined,
  operation: GradeOperation,
  override: ColumnOverride | undefined,
): GradeTarget | undefined {
  if (override?.kind === "ignore") return undefined;
  if (override?.target) return override.target;
  if (override?.kind === "sts") return { gradeType: "sts" };
  if (override?.kind === "sas") return { gradeType: "sas" };
  if (override?.kind === "existing_assignment" && override.assignmentId) {
    return {
      ...(mapping?.target || operation.target),
      gradeType: "assignment",
      assignmentId: override.assignmentId,
    };
  }
  return mapping?.target || operation.target;
}

function isStructureConfirmed(
  target: GradeTarget | undefined,
  override: ColumnOverride | undefined,
): boolean {
  if (!target) return false;
  if (target.gradeType !== "assignment") return true;
  if (target.assignmentId) return true;
  return Boolean(override && ["create_assignment", "create_chapter_and_assignment"].includes(override.kind || "") && override.confirmed);
}

function hasExecutableAssignmentTarget(target: GradeTarget | undefined): boolean {
  if (!target) return false;
  if (target.gradeType === "assignment") return Boolean(target.assignmentId);
  return !target.assignmentId;
}

function hasExplicitConfirmation(
  operation: GradeOperation,
  cellSetting: CellImportSetting | undefined,
  hasStudentOverride: boolean,
  hasColumnOverride: boolean,
): boolean {
  return operation.action !== "needs_confirmation"
    || hasStudentOverride
    || hasColumnOverride
    || Boolean(cellSetting?.acceptedSuggestedValue)
    || isValidGradeNumber(cellSetting?.resolvedValue);
}

function effectiveValueMode(
  operation: GradeOperation,
  updateMode: UpdateMode,
  selectionState: ImportSelectionState | undefined,
): ColumnValueMode | CellValueMode | UpdateMode {
  const columnId = columnIdFor(operation.columnIndex);
  const cellId = cellIdFor(operation.rowIndex, operation.columnIndex);
  const cellSetting = selectionState?.cellSettings[cellId];
  const columnSetting = selectionState?.columnSettings[columnId];
  if (cellSetting?.valueMode && cellSetting.valueMode !== "inherit_column") return cellSetting.valueMode;
  if (columnSetting?.valueMode) return columnSetting.valueMode;
  return updateMode || operation.updateMode;
}

function overwriteConfirmed(
  operation: GradeOperation,
  selectionState: ImportSelectionState | undefined,
): boolean {
  const columnId = columnIdFor(operation.columnIndex);
  const cellId = cellIdFor(operation.rowIndex, operation.columnIndex);
  const cellSetting = selectionState?.cellSettings[cellId];
  const columnSetting = selectionState?.columnSettings[columnId];
  return Boolean(cellSetting?.overwriteConfirmed || columnSetting?.overwriteConfirmed);
}

function isManuallySkipped(
  operation: GradeOperation,
  resolverState: BuildExecutableImportOperationsInput["resolverState"],
  selectionState: ImportSelectionState | undefined,
): boolean {
  const columnId = columnIdFor(operation.columnIndex);
  const cellId = cellIdFor(operation.rowIndex, operation.columnIndex);
  return Boolean(
    resolverState?.ignoredRows?.includes(operation.rowIndex)
    || resolverState?.ignoredColumns?.includes(operation.columnIndex)
    || resolverState?.ignoredCells?.includes(`${operation.rowIndex}:${operation.columnIndex}`)
    || selectionState?.columnSettings[columnId]?.include === false
    || selectionState?.cellSettings[cellId]?.include === false
  );
}

function skippedItem(operation: GradeOperation, reason: ExecutableImportSkippedReason, message: string): ExecutableImportSkippedItem {
  return {
    operationId: operation.id,
    rowIndex: operation.rowIndex,
    columnIndex: operation.columnIndex,
    reason,
    message,
  };
}

function manualSkipMessage(operation: GradeOperation): string | null {
  if (operation.action === "manual_skip_row") return "Baris dilewati sesuai pilihan user.";
  if (operation.action === "manual_skip_column") return "Kolom dilewati sesuai pilihan user.";
  if (operation.action === "manual_skip_cell") return "Sel nilai dilewati sesuai pilihan user.";
  return null;
}

function blockedItem(
  operation: GradeOperation,
  reason: ExecutableImportBlockedReason,
  message: string,
  conflicts: ImportConflict[] = [],
): ExecutableImportBlockedItem {
  return {
    operationId: operation.id,
    rowIndex: operation.rowIndex,
    columnIndex: operation.columnIndex,
    reason,
    message,
    conflictCodes: conflicts.map((conflict) => conflict.code),
  };
}

export function buildExecutableImportOperations({
  plan,
  resolverState,
  selectionState,
  updateMode = plan.updateMode,
}: BuildExecutableImportOperationsInput): ExecutableImportPlan {
  const studentByRow = new Map(plan.studentMappings.map((mapping) => [mapping.rowIndex, mapping]));
  const columnByIndex = new Map(plan.columnMappings.map((mapping) => [mapping.columnIndex, mapping]));
  const operations: ExecutableImportOperation[] = [];
  const blockedItems: ExecutableImportBlockedItem[] = [];
  const skippedItems: ExecutableImportSkippedItem[] = [];

  plan.gradeOperations.forEach((operation) => {
    const studentMapping = studentByRow.get(operation.rowIndex);
    const columnMapping = columnByIndex.get(operation.columnIndex);
    const columnOverride = columnOverrideFor(resolverState, operation.columnIndex);
    const hasColumnOverride = Boolean(columnOverride && columnOverride.kind !== "ignore");
    const hasStudentOverride = Boolean(resolverState?.studentOverrides?.[String(operation.rowIndex)]);
    const target = effectiveColumnTarget(columnMapping, operation, columnOverride);
    const studentId = effectiveStudentId(studentMapping, resolverState, operation.rowIndex);
    const conflicts = unresolvedConflicts(operation, resolverState);
    const cellSetting = selectionState?.cellSettings[cellIdFor(operation.rowIndex, operation.columnIndex)];
    const resolvedValue = resolveOperationValue(operation, cellSetting);
    const manualMessage = manualSkipMessage(operation);

    if (manualMessage || isManuallySkipped(operation, resolverState, selectionState) || columnOverride?.kind === "ignore") {
      skippedItems.push(skippedItem(operation, "manual_skip", manualMessage || "Baris, kolom, atau sel dilewati sesuai pilihan user."));
      return;
    }

    if (isInvalidOperation({ ...operation, conflicts })) {
      blockedItems.push(blockedItem(operation, "invalid_value", "Nilai invalid tidak boleh disimpan.", conflicts));
      return;
    }

    if (operation.action === "skip_empty") {
      if (conflicts.length > 0) {
        blockedItems.push(blockedItem(operation, "blocked_operation", "Operasi masih memiliki konflik yang belum selesai.", conflicts));
        return;
      }
      skippedItems.push(skippedItem(operation, "empty_value", "Nilai kosong dilewati dan tidak menghapus nilai lama."));
      return;
    }

    if (resolvedValue === null) {
      if (operation.suggestedValue !== undefined) {
        blockedItems.push(blockedItem(operation, "blocked_operation", "Nilai saran perlu disetujui sebelum disimpan.", conflicts));
        return;
      }
      skippedItems.push(skippedItem(operation, "empty_value", "Nilai kosong dilewati dan tidak menghapus nilai lama."));
      return;
    }

    if (!hasExplicitConfirmation(operation, cellSetting, hasStudentOverride, hasColumnOverride)) {
      blockedItems.push(blockedItem(operation, "blocked_operation", "Item ini perlu dicek sebelum disimpan.", conflicts));
      return;
    }

    if (
      resolverState?.unresolvedRows?.includes(operation.rowIndex)
      || (!hasStudentOverride && (studentMapping?.status === "ambiguous" || studentMapping?.status === "blocked"))
    ) {
      blockedItems.push(blockedItem(operation, "unresolved_student", "Baris siswa belum dipilih aman.", conflicts));
      return;
    }

    if (!studentId || (!hasStudentOverride && studentMapping?.status === "missing_in_web")) {
      blockedItems.push(blockedItem(operation, "missing_student", "Baris Excel memiliki nilai tetapi belum terhubung ke siswa web.", conflicts));
      return;
    }

    if (operation.action === "skip_existing") {
      if (conflicts.length > 0) {
        blockedItems.push(blockedItem(operation, "blocked_operation", "Operasi masih memiliki konflik yang belum selesai.", conflicts));
        return;
      }
      skippedItems.push(skippedItem(operation, "existing_value", "Nilai lama sudah ada dan mode import tidak mengizinkan overwrite."));
      return;
    }

    if (
      !target
      || (!hasColumnOverride && (columnMapping?.status === "ambiguous" || columnMapping?.status === "blocked" || columnMapping?.status === "missing"))
    ) {
      blockedItems.push(blockedItem(operation, "unresolved_column", "Kolom nilai belum memiliki target aman.", conflicts));
      return;
    }

    if (!hasExecutableAssignmentTarget(target)) {
      const reason = target.gradeType === "assignment" ? "structure_unconfirmed" : "unresolved_column";
      const message = target.gradeType === "assignment"
        ? "Target tugas belum lengkap."
        : "Target STS/SAS tidak boleh memakai tugas.";
      blockedItems.push(blockedItem(operation, reason, message, conflicts));
      return;
    }

    if (!isStructureConfirmed(target, columnOverride)) {
      blockedItems.push(blockedItem(operation, "structure_unconfirmed", "BAB atau tugas baru belum dikonfirmasi.", conflicts));
      return;
    }

    if (!isValidGradeNumber(resolvedValue)) {
      blockedItems.push(blockedItem(operation, "invalid_value", "Nilai invalid tidak boleh disimpan.", conflicts));
      return;
    }

    if (conflicts.length > 0) {
      blockedItems.push(blockedItem(operation, "blocked_operation", "Operasi masih memiliki konflik yang belum selesai.", conflicts));
      return;
    }

    const mode = effectiveValueMode(operation, updateMode, selectionState);
    const hasExisting = hasExistingGrade(operation);

    if (hasExisting && Number(operation.existingValue) === Number(resolvedValue)) {
      skippedItems.push(skippedItem(operation, "existing_value", "Nilai Excel sama dengan nilai SIPENA, jadi otomatis dilewati."));
      return;
    }

    if (hasExisting && (mode === "fill_empty_only" || mode === "skip_existing" || mode === "overwrite_selected_columns")) {
      skippedItems.push(skippedItem(operation, "existing_value", "Nilai lama sudah ada dan mode import tidak mengizinkan overwrite."));
      return;
    }

    if (hasExisting && mode === "overwrite_existing" && !overwriteConfirmed(operation, selectionState)) {
      blockedItems.push(blockedItem(operation, "overwrite_needs_confirmation", "Overwrite nilai lama perlu konfirmasi user."));
      return;
    }

    operations.push({
      operationId: operation.id,
      operation,
      rowIndex: operation.rowIndex,
      columnIndex: operation.columnIndex,
      sourceRowIndex: operation.sourceRowIndex,
      sourceColumnIndex: operation.sourceColumnIndex,
      studentId,
      target,
      value: resolvedValue,
      action: hasExisting ? "overwrite" : "fill_empty",
    });
  });

  const summary: ExecutableImportSummary = {
    totalOperations: plan.gradeOperations.length,
    executableCount: operations.length,
    fillEmptyCount: operations.filter((operation) => operation.action === "fill_empty").length,
    overwriteCount: operations.filter((operation) => operation.action === "overwrite").length,
    skippedEmptyCount: skippedItems.filter((item) => item.reason === "empty_value").length,
    skippedExistingCount: skippedItems.filter((item) => item.reason === "existing_value").length,
    skippedManualCount: skippedItems.filter((item) => item.reason === "manual_skip").length,
    blockedCount: blockedItems.length,
    invalidCount: blockedItems.filter((item) => item.reason === "invalid_value").length,
    unresolvedStudentCount: blockedItems.filter((item) => ["missing_student", "unresolved_student"].includes(item.reason)).length,
    unresolvedColumnCount: blockedItems.filter((item) => ["unresolved_column", "structure_unconfirmed"].includes(item.reason)).length,
    overwriteNeedsConfirmationCount: blockedItems.filter((item) => item.reason === "overwrite_needs_confirmation").length,
  };

  return { operations, blockedItems, skippedItems, summary };
}
