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

import { type ColumnSettingsAssignmentOption, type ColumnSettingsChapterOption, type ColumnTargetDraft } from "./ColumnSettingsOverlay";
import { PreviewFixPanel } from "./PreviewFixPanel";
import { getActiveImportIssues, type InvalidIssue } from "./importIssueQueue";

type AiAssistState = "idle" | "loading" | "success" | "error";
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
  if (issue.column) return issue.column.header;
  return "Periksa item";
}

function issueColumnIndex(column: SpreadsheetPreviewColumn | undefined): number | null {
  if (!column?.id.startsWith("excel-col-")) return null;
  const value = Number(column.id.replace("excel-col-", ""));
  return Number.isFinite(value) ? value : null;
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

function columnAiSuggestion(
  column: SpreadsheetPreviewColumn,
  aiAssist: SmartImportAssistResponse | null | undefined,
) {
  const columnIndex = issueColumnIndex(column);
  return aiAssist?.suggestions.find((suggestion) => (
    suggestion.type === "column"
    && (
      suggestion.columnIndex === columnIndex
      || suggestion.sourceId === column.id
      || suggestion.sourceId === column.sourceHeader
      || suggestion.sourceId === column.header
    )
  ));
}

function aiSuggestionActionLabel(suggestion: ReturnType<typeof columnAiSuggestion> | undefined): string {
  if (!suggestion) return "Belum ada saran AI";
  if (suggestion.targetType === "assignment") return "Pakai tugas yang disarankan";
  if (suggestion.targetType === "ignore") return "Lewati kolom";
  if (suggestion.suggestedAction.toLowerCase().includes("sts")) return "Pakai STS";
  if (suggestion.suggestedAction.toLowerCase().includes("sas")) return "Pakai SAS";
  return "Gunakan sebagai referensi";
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
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

function InlineColumnTargetFix({
  column,
  assignments,
  chapters,
  onSetColumnTarget,
}: {
  column: SpreadsheetPreviewColumn;
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  onSetColumnTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
}) {
  const [targetChoice, setTargetChoice] = useState("current");
  const [assignmentId, setAssignmentId] = useState(column.assignmentId || assignments[0]?.id || "");
  const [chapterId, setChapterId] = useState(column.chapterId || chapters[0]?.id || "");
  const [chapterName, setChapterName] = useState(column.chapterName || "BAB Baru");
  const [assignmentName, setAssignmentName] = useState(column.assignmentName || column.sourceHeader || column.header);

  useEffect(() => {
    setTargetChoice(column.effectiveInclude === false ? "ignore" : "current");
    setAssignmentId(column.assignmentId || assignments[0]?.id || "");
    setChapterId(column.chapterId || chapters[0]?.id || "");
    setChapterName(column.chapterName || "BAB Baru");
    setAssignmentName(column.assignmentName || column.sourceHeader || column.header);
  }, [assignments, chapters, column]);

  const applyTarget = () => {
    if (targetChoice === "sts" || targetChoice === "sas") {
      onSetColumnTarget(column, { kind: targetChoice });
      return;
    }
    if (targetChoice === "assignment" && assignmentId) {
      onSetColumnTarget(column, { kind: "existing_assignment", assignmentId });
      return;
    }
    if (targetChoice === "new_assignment" && chapterId && cleanName(assignmentName)) {
      onSetColumnTarget(column, { kind: "create_assignment", chapterId, assignmentName: cleanName(assignmentName) });
      return;
    }
    if (targetChoice === "new_chapter_assignment" && cleanName(chapterName) && cleanName(assignmentName)) {
      onSetColumnTarget(column, {
        kind: "create_chapter_and_assignment",
        chapterName: cleanName(chapterName),
        assignmentName: cleanName(assignmentName),
      });
      return;
    }
    if (targetChoice === "ignore") {
      onSetColumnTarget(column, { kind: "ignore" });
    }
  };

  if (column.type === "identity") return null;

  return (
    <div className="sipena-inline-target-fix">
      <div className="sipena-inline-target-header">
        <b>Target kolom</b>
        <span>{column.targetLabel || "Belum dipilih"}</span>
      </div>
      <div className="sipena-inline-target-grid">
        <label>
          <span>Pilih target</span>
          <select value={targetChoice} onChange={(event) => setTargetChoice(event.target.value)}>
            <option value="current">Target saat ini</option>
            <option value="sts">STS</option>
            <option value="sas">SAS</option>
            <option value="assignment">Tugas lain</option>
            <option value="new_assignment">Buat tugas baru</option>
            <option value="new_chapter_assignment">Buat BAB + tugas baru</option>
            <option value="ignore">Lewati</option>
          </select>
        </label>
        {targetChoice === "assignment" ? (
          <label>
            <span>Tugas yang sudah ada</span>
            <select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}>
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>{assignment.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        {targetChoice === "new_assignment" ? (
          <>
            <label>
              <span>BAB</span>
              <select value={chapterId} onChange={(event) => setChapterId(event.target.value)}>
                {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}
              </select>
            </label>
            <label>
              <span>Nama tugas baru</span>
              <input value={assignmentName} onChange={(event) => setAssignmentName(event.target.value)} />
            </label>
          </>
        ) : null}
        {targetChoice === "new_chapter_assignment" ? (
          <>
            <label>
              <span>Nama BAB baru</span>
              <input value={chapterName} onChange={(event) => setChapterName(event.target.value)} />
            </label>
            <label>
              <span>Nama tugas baru</span>
              <input value={assignmentName} onChange={(event) => setAssignmentName(event.target.value)} />
            </label>
          </>
        ) : null}
      </div>
      <button type="button" className="sipena-column-btn sipena-column-btn-primary" onClick={applyTarget} disabled={targetChoice === "current"}>
        Simpan target
      </button>
    </div>
  );
}

function AutomaticHeaderCheckDialog({
  open,
  issues,
  activeIssueId,
  assignments,
  chapters,
  aiAssist,
  aiAssistStatus,
  canRequestAiAssist,
  onClose,
  onSelectIssue,
  onRequestAiAssist,
  onSetColumnTarget,
  onIgnoreColumn,
}: {
  open: boolean;
  issues: IssueBoardItem[];
  activeIssueId: string | null;
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  aiAssist?: SmartImportAssistResponse | null;
  aiAssistStatus: AiAssistState;
  canRequestAiAssist: boolean;
  onClose: () => void;
  onSelectIssue: (issueId: string) => void;
  onRequestAiAssist: () => void;
  onSetColumnTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
}) {
  const requestedAiRef = useRef(false);
  const activeColumnIssue = issues.find((issue) => issue.id === activeIssueId) || issues[0] || null;

  useEffect(() => {
    if (!open) {
      requestedAiRef.current = false;
      return;
    }
    if (requestedAiRef.current || aiAssistStatus !== "idle" || !canRequestAiAssist || !issues.length) return;
    requestedAiRef.current = true;
    onRequestAiAssist();
  }, [aiAssistStatus, canRequestAiAssist, issues.length, onRequestAiAssist, open]);

  if (!open) return null;

  const applyAiSuggestion = (issue: IssueBoardItem) => {
    const column = issue.column;
    const suggestion = column ? columnAiSuggestion(column, aiAssist) : undefined;
    if (!column || !suggestion) return;
    const actionText = suggestion.suggestedAction.toLowerCase();
    if (suggestion.targetType === "assignment" && suggestion.targetId) {
      onSetColumnTarget(column, { kind: "existing_assignment", assignmentId: suggestion.targetId });
      return;
    }
    if (suggestion.targetType === "ignore") {
      onIgnoreColumn(column);
      return;
    }
    if (actionText.includes("sts")) {
      onSetColumnTarget(column, { kind: "sts" });
      return;
    }
    if (actionText.includes("sas")) {
      onSetColumnTarget(column, { kind: "sas" });
    }
  };

  return (
    <div className="sipena-auto-check-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="sipena-auto-check-modal" role="dialog" aria-modal="true" aria-labelledby="sipena-auto-check-title">
        <header className="sipena-auto-check-head">
          <div>
            <span className="sipena-auto-check-kicker">Pemeriksaan otomatis</span>
            <h3 id="sipena-auto-check-title">Header kolom bermasalah</h3>
            <p>Periksa target kolom satu per satu. Saran AI hanya membantu memilih target, keputusan tetap dikonfirmasi pengguna.</p>
          </div>
          <button type="button" className="sipena-column-btn" onClick={onClose}>Tutup</button>
        </header>

        <div className="sipena-auto-check-status">
          <span>{issues.length} header perlu ditinjau</span>
          <span>
            {aiAssistStatus === "loading"
              ? "AI sedang membaca header..."
              : aiAssistStatus === "success"
                ? "Saran AI tersedia"
                : aiAssistStatus === "error"
                  ? "AI gagal, pakai analisis SIPENA"
                  : "AI akan berjalan saat modal dibuka"}
          </span>
        </div>

        {issues.length ? (
          <div className="sipena-auto-check-grid">
            <aside className="sipena-auto-check-list" aria-label="Header bermasalah">
              {issues.map((issue) => {
                const suggestion = issue.column ? columnAiSuggestion(issue.column, aiAssist) : undefined;
                return (
                  <button
                    key={issue.id}
                    type="button"
                    className={cn(
                      "sipena-auto-check-item",
                      activeColumnIssue?.id === issue.id && "sipena-auto-check-item-active",
                      issue.resolutionStatus && `sipena-auto-check-item--${issue.resolutionStatus}`,
                    )}
                    onClick={() => onSelectIssue(issue.id)}
                  >
                    <span className="sipena-auto-check-item-title">{issue.column?.header || issue.title}</span>
                    <span>{issueStatusLabel(issue)}</span>
                    <small>{suggestion ? `AI: ${suggestion.reason}` : issue.description}</small>
                  </button>
                );
              })}
            </aside>

            {activeColumnIssue?.column ? (
              <div className="sipena-auto-check-detail">
                <div className="sipena-auto-check-detail-head">
                  <div>
                    <span>Header Excel</span>
                    <h4>{activeColumnIssue.column.header}</h4>
                  </div>
                  <span className="sipena-auto-check-badge">{issueStatusLabel(activeColumnIssue)}</span>
                </div>
                <dl className="sipena-auto-check-facts">
                  <div><dt>Target saat ini</dt><dd>{activeColumnIssue.column.targetLabel || "Belum dipilih"}</dd></div>
                  <div><dt>Nilai terbaca</dt><dd>{activeColumnIssue.column.stats?.validValues ?? 0}</dd></div>
                  <div><dt>Perlu dicek</dt><dd>{(activeColumnIssue.column.stats?.invalid ?? 0) + (activeColumnIssue.column.stats?.blocked ?? 0)}</dd></div>
                </dl>
                <div className="sipena-auto-check-reason">
                  <b>{activeColumnIssue.detailTitle}</b>
                  <ul>
                    {activeColumnIssue.detailBullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                </div>
                {(() => {
                  const suggestion = columnAiSuggestion(activeColumnIssue.column!, aiAssist);
                  const canApplySuggestion = Boolean(
                    suggestion
                    && (
                      (suggestion.targetType === "assignment" && suggestion.targetId)
                      || suggestion.targetType === "ignore"
                      || suggestion.suggestedAction.toLowerCase().includes("sts")
                      || suggestion.suggestedAction.toLowerCase().includes("sas")
                    ),
                  );
                  return (
                    <div className="sipena-auto-check-ai">
                      <b>Saran AI</b>
                      <p>{suggestion ? suggestion.reason : "Belum ada saran AI untuk header ini. Gunakan pilihan target manual di bawah."}</p>
                      {suggestion ? (
                        <span>Keyakinan {Math.round(suggestion.confidence * 100)}% / {aiSuggestionActionLabel(suggestion)}</span>
                      ) : null}
                      <button
                        type="button"
                        className="sipena-column-btn sipena-column-btn-primary"
                        disabled={!canApplySuggestion}
                        onClick={() => applyAiSuggestion(activeColumnIssue)}
                      >
                        Pakai saran AI
                      </button>
                    </div>
                  );
                })()}
                <InlineColumnTargetFix
                  column={activeColumnIssue.column}
                  assignments={assignments}
                  chapters={chapters}
                  onSetColumnTarget={onSetColumnTarget}
                />
                <div className="sipena-auto-check-actions">
                  <button type="button" className="sipena-column-btn" onClick={() => onIgnoreColumn(activeColumnIssue.column!)}>
                    Lewati kolom
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="sipena-issue-empty">
            <b>Tidak ada header bermasalah.</b>
            <span>Semua target kolom sudah cukup aman untuk masuk ke Verifikasi Tabel.</span>
          </div>
        )}
      </section>
    </div>
  );
}

export function ImportIssueResolutionStep({
  model,
  selectionState,
  students,
  assignments,
  chapters,
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
  onSetColumnTarget,
  onSetColumnValueMode,
  onBulkColumnAction,
  onResetColumnSelection,
  onSetCellInclude,
  onSetCellValueMode,
  onAcceptSuggestedValue,
  onResetCellSelection,
  aiAssist,
  aiAssistStatus = "idle",
  canRequestAiAssist = false,
  onRequestAiAssist,
}: {
  model: SpreadsheetPreviewModel;
  selectionState: ImportSelectionState;
  students: ImportWebStudent[];
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
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
  onSetColumnTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
  onSetColumnValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
  onSetCellInclude: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetCellValueMode: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, mode: CellValueMode, overwriteConfirmed?: boolean) => void;
  onAcceptSuggestedValue: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn) => void;
  onResetCellSelection: (cell: SpreadsheetPreviewCell) => void;
  aiAssist?: SmartImportAssistResponse | null;
  aiAssistStatus?: AiAssistState;
  canRequestAiAssist?: boolean;
  onRequestAiAssist?: () => void;
}) {
  const issues = useMemo(() => getActiveImportIssues(model), [model]);
  const [completedIssues, setCompletedIssues] = useState<Record<string, IssueBoardItem>>({});
  const [autoCheckOpen, setAutoCheckOpen] = useState(false);
  const [hasOpenedAutoCheck, setHasOpenedAutoCheck] = useState(false);
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
  const selection = activeIssue ? issueSelection(activeIssue) : null;
  const targetColumn = selection?.kind === "column" ? selection.column : selection?.kind === "cell" ? selection.column : null;
  const isDuplicateStudentIssue = activeIssue?.rootCause === "student_duplicate";
  const activeIssueCount = issues.length;
  const completedIssueCount = issueBoard.length - activeIssueCount;
  const columnIssues = issueBoard.filter((issue) => issue.fixKind === "column");
  const activeColumnIssueCount = issues.filter((issue) => issue.fixKind === "column").length;
  const attentionAutoCheck = activeColumnIssueCount > 0 && !hasOpenedAutoCheck;

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
    if (!issueBoard.length) {
      setActiveIssueId(null);
      return;
    }
    if (!activeIssueId || !issueBoard.some((issue) => issue.id === activeIssueId)) {
      setActiveIssueId(issueBoard[0].id);
    }
  }, [activeIssueId, issueBoard]);

  const openAutoCheck = () => {
    setHasOpenedAutoCheck(true);
    setAutoCheckOpen(true);
    const firstColumnIssue = columnIssues[0];
    if (firstColumnIssue) setActiveIssueId(firstColumnIssue.id);
  };

  const handleRequestAiAssist = () => {
    if (onRequestAiAssist) onRequestAiAssist();
  };

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
          <b>{activeIssueCount}</b>
          <span>{completedIssueCount ? `${completedIssueCount} selesai` : "masalah tersisa"}</span>
        </div>
      </div>
      <div className="sipena-issue-toolbar">
        <button
          type="button"
          className={cn("sipena-auto-check-trigger", attentionAutoCheck && "sipena-auto-check-trigger--attention")}
          onClick={openAutoCheck}
        >
          Pemeriksaan otomatis
        </button>
        <span>{activeColumnIssueCount ? `${activeColumnIssueCount} header perlu target` : "Header kolom aman atau sudah selesai"}</span>
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
                  <span className="sipena-issue-active-kicker">Item {activeIndex + 1} dari {issueBoard.length} / {issueStatusLabel(activeIssue)}</span>
                  <h4>{activeIssue.title}</h4>
                  <p>{activeIssue.description}</p>
                </div>
                <div className="sipena-issue-active-details">
                  <b>{activeIssue.detailTitle}</b>
                  <ul>
                    {activeIssue.detailBullets.slice(0, 3).map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                </div>
              </div>
            ) : null}
            {targetColumn && !activeIssue?.resolutionStatus ? (
              <InlineColumnTargetFix
                column={targetColumn}
                assignments={assignments}
                chapters={chapters}
                onSetColumnTarget={(column, target) => {
                  rememberIssue(activeIssue, "resolved", "Selesai");
                  onSetColumnTarget(column, target);
                }}
              />
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
                <p>Item ini sudah diproses. Jika keputusan belum tepat, buka ulang pilihan lalu atur kembali.</p>
                <button type="button" className="sipena-column-btn" onClick={() => handleResetActiveIssue(activeIssue)}>
                  Ubah pilihan
                </button>
              </div>
            ) : !isDuplicateStudentIssue ? (
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
          <span>Semua masalah utama selesai. Lanjutkan ke Verifikasi Tabel untuk mengecek tampilan akhir sebelum Review Akhir.</span>
        </div>
      )}
      <AutomaticHeaderCheckDialog
        open={autoCheckOpen}
        issues={columnIssues}
        activeIssueId={activeIssue?.id || null}
        assignments={assignments}
        chapters={chapters}
        aiAssist={aiAssist}
        aiAssistStatus={aiAssistStatus}
        canRequestAiAssist={canRequestAiAssist}
        onClose={() => setAutoCheckOpen(false)}
        onSelectIssue={setActiveIssueId}
        onRequestAiAssist={handleRequestAiAssist}
        onSetColumnTarget={(column, target) => {
          const issue = columnIssues.find((item) => item.column?.id === column.id);
          rememberIssue(issue, "resolved", "Selesai");
          onSetColumnTarget(column, target);
        }}
        onIgnoreColumn={(column) => {
          const issue = columnIssues.find((item) => item.column?.id === column.id);
          rememberIssue(issue, "skipped", "Dilewati");
          onIgnoreColumn(column);
        }}
      />
    </section>
  );
}
