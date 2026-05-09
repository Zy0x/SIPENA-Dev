export type CellIncludeMode = "include" | "skip";

export type CellValueMode =
  | "inherit_column"
  | "fill_empty_only"
  | "skip_existing"
  | "overwrite_existing";

export type ColumnValueMode =
  | "fill_empty_only"
  | "skip_existing"
  | "overwrite_existing";

export type ColumnImportSetting = {
  columnId: string;
  columnIndex?: number;
  include: boolean;
  valueMode: ColumnValueMode;
  headerOverride?: string;
  overwriteConfirmed?: boolean;
  reason?: string;
  updatedAt?: string;
};

export type CellImportSetting = {
  cellId: string;
  rowId: string;
  columnId: string;
  studentId?: string;
  include: boolean;
  valueMode: CellValueMode;
  overwriteConfirmed?: boolean;
  reason?: string;
  updatedAt?: string;
};

export type ImportSelectionState = {
  columnSettings: Record<string, ColumnImportSetting>;
  cellSettings: Record<string, CellImportSetting>;
};

export const emptyImportSelectionState: ImportSelectionState = {
  columnSettings: {},
  cellSettings: {},
};

export function nowSelectionTimestamp(): string {
  return new Date().toISOString();
}

export function defaultColumnImportSetting(columnId: string, columnIndex?: number): ColumnImportSetting {
  return {
    columnId,
    columnIndex,
    include: true,
    valueMode: "fill_empty_only",
    overwriteConfirmed: false,
    updatedAt: nowSelectionTimestamp(),
  };
}

export function defaultCellImportSetting(
  cellId: string,
  rowId: string,
  columnId: string,
  studentId?: string,
): CellImportSetting {
  return {
    cellId,
    rowId,
    columnId,
    studentId,
    include: true,
    valueMode: "inherit_column",
    overwriteConfirmed: false,
    updatedAt: nowSelectionTimestamp(),
  };
}
