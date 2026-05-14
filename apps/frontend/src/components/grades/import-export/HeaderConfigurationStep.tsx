import { useEffect, useMemo, useState } from "react";

import type {
  ColumnValueMode,
  ImportSelectionState,
  SmartImportAssistResponse,
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

import type { ColumnSettingsAssignmentOption, ColumnSettingsChapterOption, ColumnTargetDraft } from "./ColumnSettingsOverlay";
import { buildHeaderConfigurationQueue, type HeaderConfigurationCategory, type HeaderConfigurationIssue } from "./importIssueQueue";
import { getCellPreviewVisualState } from "./previewVisualState";

type TargetChoice = "current" | "sts" | "sas" | "assignment" | "new_assignment" | "new_chapter_assignment" | "ignore";

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function categoryCopy(category: HeaderConfigurationCategory) {
  if (category === "target_required") return { label: "Perlu target", description: "Header belum aman atau perlu dibuatkan target." };
  if (category === "overwrite") return { label: "Akan ditimpa", description: "Kolom berisi nilai lama yang berbeda." };
  if (category === "new_values") return { label: "Akan ditambahkan", description: "Kolom mengisi nilai yang masih kosong." };
  return { label: "Akan dilewati", description: "Kolom berisi nilai sama, kosong, atau diset skip." };
}

function valueModeLabel(mode: ColumnValueMode): string {
  if (mode === "overwrite_existing") return "Timpa setelah konfirmasi";
  if (mode === "skip_existing") return "Lewati nilai lama";
  return "Isi jika kosong";
}

function defaultTargetChoice(column: SpreadsheetPreviewColumn): TargetChoice {
  if (column.effectiveInclude === false || column.isIgnored) return "ignore";
  if (column.gradeType === "sts" || column.type === "sts") return "sts";
  if (column.gradeType === "sas" || column.type === "sas") return "sas";
  if (targetCurrentAvailable(column)) return "current";
  return "ignore";
}

function targetCurrentAvailable(column: SpreadsheetPreviewColumn): boolean {
  if (column.gradeType === "sts" || column.gradeType === "sas") return true;
  return Boolean(column.assignmentId && !column.isNewStructure);
}

function hasUsableTarget(column: SpreadsheetPreviewColumn): boolean {
  return targetCurrentAvailable(column);
}

function headerPrimaryLabel(issue: HeaderConfigurationIssue): string {
  if (issue.category === "target_required") return "Simpan target";
  if (issue.category === "overwrite" && issue.valueMode === "overwrite_existing") return "Konfirmasi timpa";
  if (issue.category === "skipped") return "Tandai aman";
  return "Simpan aturan";
}

function previewValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === "") return "-";
  return String(value);
}

function columnAiSuggestion(column: SpreadsheetPreviewColumn, aiAssist?: SmartImportAssistResponse | null) {
  const columnIndex = column.id.startsWith("excel-col-") ? Number(column.id.replace("excel-col-", "")) : null;
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

function HeaderTargetForm({
  issue,
  assignments,
  chapters,
  onApproveColumn,
  onIgnoreColumn,
  onSetColumnTarget,
}: {
  issue: HeaderConfigurationIssue;
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onSetColumnTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
}) {
  const column = issue.column;
  const [targetChoice, setTargetChoice] = useState<TargetChoice>(() => defaultTargetChoice(column));
  const [assignmentId, setAssignmentId] = useState(column.assignmentId || assignments[0]?.id || "");
  const [chapterId, setChapterId] = useState(column.chapterId || chapters[0]?.id || "");
  const [chapterName, setChapterName] = useState(column.chapterName || "BAB Baru");
  const [assignmentName, setAssignmentName] = useState(column.assignmentName || column.sourceHeader || column.header);

  useEffect(() => {
    setTargetChoice(defaultTargetChoice(column));
    setAssignmentId(column.assignmentId || assignments[0]?.id || "");
    setChapterId(column.chapterId || chapters[0]?.id || "");
    setChapterName(column.chapterName || "BAB Baru");
    setAssignmentName(column.assignmentName || column.sourceHeader || column.header);
  }, [assignments, chapters, column]);

  const canSaveTarget = (targetChoice === "current" && hasUsableTarget(column))
    || targetChoice === "sts"
    || targetChoice === "sas"
    || targetChoice === "ignore"
    || (targetChoice === "assignment" && Boolean(assignmentId))
    || (targetChoice === "new_assignment" && Boolean(chapterId) && Boolean(cleanName(assignmentName)))
    || (targetChoice === "new_chapter_assignment" && Boolean(cleanName(chapterName)) && Boolean(cleanName(assignmentName)));

  const applyTarget = () => {
    if (targetChoice === "current") {
      onApproveColumn(column);
      return;
    }
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
    if (targetChoice === "ignore") onIgnoreColumn(column);
  };

  return (
    <div className="sipena-header-target-form">
      <label>
        <span>Target header</span>
        <select value={targetChoice} onChange={(event) => setTargetChoice(event.target.value as TargetChoice)}>
          <option value="current" disabled={!hasUsableTarget(column)}>Target saat ini</option>
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
          <span>Pilih tugas</span>
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
      <button type="button" className="sipena-column-btn sipena-column-btn-primary sipena-header-target-save" onClick={applyTarget} disabled={!canSaveTarget}>
        {targetChoice === "ignore" ? "Lewati header" : "Simpan target"}
      </button>
    </div>
  );
}

function HeaderColumnPreview({
  model,
  issue,
}: {
  model: SpreadsheetPreviewModel;
  issue: HeaderConfigurationIssue;
}) {
  const column = issue.column;
  const rows = model.rows
    .map((row) => {
      const cell = row.cells.find((item) => item.columnId === column.id);
      if (!cell) return null;
      const visual = getCellPreviewVisualState(cell, column, row);
      return { row, cell, visual };
    })
    .filter(Boolean) as Array<{
      row: SpreadsheetPreviewRow;
      cell: SpreadsheetPreviewCell;
      visual: ReturnType<typeof getCellPreviewVisualState>;
    }>;

  const priority = { danger: 0, change: 1, new: 2, blocked: 3, skip: 4, neutral: 5 } as const;
  const previewRows = [...rows]
    .sort((left, right) => priority[left.visual.tone] - priority[right.visual.tone] || left.row.rowIndex - right.row.rowIndex)
    .slice(0, 10);

  return (
    <div className="sipena-header-preview">
      <div className="sipena-header-preview-head">
        <div>
          <b>Preview nilai header</b>
          <span>Baris penting ditampilkan dulu agar keputusan target dan aturan nilai jelas.</span>
        </div>
        <span>{rows.length} nilai</span>
      </div>
      <div className="sipena-header-preview-table-wrap">
        <table className="sipena-header-preview-table">
          <thead>
            <tr>
              <th>No</th>
              <th>NISN</th>
              <th>Nama</th>
              <th>Excel</th>
              <th>SIPENA</th>
              <th>Keputusan</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map(({ row, cell, visual }) => (
              <tr key={`${row.id}:${cell.id}`}>
                <td>{row.rowIndex}</td>
                <td>{row.nisn || "-"}</td>
                <td>{row.studentName}</td>
                <td>{previewValue(cell.displayValue || cell.rawValue || cell.newValue)}</td>
                <td>{previewValue(cell.oldValue)}</td>
                <td>
                  <span className={cn("sipena-header-preview-badge", visual.className)}>
                    {visual.label}
                  </span>
                </td>
              </tr>
            ))}
            {!previewRows.length ? (
              <tr>
                <td colSpan={6}>Tidak ada nilai pada header ini.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HeaderConfigurationStep({
  model,
  selectionState,
  assignments,
  chapters,
  aiAssist,
  onApproveColumn,
  onIgnoreColumn,
  onSetColumnTarget,
  onSetColumnValueMode,
  onBulkColumnAction,
  onResetColumnSelection,
}: {
  model: SpreadsheetPreviewModel;
  selectionState: ImportSelectionState;
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  aiAssist?: SmartImportAssistResponse | null;
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onSetColumnTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
  onSetColumnValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
}) {
  const issues = useMemo(() => buildHeaderConfigurationQueue(model, selectionState), [model, selectionState]);
  const activeIssues = issues.filter((issue) => !issue.isResolved);
  const [selectedCategory, setSelectedCategory] = useState<HeaderConfigurationCategory>("target_required");
  const [activeIssueId, setActiveIssueId] = useState<string | null>(issues[0]?.id || null);
  const visibleIssues = issues.filter((issue) => issue.category === selectedCategory);
  const selectedIssue = issues.find((issue) => issue.id === activeIssueId);
  const activeIssue = selectedIssue?.category === selectedCategory ? selectedIssue : visibleIssues[0] || activeIssues[0] || issues[0];
  const categories: HeaderConfigurationCategory[] = ["target_required", "overwrite", "new_values", "skipped"];

  useEffect(() => {
    if (!issues.length) {
      setActiveIssueId(null);
      return;
    }
    const currentIssue = issues.find((issue) => issue.id === activeIssueId);
    if (currentIssue && currentIssue.category !== selectedCategory) {
      const nextInCategory = visibleIssues[0];
      if (nextInCategory) setActiveIssueId(nextInCategory.id);
      return;
    }
    if (!activeIssueId || !currentIssue) {
      const next = activeIssues[0] || issues[0];
      setSelectedCategory(next.category);
      setActiveIssueId(next.id);
    }
  }, [activeIssueId, activeIssues, issues, selectedCategory, visibleIssues]);

  const selectCategory = (category: HeaderConfigurationCategory) => {
    setSelectedCategory(category);
    const first = issues.find((issue) => issue.category === category);
    if (first) setActiveIssueId(first.id);
  };

  const suggestion = activeIssue ? columnAiSuggestion(activeIssue.column, aiAssist) : undefined;
  const applyHeaderDecision = (issue: HeaderConfigurationIssue) => {
    if (issue.category === "target_required" && !hasUsableTarget(issue.column)) return;
    if (issue.category === "skipped") {
      onBulkColumnAction(issue.column, "skip_all");
      return;
    }
    onSetColumnValueMode(
      issue.column,
      issue.valueMode,
      issue.valueMode === "overwrite_existing" ? !issue.requiresOverwriteConfirmation : false,
    );
    onApproveColumn(issue.column);
    onBulkColumnAction(issue.column, "include_valid");
  };
  const canApplyHeaderDecision = useMemo(() => {
    if (!activeIssue) return false;
    if (activeIssue.column.effectiveInclude === false || activeIssue.column.isIgnored) return true;
    if (activeIssue.category === "target_required") return hasUsableTarget(activeIssue.column);
    if (activeIssue.category === "overwrite" && activeIssue.valueMode === "overwrite_existing") {
      return !activeIssue.requiresOverwriteConfirmation;
    }
    return true;
  }, [activeIssue]);

  return (
    <section className="sipena-header-config-step">
      <div className="sipena-issue-step-header">
        <div>
          <h3>Konfigurasi Header</h3>
          <p>Atur target dan aturan nilai per kolom. Semua nilai di bawah header akan mengikuti keputusan ini.</p>
        </div>
        <div className="sipena-issue-step-summary">
          <b>{activeIssues.length}</b>
          <span>{activeIssues.length ? "header perlu aksi" : "header aman"}</span>
        </div>
      </div>

      <div className="sipena-header-category-bar" aria-label="Kategori header">
        {categories.map((category) => {
          const copy = categoryCopy(category);
          const count = issues.filter((issue) => issue.category === category).length;
          const unresolved = issues.filter((issue) => issue.category === category && !issue.isResolved).length;
          return (
            <button
              key={category}
              type="button"
              className={cn("sipena-header-category-button", selectedCategory === category && "sipena-header-category-button--active")}
              onClick={() => selectCategory(category)}
            >
              <span>{copy.label}</span>
              <b>{unresolved ? `${unresolved}/${count}` : count}</b>
              <small>{copy.description}</small>
            </button>
          );
        })}
      </div>

      {issues.length ? (
        <div className="sipena-header-config-grid">
          <aside className="sipena-header-list" aria-label="Daftar header nilai">
            {(visibleIssues.length ? visibleIssues : issues).map((issue) => (
              <button
                key={issue.id}
                type="button"
                className={cn(
                  "sipena-header-list-item",
                  activeIssue?.id === issue.id && "sipena-header-list-item--active",
                  issue.isResolved && "sipena-header-list-item--done",
                  !issue.isResolved && `sipena-header-list-item--${issue.category}`,
                )}
                onClick={() => setActiveIssueId(issue.id)}
              >
                <span className="sipena-header-list-state">{issue.isResolved ? "✓" : "!"}</span>
                <span className="min-w-0">
                  <span className="sipena-header-list-meta">
                    <span>{issue.categoryLabel}</span>
                    <span>{issue.isResolved ? "Selesai" : issue.recommendedActionLabel}</span>
                  </span>
                  <b>{issue.title}</b>
                  <small>{issue.description}</small>
                </span>
              </button>
            ))}
          </aside>

          {activeIssue ? (
            <div className="sipena-header-detail">
              <div className="sipena-header-detail-head">
                <div>
                  <span>{activeIssue.categoryLabel}</span>
                  <h4>{activeIssue.column.header}</h4>
                  <p>Target saat ini: {activeIssue.column.targetLabel || "Belum dipilih"}</p>
                </div>
                <span className={cn("sipena-header-status", activeIssue.isResolved ? "sipena-header-status--done" : "sipena-header-status--pending")}>
                  {activeIssue.isResolved ? "Selesai" : "Perlu aksi"}
                </span>
              </div>

              <dl className="sipena-header-counts">
                <div><dt>Baru</dt><dd>{activeIssue.counts.newValues}</dd></div>
                <div><dt>Timpa</dt><dd>{activeIssue.counts.overwrite}</dd></div>
                <div><dt>Dilewati</dt><dd>{activeIssue.counts.skipped}</dd></div>
                <div><dt>Invalid</dt><dd>{activeIssue.counts.invalid}</dd></div>
              </dl>

              <div className="sipena-header-info">
                <b>{activeIssue.detailTitle}</b>
                <ul>{activeIssue.detailBullets.slice(0, 2).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                {suggestion ? (
                  <p><b>Saran AI:</b> {suggestion.reason} ({Math.round(suggestion.confidence * 100)}%).</p>
                ) : null}
              </div>

              <HeaderColumnPreview model={model} issue={activeIssue} />

              <div className="sipena-header-decision-panel">
                <HeaderTargetForm
                  issue={activeIssue}
                  assignments={assignments}
                  chapters={chapters}
                  onApproveColumn={onApproveColumn}
                  onIgnoreColumn={onIgnoreColumn}
                  onSetColumnTarget={onSetColumnTarget}
                />

                <div className="sipena-header-value-mode">
                  <b>Aturan nilai kolom</b>
                  <div>
                    {(["fill_empty_only", "skip_existing", "overwrite_existing"] as ColumnValueMode[]).map((mode) => (
                      <label key={mode} className={cn(activeIssue.valueMode === mode && "sipena-header-value-mode--active")}>
                        <input
                          type="radio"
                          name={`header-mode-${activeIssue.column.id}`}
                          checked={activeIssue.valueMode === mode}
                          onChange={() => onSetColumnValueMode(activeIssue.column, mode, false)}
                        />
                        <span>{valueModeLabel(mode)}</span>
                      </label>
                    ))}
                  </div>
                  {activeIssue.valueMode === "overwrite_existing" ? (
                    <label className="sipena-header-overwrite-confirm">
                      <input
                        type="checkbox"
                        checked={!activeIssue.requiresOverwriteConfirmation}
                        onChange={(event) => onSetColumnValueMode(activeIssue.column, "overwrite_existing", event.target.checked)}
                      />
                      <span>Saya paham nilai lama pada kolom ini dapat diganti.</span>
                    </label>
                  ) : null}
                </div>

                <div className="sipena-header-decision-actions">
                  {activeIssue.category !== "target_required" ? (
                    <button
                      type="button"
                      className="sipena-column-btn sipena-column-btn-primary"
                      onClick={() => applyHeaderDecision(activeIssue)}
                      disabled={!canApplyHeaderDecision}
                    >
                      {headerPrimaryLabel(activeIssue)}
                    </button>
                  ) : null}
                  {activeIssue.category !== "target_required" ? (
                    <button type="button" className="sipena-column-btn sipena-column-btn-warning" onClick={() => onBulkColumnAction(activeIssue.column, "skip_all")}>
                      Lewati header
                    </button>
                  ) : null}
                  <button type="button" className="sipena-column-btn" onClick={() => onResetColumnSelection(activeIssue.column)}>
                    Reset
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="sipena-issue-empty">
          <b>Tidak ada header nilai.</b>
          <span>File tidak memiliki kolom nilai yang perlu dikonfigurasi.</span>
        </div>
      )}
    </section>
  );
}
