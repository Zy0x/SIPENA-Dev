import { useEffect, useMemo, useRef, useState } from "react";

import type {
  CellValueMode,
  ColumnValueMode,
  ImportSelectionState,
  ImportWebStudent,
  SmartImportAssistResponse,
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

import { PreviewFixPanel } from "./PreviewFixPanel";
import { getActiveImportIssues, type InvalidIssue } from "./importIssueQueue";

type IssueResolutionStatus = "resolved" | "skipped";
type IssueBoardItem = InvalidIssue & {
  resolutionStatus?: IssueResolutionStatus;
  resolutionLabel?: string;
};

type Selection =
  | { kind: "cell"; cell: SpreadsheetPreviewCell; row: SpreadsheetPreviewRow; column: SpreadsheetPreviewColumn }
  | { kind: "column"; column: SpreadsheetPreviewColumn }
  | { kind: "row"; row: SpreadsheetPreviewRow }
  | null;

function issueSelection(issue: InvalidIssue): Selection {
  if (issue.cell && issue.row && issue.column) return { kind: "cell", cell: issue.cell, row: issue.row, column: issue.column };
  if (issue.column) return { kind: "column", column: issue.column };
  if (issue.row) return { kind: "row", row: issue.row };
  return null;
}

function issueTone(issue: InvalidIssue): "danger" | "warning" | "neutral" {
  if (issue.rootCause === "invalid_value" || issue.rootCause === "student_missing") return "danger";
  if (issue.rootCause === "column_target" || issue.rootCause === "student_duplicate" || issue.rootCause === "student_ambiguous") return "warning";
  return "neutral";
}

function issueKindLabel(issue: InvalidIssue): string {
  if (issue.fixKind === "student") return issue.rootCause === "student_duplicate" ? "Siswa redundan" : "Siswa";
  if (issue.fixKind === "column") return "Kolom";
  return issue.rootCause === "invalid_value" ? "Nilai tidak valid" : "Nilai";
}

function issuePrimaryContext(issue: InvalidIssue): string {
  if (issue.row && issue.column) return `${issue.row.studentName} / ${issue.column.header}`;
  if (issue.row) return `Baris ${issue.row.rowIndex} / ${issue.row.studentName}`;
  return "Periksa item";
}

function issueStatusLabel(issue: IssueBoardItem): string {
  if (issue.resolutionStatus === "skipped") return "Dilewati";
  if (issue.resolutionStatus === "resolved") return issue.resolutionLabel || "Selesai";
  return "Belum selesai";
}

function issueBoardTone(issue: IssueBoardItem): "danger" | "warning" | "neutral" | "done" | "skipped" {
  if (issue.resolutionStatus === "skipped") return "skipped";
  if (issue.resolutionStatus === "resolved") return "done";
  return issueTone(issue);
}

function rowValue(row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn): string {
  const cell = row.cells.find((item) => item.columnId === column.id);
  return cell?.displayValue || cell?.newValue?.toString() || "-";
}

function DuplicateStudentComparison({
  issue,
  columns,
  onChooseStudent,
  onIgnoreRow,
  onResetRowSelection,
}: {
  issue: InvalidIssue;
  columns: SpreadsheetPreviewColumn[];
  onChooseStudent: (row: SpreadsheetPreviewRow, studentId: string) => void;
  onIgnoreRow: (row: SpreadsheetPreviewRow) => void;
  onResetRowSelection: (row: SpreadsheetPreviewRow) => void;
}) {
  const rows = issue.relatedRows?.length ? issue.relatedRows : issue.row ? [issue.row] : [];
  if (issue.rootCause !== "student_duplicate" || rows.length === 0) return null;

  const chooseRow = (selectedRow: SpreadsheetPreviewRow) => {
    rows
      .filter((row) => row.id !== selectedRow.id)
      .forEach((row) => onIgnoreRow(row));
    if (selectedRow.studentId) {
      onChooseStudent(selectedRow, selectedRow.studentId);
    } else {
      onResetRowSelection(selectedRow);
    }
  };

  return (
    <div className="sipena-duplicate-student-card">
      <div className="sipena-duplicate-student-head">
        <div>
          <b>Bandingkan baris nama redundan</b>
          <span>Pilih satu baris Excel yang benar untuk siswa ini. Baris lain otomatis dilewati.</span>
        </div>
        <span>{rows.length} baris</span>
      </div>
      <div className="sipena-duplicate-student-table-wrap">
        <table className="sipena-duplicate-student-table">
          <thead>
            <tr>
              <th>Aksi</th>
              <th>Baris Excel</th>
              {columns.map((column) => (
                <th key={column.id}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="sipena-duplicate-student-actions">
                    <button type="button" className="sipena-column-btn sipena-column-btn-primary" onClick={() => chooseRow(row)}>
                      Pakai baris ini
                    </button>
                    <button type="button" className="sipena-column-btn" onClick={() => onIgnoreRow(row)}>
                      Lewati
                    </button>
                    <button type="button" className="sipena-column-btn" onClick={() => onResetRowSelection(row)}>
                      Reset
                    </button>
                  </div>
                </td>
                <td>{row.rowIndex}</td>
                {columns.map((column) => (
                  <td key={`${row.id}:${column.id}`}>{rowValue(row, column)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ImportIssueResolutionStep({
  model,
  selectionState,
  students,
  onApproveColumn,
  onIgnoreColumn,
  onIgnoreCell,
  onIgnoreRow,
  onResetRowSelection,
  onChooseStudent,
  onMarkRowUnresolved,
  onApplySafeFixes,
  onApproveSuggestions,
  onSetColumnInclude,
  onSetColumnValueMode,
  onBulkColumnAction,
  onResetColumnSelection,
  onSetCellInclude,
  onSetCellValueMode,
  onAcceptSuggestedValue,
  onResetCellSelection,
  aiAssist,
}: {
  model: SpreadsheetPreviewModel;
  selectionState: ImportSelectionState;
  students: ImportWebStudent[];
  onApplySafeFixes: () => void;
  onApproveSuggestions: () => void;
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreCell: (cell: SpreadsheetPreviewCell) => void;
  onIgnoreRow: (row: SpreadsheetPreviewRow) => void;
  onResetRowSelection: (row: SpreadsheetPreviewRow) => void;
  onChooseStudent: (row: SpreadsheetPreviewRow, studentId: string) => void;
  onMarkRowUnresolved: (row: SpreadsheetPreviewRow) => void;
  onSetColumnInclude: (column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetColumnHeader: (column: SpreadsheetPreviewColumn, header: string) => void;
  onSetColumnValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
  onSetCellInclude: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetCellValueMode: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, mode: CellValueMode, overwriteConfirmed?: boolean) => void;
  onAcceptSuggestedValue: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn) => void;
  onResetCellSelection: (cell: SpreadsheetPreviewCell) => void;
  aiAssist?: SmartImportAssistResponse | null;
}) {
  const issues = useMemo(() => getActiveImportIssues(model), [model]);
  const [completedIssues, setCompletedIssues] = useState<Record<string, IssueBoardItem>>({});
  const [showActiveDetail, setShowActiveDetail] = useState(false);
  const previousIssuesRef = useRef<InvalidIssue[]>(issues);
  const activeIssueIds = useMemo(() => new Set(issues.map((issue) => issue.id)), [issues]);
  const issueBoard = useMemo<IssueBoardItem[]>(() => {
    const activeItems: IssueBoardItem[] = issues.map((issue) => ({ ...issue }));
    const completedItems = Object.values(completedIssues).filter((issue) => !activeIssueIds.has(issue.id));
    return [...activeItems, ...completedItems];
  }, [activeIssueIds, completedIssues, issues]);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(issueBoard[0]?.id || null);
  const activeIssue = issueBoard.find((issue) => issue.id === activeIssueId) || issueBoard[0];
  const activeIndex = activeIssue ? Math.max(0, issueBoard.findIndex((issue) => issue.id === activeIssue.id)) : -1;
  const activePendingIndex = activeIssue ? issues.findIndex((issue) => issue.id === activeIssue.id) : -1;
  const selection = activeIssue ? issueSelection(activeIssue) : null;
  const isDuplicateStudentIssue = activeIssue?.rootCause === "student_duplicate";
  const isInvalidCellIssue = activeIssue?.fixKind === "cell" && activeIssue.rootCause === "invalid_value";
  const activeIssueCount = issues.length;
  const completedIssueCount = issueBoard.length - activeIssueCount;
  const totalIssueCount = issueBoard.length;
  const activeKicker = activeIssue?.resolutionStatus
    ? `Selesai ${activeIndex + 1} dari ${issueBoard.length}`
    : `Masalah ${Math.max(1, activePendingIndex + 1)} dari ${activeIssueCount || 1}`;

  const rememberIssue = (issue: InvalidIssue | null | undefined, resolutionStatus: IssueResolutionStatus, resolutionLabel?: string) => {
    if (!issue) return;
    setCompletedIssues((current) => ({
      ...current,
      [issue.id]: { ...issue, resolutionStatus, resolutionLabel },
    }));
  };

  const clearIssueMemory = (issue: InvalidIssue | null | undefined) => {
    if (!issue) return;
    setCompletedIssues((current) => {
      const { [issue.id]: _removed, ...next } = current;
      return next;
    });
  };

  useEffect(() => {
    const previousIssues = previousIssuesRef.current;
    const nextIds = new Set(issues.map((issue) => issue.id));
    const resolvedIssues = previousIssues.filter((issue) => !nextIds.has(issue.id));
    if (resolvedIssues.length) {
      setCompletedIssues((current) => {
        const next = { ...current };
        resolvedIssues.forEach((issue) => {
          if (!next[issue.id]) next[issue.id] = { ...issue, resolutionStatus: "resolved", resolutionLabel: "Selesai" };
        });
        return next;
      });
    }
    setCompletedIssues((current) => {
      const next = { ...current };
      issues.forEach((issue) => {
        delete next[issue.id];
      });
      return next;
    });
    previousIssuesRef.current = issues;
  }, [issues]);

  useEffect(() => {
    setShowActiveDetail(false);
  }, [activeIssueId]);

  useEffect(() => {
    if (!issueBoard.length) {
      setActiveIssueId(null);
      return;
    }
    const selectedIssue = issueBoard.find((issue) => issue.id === activeIssueId);
    if (selectedIssue?.resolutionStatus && issues.length) {
      setActiveIssueId(issues[0].id);
      return;
    }
    if (!activeIssueId || !issueBoard.some((issue) => issue.id === activeIssueId)) {
      setActiveIssueId(issueBoard[0].id);
    }
  }, [activeIssueId, issueBoard, issues]);

  const handleResetActiveIssue = (issue: IssueBoardItem) => {
    clearIssueMemory(issue);
    if (issue.row) onResetRowSelection(issue.row);
    if (issue.column) onResetColumnSelection(issue.column);
    if (issue.cell) onResetCellSelection(issue.cell);
  };

  return (
    <section className="sipena-issue-step">
      <div className="sipena-issue-step-header">
        <div>
          <h3>Daftar Bermasalah</h3>
          <p>Selesaikan masalah utama dari sini. Pilih item, lihat konteksnya, lalu pakai aksi yang paling aman.</p>
        </div>
        <div className="sipena-issue-step-summary">
          <b>{completedIssueCount}/{totalIssueCount || 0}</b>
          <span>{activeIssueCount ? `${activeIssueCount} masalah tersisa` : "selesai"}</span>
        </div>
      </div>

      {issueBoard.length ? (
        <div className="sipena-issue-step-grid">
          <aside className="sipena-issue-list" aria-label="Daftar item bermasalah">
            {issueBoard.map((issue, index) => (
              <button
                key={issue.id}
                type="button"
                className={cn(
                  "sipena-issue-list-item",
                  activeIssue?.id === issue.id && "sipena-issue-list-item-active",
                  `sipena-issue-list-item--${issueBoardTone(issue)}`,
                )}
                onClick={() => setActiveIssueId(issue.id)}
              >
                <span className="sipena-issue-list-index">{issue.resolutionStatus === "resolved" ? "✓" : issue.resolutionStatus === "skipped" ? "–" : index + 1}</span>
                <span className="min-w-0">
                  <span className="sipena-issue-list-meta">
                    <span>{issueKindLabel(issue)}</span>
                    <span>{issueStatusLabel(issue)}</span>
                  </span>
                  <span className="sipena-issue-list-title">{issue.title}</span>
                  <span className="sipena-issue-list-context">{issuePrimaryContext(issue)}</span>
                  <span className="sipena-issue-list-desc">{issue.description}</span>
                </span>
              </button>
            ))}
          </aside>

          <div className="sipena-issue-fix-stack">
            {activeIssue ? (
              <div className={`sipena-issue-active-summary sipena-issue-active-summary--${issueBoardTone(activeIssue)}`}>
                <div>
                  <span className="sipena-issue-active-kicker">{activeKicker}</span>
                  <h4>{activeIssue.title}</h4>
                  <p>{activeIssue.description}</p>
                </div>
                {!activeIssue.resolutionStatus ? (
                <div className="sipena-issue-active-details">
                  <b>{activeIssue.detailTitle}</b>
                  <ul>
                    {activeIssue.detailBullets.slice(0, 2).map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                </div>
                ) : null}
                {isInvalidCellIssue && activeIssue.cell && activeIssue.row && activeIssue.column && !activeIssue.resolutionStatus ? (
                  <div className="flex flex-wrap gap-2">
                    {activeIssue.cell.suggestedValue !== undefined ? (
                      <button
                        type="button"
                        className="sipena-column-btn sipena-column-btn-primary"
                        onClick={() => {
                          rememberIssue(activeIssue, "resolved", "Selesai");
                          onAcceptSuggestedValue(activeIssue.cell!, activeIssue.row!, activeIssue.column!);
                        }}
                      >
                        Pakai saran
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="sipena-column-btn sipena-column-btn-warning"
                      onClick={() => {
                        rememberIssue(activeIssue, "skipped", "Dilewati");
                        onIgnoreCell(activeIssue.cell!);
                      }}
                    >
                      Lewati nilai
                    </button>
                    <button type="button" className="sipena-column-btn" onClick={() => onResetCellSelection(activeIssue.cell!)}>
                      Reset
                    </button>
                    <button type="button" className="sipena-column-btn" onClick={() => setShowActiveDetail((current) => !current)}>
                      {showActiveDetail ? "Sembunyikan detail" : "Lihat detail"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {activeIssue && !activeIssue.resolutionStatus ? (
              <DuplicateStudentComparison
                issue={activeIssue}
                columns={model.columns}
                onChooseStudent={(row, studentId) => {
                  rememberIssue(activeIssue, "resolved", "Selesai");
                  onChooseStudent(row, studentId);
                }}
                onIgnoreRow={(row) => {
                  rememberIssue(activeIssue, "skipped", "Dilewati");
                  onIgnoreRow(row);
                }}
                onResetRowSelection={(row) => {
                  clearIssueMemory(activeIssue);
                  onResetRowSelection(row);
                }}
              />
            ) : null}
            {activeIssue?.resolutionStatus ? (
              <div className="sipena-issue-completed-panel">
                <b>{issueStatusLabel(activeIssue)}</b>
                <p>Item sudah diproses. Ubah hanya jika pilihan tadi belum tepat.</p>
                <button type="button" className="sipena-column-btn" onClick={() => handleResetActiveIssue(activeIssue)}>
                  Ubah pilihan
                </button>
              </div>
            ) : !isDuplicateStudentIssue && (!isInvalidCellIssue || showActiveDetail) ? (
              <PreviewFixPanel
                model={model}
                selection={selection}
                selectionState={selectionState}
                students={students}
                onApproveColumn={onApproveColumn}
                onIgnoreColumn={(column) => {
                  rememberIssue(activeIssue, "skipped", "Dilewati");
                  onIgnoreColumn(column);
                }}
                onIgnoreCell={(cell) => {
                  rememberIssue(activeIssue, "skipped", "Dilewati");
                  onIgnoreCell(cell);
                }}
                onIgnoreRow={(row) => {
                  rememberIssue(activeIssue, "skipped", "Dilewati");
                  onIgnoreRow(row);
                }}
                onResetRowSelection={(row) => {
                  clearIssueMemory(activeIssue);
                  onResetRowSelection(row);
                }}
                onChooseStudent={(row, studentId) => {
                  rememberIssue(activeIssue, "resolved", "Selesai");
                  onChooseStudent(row, studentId);
                }}
                onMarkRowUnresolved={onMarkRowUnresolved}
                onApplySafeFixes={onApplySafeFixes}
                onApproveSuggestions={onApproveSuggestions}
                onSetColumnInclude={onSetColumnInclude}
                onSetColumnValueMode={onSetColumnValueMode}
                onBulkColumnAction={(column, action) => {
                  if (action === "skip_all") rememberIssue(activeIssue, "skipped", "Dilewati");
                  else if (action === "include_valid") rememberIssue(activeIssue, "resolved", "Selesai");
                  onBulkColumnAction(column, action);
                }}
                onResetColumnSelection={(column) => {
                  clearIssueMemory(activeIssue);
                  onResetColumnSelection(column);
                }}
                onSetCellInclude={onSetCellInclude}
                onSetCellValueMode={onSetCellValueMode}
                onAcceptSuggestedValue={(cell, row, column) => {
                  rememberIssue(activeIssue, "resolved", "Selesai");
                  onAcceptSuggestedValue(cell, row, column);
                }}
                onResetCellSelection={(cell) => {
                  clearIssueMemory(activeIssue);
                  onResetCellSelection(cell);
                }}
                aiAssist={aiAssist}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="sipena-issue-empty">
          <b>Tidak ada item bermasalah.</b>
          <span>Semua masalah utama selesai. Lanjutkan ke Konfigurasi Header untuk mengatur kolom nilai.</span>
        </div>
      )}
    </section>
  );
}
