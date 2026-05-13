import { useEffect, useMemo, useState } from "react";

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
}) {
  const issues = useMemo(() => getActiveImportIssues(model), [model]);
  const [activeIssueId, setActiveIssueId] = useState<string | null>(issues[0]?.id || null);
  const activeIssue = issues.find((issue) => issue.id === activeIssueId) || issues[0];
  const activeIndex = activeIssue ? Math.max(0, issues.findIndex((issue) => issue.id === activeIssue.id)) : -1;
  const selection = activeIssue ? issueSelection(activeIssue) : null;
  const targetColumn = selection?.kind === "column" ? selection.column : selection?.kind === "cell" ? selection.column : null;
  const isDuplicateStudentIssue = activeIssue?.rootCause === "student_duplicate";

  useEffect(() => {
    if (!issues.length) {
      setActiveIssueId(null);
      return;
    }
    if (!activeIssueId || !issues.some((issue) => issue.id === activeIssueId)) {
      setActiveIssueId(issues[0].id);
    }
  }, [activeIssueId, issues]);

  return (
    <section className="sipena-issue-step">
      <div className="sipena-issue-step-header">
        <div>
          <h3>Daftar Bermasalah</h3>
          <p>Selesaikan masalah utama dari sini. Pilih item, lihat konteksnya, lalu pakai aksi yang paling aman.</p>
        </div>
        <div className="sipena-issue-step-summary">
          <b>{issues.length}</b>
          <span>masalah tersisa</span>
        </div>
      </div>

      {issues.length ? (
        <div className="sipena-issue-step-grid">
          <aside className="sipena-issue-list" aria-label="Daftar item bermasalah">
            {issues.map((issue, index) => (
              <button
                key={issue.id}
                type="button"
                className={cn(
                  "sipena-issue-list-item",
                  activeIssue?.id === issue.id && "sipena-issue-list-item-active",
                  `sipena-issue-list-item--${issueTone(issue)}`,
                )}
                onClick={() => setActiveIssueId(issue.id)}
              >
                <span className="sipena-issue-list-index">{index + 1}</span>
                <span className="min-w-0">
                  <span className="sipena-issue-list-meta">
                    <span>{issueKindLabel(issue)}</span>
                    <span>Belum selesai</span>
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
              <div className={`sipena-issue-active-summary sipena-issue-active-summary--${issueTone(activeIssue)}`}>
                <div>
                  <span className="sipena-issue-active-kicker">Item {activeIndex + 1} dari {issues.length}</span>
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
            {targetColumn ? (
              <InlineColumnTargetFix
                column={targetColumn}
                assignments={assignments}
                chapters={chapters}
                onSetColumnTarget={onSetColumnTarget}
              />
            ) : null}
            {activeIssue ? (
              <DuplicateStudentComparison
                issue={activeIssue}
                columns={model.columns}
                onChooseStudent={onChooseStudent}
                onIgnoreRow={onIgnoreRow}
                onResetRowSelection={onResetRowSelection}
              />
            ) : null}
            {!isDuplicateStudentIssue ? (
              <PreviewFixPanel
                model={model}
                selection={selection}
                selectionState={selectionState}
                students={students}
                onApproveColumn={onApproveColumn}
                onIgnoreColumn={onIgnoreColumn}
                onIgnoreCell={onIgnoreCell}
                onIgnoreRow={onIgnoreRow}
                onResetRowSelection={onResetRowSelection}
                onChooseStudent={onChooseStudent}
                onMarkRowUnresolved={onMarkRowUnresolved}
                onApplySafeFixes={onApplySafeFixes}
                onApproveSuggestions={onApproveSuggestions}
                onSetColumnInclude={onSetColumnInclude}
                onSetColumnValueMode={onSetColumnValueMode}
                onBulkColumnAction={onBulkColumnAction}
                onResetColumnSelection={onResetColumnSelection}
                onSetCellInclude={onSetCellInclude}
                onSetCellValueMode={onSetCellValueMode}
                onAcceptSuggestedValue={onAcceptSuggestedValue}
                onResetCellSelection={onResetCellSelection}
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
    </section>
  );
}
