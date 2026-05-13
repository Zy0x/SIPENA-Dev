import { useEffect, useMemo, useState } from "react";

import type {
  ColumnValueMode,
  SmartImportAssistResponse,
  SpreadsheetPreviewColumn,
} from "@/lib/gradeImport";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { buildColumnReasonHint, reasonToneClass } from "./importReasonHints";

type TargetMode =
  | "keep"
  | "sts"
  | "sas"
  | "ignore"
  | `assignment:${string}`
  | "new_assignment"
  | "new_chapter_assignment";

type TargetChoice = "keep" | "sts" | "sas" | "assignment" | "create" | "ignore";

export type ColumnTargetDraft =
  | { kind: "existing_assignment"; assignmentId: string }
  | { kind: "create_assignment"; chapterId: string; assignmentName: string }
  | { kind: "create_chapter_and_assignment"; chapterName: string; assignmentName: string }
  | { kind: "sts" }
  | { kind: "sas" }
  | { kind: "ignore" };

export interface ColumnSettingsAssignmentOption {
  id: string;
  label: string;
  chapterId: string;
  chapterName?: string;
  assignmentName: string;
}

export interface ColumnSettingsChapterOption {
  id: string;
  name: string;
}

function columnModeLabel(mode: ColumnValueMode): string {
  if (mode === "overwrite_existing") return "Timpa setelah konfirmasi";
  if (mode === "skip_existing") return "Lewati nilai lama";
  return "Isi jika kosong";
}

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sourceTaskName(column: SpreadsheetPreviewColumn): string {
  const source = cleanName(column.sourceHeader || column.header);
  if (column.assignmentName) return column.assignmentName;
  const parts = source.split(/\s+-\s+/);
  return cleanName(parts[parts.length - 1] || source) || "Tugas Baru";
}

function sourceChapterName(column: SpreadsheetPreviewColumn): string {
  if (column.chapterName) return column.chapterName;
  const source = cleanName(column.sourceHeader || column.header);
  const parts = source.split(/\s+-\s+/);
  return parts.length > 1 ? cleanName(parts[0]) : "BAB Baru";
}

function targetCurrentAvailable(column: SpreadsheetPreviewColumn): boolean {
  if (column.gradeType === "sts" || column.gradeType === "sas") return true;
  return Boolean(column.assignmentId && !column.isNewStructure);
}

function defaultTargetMode(column: SpreadsheetPreviewColumn): TargetMode {
  if (column.gradeType === "sts") return "sts";
  if (column.gradeType === "sas") return "sas";
  if (column.isNewStructure) return "ignore";
  if (column.assignmentId) return "keep";
  return "ignore";
}

function targetChoiceFromMode(targetMode: TargetMode): TargetChoice {
  if (targetMode.startsWith("assignment:")) return "assignment";
  if (targetMode === "new_assignment" || targetMode === "new_chapter_assignment") return "create";
  if (targetMode === "sts") return "sts";
  if (targetMode === "sas") return "sas";
  if (targetMode === "ignore") return "ignore";
  return "keep";
}

function targetModeLabel(targetMode: TargetMode, column: SpreadsheetPreviewColumn, assignments: ColumnSettingsAssignmentOption[]): string {
  if (targetMode === "keep") return column.targetLabel || "Target saat ini";
  if (targetMode === "sts") return "STS";
  if (targetMode === "sas") return "SAS";
  if (targetMode === "ignore") return "Lewati kolom";
  if (targetMode === "new_assignment") return "Buat tugas baru";
  if (targetMode === "new_chapter_assignment") return "Buat BAB + tugas";
  const assignmentId = targetMode.replace("assignment:", "");
  return assignments.find((assignment) => assignment.id === assignmentId)?.label || "Tugas lain";
}

export function ColumnSettingsOverlay({
  column,
  assignments,
  chapters,
  onClose,
  onSetInclude,
  onSetHeader,
  onSetValueMode,
  onSetTarget,
  onResetColumnSelection,
  aiAssist,
}: {
  column: SpreadsheetPreviewColumn;
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  onClose: () => void;
  onSetInclude: (column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetHeader: (column: SpreadsheetPreviewColumn, header: string) => void;
  onSetValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onSetTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
  aiAssist?: SmartImportAssistResponse | null;
}) {
  const [headerLabel, setHeaderLabel] = useState(column.header);
  const [targetMode, setTargetMode] = useState<TargetMode>(() => defaultTargetMode(column));
  const [selectedChapterId, setSelectedChapterId] = useState(column.chapterId || chapters[0]?.id || "");
  const [newChapterName, setNewChapterName] = useState(sourceChapterName(column));
  const [newAssignmentName, setNewAssignmentName] = useState(sourceTaskName(column));
  const [overwriteChecked, setOverwriteChecked] = useState(Boolean(column.overwriteConfirmed));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showReasonDetail, setShowReasonDetail] = useState(false);

  useEffect(() => {
    setHeaderLabel(column.header);
    setTargetMode(defaultTargetMode(column));
    setSelectedChapterId(column.chapterId || chapters[0]?.id || "");
    setNewChapterName(sourceChapterName(column));
    setNewAssignmentName(sourceTaskName(column));
    setOverwriteChecked(Boolean(column.overwriteConfirmed));
  }, [chapters, column]);

  const activeMode = column.effectiveValueMode || "fill_empty_only";
  const reason = useMemo(() => buildColumnReasonHint(column, aiAssist), [aiAssist, column]);
  const targetChoice = targetChoiceFromMode(targetMode);
  const canApplyTarget = useMemo(() => {
    if (targetMode === "keep") return true;
    if (targetMode === "new_assignment") return Boolean(selectedChapterId && cleanName(newAssignmentName));
    if (targetMode === "new_chapter_assignment") return Boolean(cleanName(newChapterName) && cleanName(newAssignmentName));
    if (targetMode.startsWith("assignment:")) return Boolean(targetMode.replace("assignment:", ""));
    return true;
  }, [newAssignmentName, newChapterName, selectedChapterId, targetMode]);

  const chooseTarget = (choice: TargetChoice) => {
    if (choice === "assignment") {
      setTargetMode(column.assignmentId ? `assignment:${column.assignmentId}` : assignments[0]?.id ? `assignment:${assignments[0].id}` : "ignore");
      return;
    }
    if (choice === "create") {
      setTargetMode(column.chapterId || selectedChapterId ? "new_assignment" : "new_chapter_assignment");
      return;
    }
    setTargetMode(choice);
  };

  const applyTarget = () => {
    const nextHeader = cleanName(headerLabel);
    onSetHeader(column, nextHeader || column.sourceHeader || column.header);

    if (targetMode === "keep") {
      if (!targetCurrentAvailable(column)) {
        onClose();
        return;
      }
      onSetInclude(column, true);
      if (column.isNewStructure && column.chapterId && cleanName(newAssignmentName)) {
        onSetTarget(column, {
          kind: "create_assignment",
          chapterId: column.chapterId,
          assignmentName: cleanName(newAssignmentName),
        });
        onSetInclude(column, true);
      } else if (column.isNewStructure && cleanName(newChapterName) && cleanName(newAssignmentName)) {
        onSetTarget(column, {
          kind: "create_chapter_and_assignment",
          chapterName: cleanName(newChapterName),
          assignmentName: cleanName(newAssignmentName),
        });
        onSetInclude(column, true);
      }
      onClose();
      return;
    }
    if (targetMode === "ignore") {
      onSetTarget(column, { kind: "ignore" });
      onSetInclude(column, false);
      onClose();
      return;
    }
    if (targetMode === "sts" || targetMode === "sas") {
      onSetTarget(column, { kind: targetMode });
      onSetInclude(column, true);
      onClose();
      return;
    }
    if (targetMode === "new_assignment") {
      onSetTarget(column, {
        kind: "create_assignment",
        chapterId: selectedChapterId,
        assignmentName: cleanName(newAssignmentName),
      });
      onSetInclude(column, true);
      onClose();
      return;
    }
    if (targetMode === "new_chapter_assignment") {
      onSetTarget(column, {
        kind: "create_chapter_and_assignment",
        chapterName: cleanName(newChapterName),
        assignmentName: cleanName(newAssignmentName),
      });
      onSetInclude(column, true);
      onClose();
      return;
    }

    onSetTarget(column, {
      kind: "existing_assignment",
      assignmentId: targetMode.replace("assignment:", ""),
    });
    onSetInclude(column, true);
    onClose();
  };

  return (
    <div className="sipena-column-overlay" role="dialog" aria-modal="true" aria-labelledby="sipena-column-overlay-title">
      <button type="button" className="sipena-column-overlay-backdrop" aria-label="Tutup pengaturan kolom" onClick={onClose} />
      <section className="sipena-column-overlay-panel">
        <div className="sipena-column-overlay-header">
          <div>
            <h3 id="sipena-column-overlay-title" className="sipena-column-overlay-title">Atur kolom nilai</h3>
            <p className="sipena-column-overlay-desc">
              Tentukan tujuan kolom ini sebelum import.
            </p>
          </div>
          <button type="button" className="sipena-column-overlay-close" aria-label="Tutup pengaturan kolom" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="sipena-column-overlay-body">
          <div className={`sipena-reason-card ${reasonToneClass(reason.tone)}`}>
            <div className="min-w-0">
              <div className="sipena-reason-kicker">
                <span>{reason.source === "hybrid" ? "Analisis SIPENA + AI" : "Analisis SIPENA"}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="sipena-reason-help" aria-label="Lihat alasan lengkap">
                      i
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[280px] text-xs leading-5">
                    {reason.description}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="sipena-reason-title">{reason.label}</p>
              <p className="sipena-reason-desc">Target: {targetModeLabel(targetMode, column, assignments)}</p>
              {showReasonDetail ? <p className="sipena-reason-desc sipena-reason-desc-full">{reason.description}</p> : null}
            </div>
            <span className="sipena-reason-action">{reason.actionLabel}</span>
          </div>
          <button type="button" className="sipena-column-detail-toggle" onClick={() => setShowReasonDetail((current) => !current)}>
            {showReasonDetail ? "Sembunyikan detail" : "Lihat detail"}
          </button>

          <div className="sipena-column-stat-grid">
            <span><b>{column.stats?.validValues || 0}</b> nilai terbaca</span>
            <span><b>{column.stats?.willFill || 0}</b> akan diisi</span>
            <span><b>{(column.stats?.skippedExisting || 0) + (column.stats?.skippedManual || 0)}</b> dilewati</span>
            <span><b>{column.stats?.overwrite || 0}</b> akan ditimpa</span>
          </div>

          <div className="sipena-column-field sipena-column-target-section">
            <span>Target kolom nilai</span>
            {column.isNewStructure ? (
              <div className="sipena-column-suggestion-card">
                <b>Kolom baru</b>
                <p>
                  {`Saran: ${newChapterName && newAssignmentName ? `${newChapterName} - ${newAssignmentName}` : "BAB/tugas baru"}. Simpan hanya jika target ini benar.`}
                </p>
              </div>
            ) : null}

            <select
              className="sipena-column-target-select"
              value={targetChoice}
              onChange={(event) => chooseTarget(event.target.value as TargetChoice)}
              aria-label="Target kolom nilai"
            >
              {targetCurrentAvailable(column) ? (
                <option value="keep">Target saat ini - {column.targetLabel || "hasil baca SIPENA"}</option>
              ) : null}
              <option value="sts">STS - nilai tengah semester</option>
              <option value="sas">SAS - nilai akhir semester</option>
              <option value="assignment" disabled={!assignments.length}>
                {assignments.length ? "Tugas lain - pilih tugas existing" : "Tugas lain - belum ada tugas"}
              </option>
              <option value="create">Buat baru - tugas atau BAB baru</option>
              <option value="ignore">Lewati - kolom tidak disimpan</option>
            </select>
            <p className="sipena-column-target-summary">
              Target dipilih: <b>{targetModeLabel(targetMode, column, assignments)}</b>
            </p>

            {targetChoice === "assignment" ? (
              <label className="sipena-column-field sipena-column-nested-field">
                <span>Tugas tujuan</span>
                <select value={targetMode.startsWith("assignment:") ? targetMode : `assignment:${assignments[0]?.id || ""}`} onChange={(event) => setTargetMode(event.target.value as TargetMode)}>
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={`assignment:${assignment.id}`}>
                      {assignment.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {targetChoice === "create" ? (
              <div className="sipena-column-create-target">
                <div className="sipena-column-mode-list" aria-label="Jenis target baru">
                  <label className="sipena-column-mode-item">
                    <input
                      type="radio"
                      name={`column-create-mode-${column.id}`}
                      checked={targetMode === "new_assignment"}
                      onChange={() => setTargetMode("new_assignment")}
                    />
                    <span>Tugas baru di BAB ini</span>
                  </label>
                  <label className="sipena-column-mode-item">
                    <input
                      type="radio"
                      name={`column-create-mode-${column.id}`}
                      checked={targetMode === "new_chapter_assignment"}
                      onChange={() => setTargetMode("new_chapter_assignment")}
                    />
                    <span>BAB + tugas baru</span>
                  </label>
                </div>

                {targetMode === "new_assignment" ? (
                  <div className="sipena-column-split">
                    <label className="sipena-column-field">
                      <span>BAB</span>
                      <select value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)}>
                        {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}
                      </select>
                    </label>
                    <label className="sipena-column-field">
                      <span>Nama tugas baru</span>
                      <input value={newAssignmentName} onChange={(event) => setNewAssignmentName(event.target.value)} />
                    </label>
                  </div>
                ) : null}

                {targetMode === "new_chapter_assignment" ? (
                  <div className="sipena-column-split">
                    <label className="sipena-column-field">
                      <span>Nama BAB baru</span>
                      <input value={newChapterName} onChange={(event) => setNewChapterName(event.target.value)} />
                    </label>
                    <label className="sipena-column-field">
                      <span>Nama tugas baru</span>
                      <input value={newAssignmentName} onChange={(event) => setNewAssignmentName(event.target.value)} />
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <button type="button" className="sipena-column-advanced-toggle" onClick={() => setShowAdvanced((current) => !current)}>
            {showAdvanced ? "Sembunyikan opsi lanjutan" : "Opsi lanjutan"}
          </button>

          {showAdvanced ? (
            <>
          <label className="sipena-column-field">
            <span>Nama kolom di preview</span>
            <input
              value={headerLabel}
              onChange={(event) => setHeaderLabel(event.target.value)}
              placeholder="Contoh: BAB 1 - Tugas 2"
            />
            <small>Nama ini hanya mengatur preview import, bukan mengganti nama tugas existing di database.</small>
          </label>

          <div className="sipena-column-mode-list" aria-label="Perlakuan nilai kolom">
            {(["fill_empty_only", "skip_existing", "overwrite_existing"] as ColumnValueMode[]).map((mode) => (
              <label key={mode} className="sipena-column-mode-item">
                <input
                  type="radio"
                  name={`column-overlay-mode-${column.id}`}
                  checked={activeMode === mode}
                  onChange={() => onSetValueMode(column, mode, mode === "overwrite_existing" ? overwriteChecked : false)}
                />
                <span>{columnModeLabel(mode)}</span>
              </label>
            ))}
          </div>

          {activeMode === "overwrite_existing" ? (
            <label className="sipena-column-danger-confirm">
              <input
                type="checkbox"
                checked={overwriteChecked || Boolean(column.overwriteConfirmed)}
                onChange={(event) => {
                  setOverwriteChecked(event.target.checked);
                  onSetValueMode(column, "overwrite_existing", event.target.checked);
                }}
              />
              <span>Berisiko menimpa nilai: saya paham nilai lama pada kolom ini dapat diganti.</span>
            </label>
          ) : null}
            </>
          ) : null}
        </div>

        <div className="sipena-column-overlay-actions">
          <button type="button" className="sipena-column-btn sipena-column-btn-primary" onClick={applyTarget} disabled={!canApplyTarget}>
            Simpan
          </button>
          <button
            type="button"
            className="sipena-column-btn sipena-column-btn-warning"
            onClick={() => {
              onSetTarget(column, { kind: "ignore" });
              onSetInclude(column, false);
              onClose();
            }}
          >
            Lewati kolom
          </button>
          {showAdvanced ? (
            <button type="button" className="sipena-column-btn sipena-column-btn-subtle" onClick={() => onResetColumnSelection(column)}>
              Reset
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
