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
import { buildHeaderConfigurationQueue, type HeaderConfigurationIssue } from "./importIssueQueue";
import { getCellPreviewVisualState } from "./previewVisualState";

type TargetChoice = "current" | "sts" | "sas" | "assignment" | "new_assignment" | "new_chapter_assignment" | "ignore";
type HeaderFilter = "action" | "all" | "done";

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
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
  if (issue.column.type === "identity") return "Sudah benar";
  if (issue.category === "target_required") return "Simpan target & aturan";
  if (issue.category === "overwrite" && issue.valueMode === "overwrite_existing") return "Konfirmasi timpa";
  if (issue.category === "skipped") return "Tandai dilewati";
  return "Simpan target & aturan";
}

function previewValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || String(value).trim() === "") return "-";
  return String(value);
}

function headerPreviewValueCount(model: SpreadsheetPreviewModel, column: SpreadsheetPreviewColumn): number {
  return model.rows.reduce((count, row) => (
    row.cells.some((cell) => cell.columnId === column.id) ? count + 1 : count
  ), 0);
}

function headerDecisionSummary(issue: HeaderConfigurationIssue): string {
  if (issue.column.type === "identity") return "Kolom identitas hanya untuk mencocokkan siswa. Tidak ada nilai yang disimpan dari header ini.";
  if (issue.category === "skipped") return "Semua nilai pada header ini sama, kosong, atau sudah dilewati. Header aman tanpa konfirmasi.";
  if (issue.category === "target_required") return "Header ini punya nilai yang perlu target BAB/tugas sebelum bisa masuk ke tabel verifikasi.";
  if (issue.category === "overwrite") return `${issue.counts.overwrite} nilai berbeda dari SIPENA. Konfirmasi aturan satu kali untuk seluruh kolom.`;
  return `${issue.counts.newValues} nilai baru akan diisi ke sel kosong pada target header ini.`;
}

function filterLabel(filter: HeaderFilter): string {
  if (filter === "all") return "Semua";
  if (filter === "done") return "Selesai";
  return "Perlu aksi";
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
  onSetColumnValueMode,
  onBulkColumnAction,
  onAfterApply,
}: {
  issue: HeaderConfigurationIssue;
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onSetColumnTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
  onSetColumnValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onAfterApply: (issueId: string) => void;
}) {
  const column = issue.column;
  const [targetChoice, setTargetChoice] = useState<TargetChoice>(() => issue.category === "target_required" ? "new_assignment" : defaultTargetChoice(column));
  const [assignmentId, setAssignmentId] = useState(column.assignmentId || assignments[0]?.id || "");
  const [chapterId, setChapterId] = useState(column.chapterId || chapters[0]?.id || "");
  const [chapterName, setChapterName] = useState(column.chapterName || "BAB Baru");
  const [assignmentName, setAssignmentName] = useState(column.assignmentName || column.sourceHeader || column.header);

  useEffect(() => {
    setTargetChoice(issue.category === "target_required" ? "new_assignment" : defaultTargetChoice(column));
    setAssignmentId(column.assignmentId || assignments[0]?.id || "");
    setChapterId(column.chapterId || chapters[0]?.id || "");
    setChapterName(column.chapterName || "BAB Baru");
    setAssignmentName(column.assignmentName || column.sourceHeader || column.header);
  }, [assignments, chapters, column, issue.category]);

  const canSaveTarget = (targetChoice === "current" && hasUsableTarget(column))
    || targetChoice === "sts"
    || targetChoice === "sas"
    || targetChoice === "ignore"
    || (targetChoice === "assignment" && Boolean(assignmentId))
    || (targetChoice === "new_assignment" && Boolean(chapterId) && Boolean(cleanName(assignmentName)))
    || (targetChoice === "new_chapter_assignment" && Boolean(cleanName(chapterName)) && Boolean(cleanName(assignmentName)));

  const applyValueRule = () => {
    if (issue.valueMode === "overwrite_existing") {
      onSetColumnValueMode(column, "overwrite_existing", true);
      onApproveColumn(column);
      onBulkColumnAction(column, "include_valid");
      return;
    }
    onSetColumnValueMode(column, issue.valueMode, false);
    onApproveColumn(column);
    onBulkColumnAction(column, issue.valueMode === "skip_existing" ? "skip_existing" : "include_valid");
  };

  const applyTarget = () => {
    if (targetChoice === "current") {
      onApproveColumn(column);
      applyValueRule();
      onAfterApply(issue.id);
      return;
    }
    if (targetChoice === "ignore") {
      onIgnoreColumn(column);
      onBulkColumnAction(column, "skip_all");
      onAfterApply(issue.id);
      return;
    }
    if (targetChoice === "sts" || targetChoice === "sas") {
      onSetColumnTarget(column, { kind: targetChoice });
      applyValueRule();
      onAfterApply(issue.id);
      return;
    }
    if (targetChoice === "assignment" && assignmentId) {
      onSetColumnTarget(column, { kind: "existing_assignment", assignmentId });
      applyValueRule();
      onAfterApply(issue.id);
      return;
    }
    if (targetChoice === "new_assignment" && chapterId && cleanName(assignmentName)) {
      onSetColumnTarget(column, { kind: "create_assignment", chapterId, assignmentName: cleanName(assignmentName) });
      applyValueRule();
      onAfterApply(issue.id);
      return;
    }
    if (targetChoice === "new_chapter_assignment" && cleanName(chapterName) && cleanName(assignmentName)) {
      onSetColumnTarget(column, {
        kind: "create_chapter_and_assignment",
        chapterName: cleanName(chapterName),
        assignmentName: cleanName(assignmentName),
      });
      applyValueRule();
      onAfterApply(issue.id);
      return;
    }
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
      <div className="sipena-header-value-mode sipena-header-target-form-mode">
        <b>Aturan nilai kolom</b>
        <div>
          {(["fill_empty_only", "skip_existing", "overwrite_existing"] as ColumnValueMode[]).map((mode) => (
            <label key={mode} className={cn(issue.valueMode === mode && "sipena-header-value-mode--active")}>
              <input
                type="radio"
                name={`header-mode-${issue.column.id}`}
                checked={issue.valueMode === mode}
                onChange={() => onSetColumnValueMode(issue.column, mode, false)}
              />
              <span>{valueModeLabel(mode)}</span>
            </label>
          ))}
        </div>
        {issue.valueMode === "overwrite_existing" ? (
          <div className="sipena-header-overwrite-confirm">
            <span>
              Tombol ini mengizinkan penggantian <b>{issue.counts.overwrite} nilai lama</b> pada header ini.
            </span>
          </div>
        ) : null}
      </div>
      <button type="button" className="sipena-column-btn sipena-column-btn-primary sipena-header-target-save" onClick={applyTarget} disabled={!canSaveTarget}>
        {targetChoice === "ignore" ? "Lewati header" : headerPrimaryLabel(issue)}
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
    .slice(0, 6);

  return (
    <details className="sipena-header-preview" open={issue.category !== "skipped"}>
      <summary className="sipena-header-preview-head">
        <div>
          <b>Contoh nilai terdampak</b>
          <span>Menampilkan nilai paling penting dulu. Buka untuk cek bukti sebelum lanjut.</span>
        </div>
        <span>{rows.length} nilai</span>
      </summary>
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
    </details>
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
  const headers = useMemo(() => buildHeaderConfigurationQueue(model, selectionState), [model, selectionState]);
  const activeIssues = headers.filter((issue) => !issue.isResolved);
  const [headerFilter, setHeaderFilter] = useState<HeaderFilter>("action");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeIssueId, setActiveIssueId] = useState<string | null>(activeIssues[0]?.id || headers[0]?.id || null);
  const [openEvidenceByHeaderId, setOpenEvidenceByHeaderId] = useState<Record<string, boolean>>({});
  const selectedIssue = headers.find((issue) => issue.id === activeIssueId);
  const activeIssue = selectedIssue || activeIssues[0] || headers[0];
  const activeHeaderIndex = activeIssue ? Math.max(0, headers.findIndex((issue) => issue.id === activeIssue.id)) : -1;
  const completedHeaderCount = headers.filter((issue) => issue.isResolved).length;
  const totalHeaderCount = headers.length;
  const isEvidenceOpen = activeIssue ? Boolean(openEvidenceByHeaderId[activeIssue.id]) : false;
  const activePreviewCount = activeIssue ? headerPreviewValueCount(model, activeIssue.column) : 0;
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredHeaders = headers.filter((issue) => {
    if (headerFilter === "action" && issue.isResolved) return false;
    if (headerFilter === "done" && !issue.isResolved) return false;
    if (!normalizedSearch) return true;
    return [
      issue.title,
      issue.column.header,
      issue.column.targetLabel,
      issue.column.sourceHeader,
      issue.categoryLabel,
      issue.recommendedActionLabel,
    ].some((value) => (value || "").toLowerCase().includes(normalizedSearch));
  });

  useEffect(() => {
    if (!headers.length) {
      setActiveIssueId(null);
      return;
    }
    const currentIssue = headers.find((issue) => issue.id === activeIssueId);
    if (!activeIssueId || !currentIssue) {
      const next = activeIssues[0] || headers[0];
      setActiveIssueId(next.id);
    }
  }, [activeIssueId, activeIssues, headers]);

  const suggestion = activeIssue ? columnAiSuggestion(activeIssue.column, aiAssist) : undefined;
  const focusNextUnresolved = (currentId: string) => {
    const currentIndex = headers.findIndex((issue) => issue.id === currentId);
    const next = headers
      .slice(currentIndex + 1)
      .concat(headers.slice(0, Math.max(0, currentIndex)))
      .find((issue) => !issue.isResolved && issue.id !== currentId);
    if (next) setActiveIssueId(next.id);
  };
  const applyHeaderDecision = (issue: HeaderConfigurationIssue) => {
    if (issue.category === "target_required" && !hasUsableTarget(issue.column)) return;
    if (issue.category === "skipped") {
      onBulkColumnAction(issue.column, "skip_all");
      focusNextUnresolved(issue.id);
      return;
    }
    if (issue.category === "overwrite" && issue.valueMode === "overwrite_existing") {
      onSetColumnValueMode(issue.column, "overwrite_existing", true);
      onApproveColumn(issue.column);
      onBulkColumnAction(issue.column, "include_valid");
      focusNextUnresolved(issue.id);
      return;
    }
    onSetColumnValueMode(
      issue.column,
      issue.valueMode,
      false,
    );
    onApproveColumn(issue.column);
    onBulkColumnAction(issue.column, issue.valueMode === "skip_existing" ? "skip_existing" : "include_valid");
    focusNextUnresolved(issue.id);
  };
  const canApplyHeaderDecision = useMemo(() => {
    if (!activeIssue) return false;
    if (activeIssue.column.effectiveInclude === false || activeIssue.column.isIgnored) return true;
    if (activeIssue.category === "target_required") return hasUsableTarget(activeIssue.column);
    return true;
  }, [activeIssue]);
  const nextHeader = () => {
    if (!activeIssue || headers.length === 0) return;
    const next = headers[activeHeaderIndex + 1] || headers[0];
    setActiveIssueId(next.id);
  };
  const previousHeader = () => {
    if (!activeIssue || headers.length === 0) return;
    const previous = headers[activeHeaderIndex - 1] || headers[headers.length - 1];
    setActiveIssueId(previous.id);
  };
  const toggleActiveEvidence = () => {
    if (!activeIssue) return;
    setOpenEvidenceByHeaderId((current) => ({
      ...current,
      [activeIssue.id]: !current[activeIssue.id],
    }));
  };

  return (
    <section className="sipena-header-config-step">
      <div className="sipena-issue-step-header">
        <div>
          <h3>Konfigurasi Header</h3>
          <p>Periksa header dari awal sampai akhir. Header yang identik atau kosong langsung aman; hanya nilai baru atau berbeda yang perlu keputusan.</p>
        </div>
        <div className="sipena-issue-step-summary">
          <b>{completedHeaderCount}/{totalHeaderCount || 0}</b>
          <span>{activeIssues.length ? `${activeIssues.length} perlu aksi` : "semua aman"}</span>
        </div>
      </div>

      {headers.length ? (
        <div className="sipena-header-config-grid">
          <aside className="sipena-header-list" aria-label="Urutan header Excel">
            <div className="sipena-header-list-tools">
              <div className="sipena-header-filter-tabs" role="tablist" aria-label="Filter header">
                {(["action", "all", "done"] as HeaderFilter[]).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    className={cn(headerFilter === filter && "sipena-header-filter-tabs--active")}
                    onClick={() => setHeaderFilter(filter)}
                  >
                    {filterLabel(filter)}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari header"
                aria-label="Cari header"
              />
            </div>
            {filteredHeaders.map((issue) => {
              const headerIndex = headers.findIndex((item) => item.id === issue.id);
              return (
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
                <span className="sipena-header-list-state">{issue.isResolved ? "✓" : headerIndex + 1}</span>
                <span className="min-w-0">
                  <span className="sipena-header-list-meta">
                    <span>{issue.categoryLabel}</span>
                    <span>{issue.isResolved ? "Selesai" : issue.recommendedActionLabel}</span>
                  </span>
                  <b>{issue.title}</b>
                  <small>{headerDecisionSummary(issue)}</small>
                </span>
              </button>
            );})}
            {!filteredHeaders.length ? (
              <div className="sipena-header-list-empty">
                <b>Tidak ada header di filter ini.</b>
                <span>Ubah filter atau kata pencarian untuk melihat header lain.</span>
              </div>
            ) : null}
          </aside>

          {activeIssue ? (
            <div className="sipena-header-detail">
              <div className="sipena-header-detail-head">
                <div>
                  <span>Header {activeHeaderIndex + 1} dari {totalHeaderCount} / {activeIssue.categoryLabel}</span>
                  <h4>{activeIssue.column.header}</h4>
                  <p>{headerDecisionSummary(activeIssue)}</p>
                </div>
                <span className={cn("sipena-header-status", activeIssue.isResolved ? "sipena-header-status--done" : "sipena-header-status--pending")}>
                  {activeIssue.isResolved ? "Selesai" : "Perlu aksi"}
                </span>
              </div>
              <div className="sipena-header-sequence-actions">
                <button type="button" className="sipena-column-btn" onClick={previousHeader}>Sebelumnya</button>
                <button type="button" className="sipena-column-btn" onClick={nextHeader}>Header berikutnya</button>
              </div>

              <div className={cn("sipena-header-workspace", isEvidenceOpen && "sipena-header-workspace--evidence-open")}>
                <div className="sipena-header-editor-panel">
                  <div className="sipena-header-panel-title">
                    <div className="sipena-header-panel-title-row">
                      <b>Keputusan header</b>
                      <button type="button" className="sipena-column-btn" onClick={toggleActiveEvidence}>
                        {isEvidenceOpen ? "Sembunyikan contoh" : `Lihat contoh nilai (${activePreviewCount})`}
                      </button>
                    </div>
                    <span>Atur target dan aturan nilai untuk seluruh kolom ini.</span>
                  </div>

                  <dl className="sipena-header-counts sipena-header-counts--compact">
                    <div><dt>Baru</dt><dd>{activeIssue.counts.newValues}</dd></div>
                    <div><dt>Timpa</dt><dd>{activeIssue.counts.overwrite}</dd></div>
                    <div><dt>Dilewati</dt><dd>{activeIssue.counts.skipped}</dd></div>
                    <div><dt>Invalid</dt><dd>{activeIssue.counts.invalid}</dd></div>
                  </dl>

                  {activeIssue.column.type !== "identity" && !activeIssue.isResolved ? (
                    <>
                      <HeaderTargetForm
                        issue={activeIssue}
                        assignments={assignments}
                        chapters={chapters}
                        onApproveColumn={onApproveColumn}
                        onIgnoreColumn={onIgnoreColumn}
                        onSetColumnTarget={onSetColumnTarget}
                        onSetColumnValueMode={onSetColumnValueMode}
                        onBulkColumnAction={onBulkColumnAction}
                        onAfterApply={focusNextUnresolved}
                      />

                      <div className="sipena-header-secondary-actions">
                        <button type="button" className="sipena-column-btn sipena-column-btn-warning" onClick={() => {
                          onBulkColumnAction(activeIssue.column, "skip_all");
                          focusNextUnresolved(activeIssue.id);
                        }}>
                          Lewati header
                        </button>
                        <button type="button" className="sipena-column-btn" onClick={() => onResetColumnSelection(activeIssue.column)}>
                          Reset
                        </button>
                      </div>
                    </>
                  ) : null}

                  {activeIssue.column.type !== "identity" && activeIssue.isResolved ? (
                    <div className="sipena-header-resolved-note">
                      <b>Header selesai</b>
                      <span>Keputusan sudah diterapkan. Gunakan Reset jika ingin mengatur ulang header ini.</span>
                      <button type="button" className="sipena-column-btn" onClick={() => onResetColumnSelection(activeIssue.column)}>
                        Reset
                      </button>
                    </div>
                  ) : null}

                  {activeIssue.column.type === "identity" ? (
                    <div className="sipena-header-resolved-note">
                      <b>Header identitas</b>
                      <span>Kolom ini hanya dipakai untuk mencocokkan siswa dan otomatis dilewati saat simpan nilai.</span>
                    </div>
                  ) : null}
                </div>

                {isEvidenceOpen ? (
                  <div className="sipena-header-evidence-panel">
                    <div className="sipena-header-info">
                      <b>{activeIssue.detailTitle}</b>
                      <ul>{activeIssue.detailBullets.slice(0, 2).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
                      {suggestion ? (
                        <p><b>Saran AI:</b> {suggestion.reason} ({Math.round(suggestion.confidence * 100)}%).</p>
                      ) : null}
                    </div>

                    <HeaderColumnPreview model={model} issue={activeIssue} />
                  </div>
                ) : null}
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
