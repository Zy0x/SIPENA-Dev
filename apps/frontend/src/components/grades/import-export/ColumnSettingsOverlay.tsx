import { useEffect, useMemo, useState } from "react";

import type {
  ColumnValueMode,
  SpreadsheetPreviewColumn,
} from "@/lib/gradeImport";

type TargetMode =
  | "keep"
  | "sts"
  | "sas"
  | "ignore"
  | `assignment:${string}`
  | "new_assignment"
  | "new_chapter_assignment";

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
  if (mode === "overwrite_existing") return "Timpa nilai lama pada kolom ini";
  if (mode === "skip_existing") return "Lewati nilai yang sudah ada";
  return "Isi nilai kosong saja";
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

function defaultTargetMode(column: SpreadsheetPreviewColumn): TargetMode {
  if (column.gradeType === "sts") return "sts";
  if (column.gradeType === "sas") return "sas";
  if (column.assignmentId) return `assignment:${column.assignmentId}`;
  if (column.isNewStructure && column.chapterId) return "new_assignment";
  if (column.isNewStructure) return "new_chapter_assignment";
  return "keep";
}

function TargetQuickButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sipena-column-target-card${active ? " sipena-column-target-card-active" : ""}`}
      onClick={onClick}
    >
      <span>{title}</span>
      <small>{description}</small>
    </button>
  );
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
  onBulkColumnAction,
  onResetColumnSelection,
}: {
  column: SpreadsheetPreviewColumn;
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  onClose: () => void;
  onSetInclude: (column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetHeader: (column: SpreadsheetPreviewColumn, header: string) => void;
  onSetValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onSetTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
}) {
  const [headerLabel, setHeaderLabel] = useState(column.header);
  const [targetMode, setTargetMode] = useState<TargetMode>(() => defaultTargetMode(column));
  const [selectedChapterId, setSelectedChapterId] = useState(column.chapterId || chapters[0]?.id || "");
  const [newChapterName, setNewChapterName] = useState(sourceChapterName(column));
  const [newAssignmentName, setNewAssignmentName] = useState(sourceTaskName(column));
  const [overwriteChecked, setOverwriteChecked] = useState(Boolean(column.overwriteConfirmed));

  useEffect(() => {
    setHeaderLabel(column.header);
    setTargetMode(defaultTargetMode(column));
    setSelectedChapterId(column.chapterId || chapters[0]?.id || "");
    setNewChapterName(sourceChapterName(column));
    setNewAssignmentName(sourceTaskName(column));
    setOverwriteChecked(Boolean(column.overwriteConfirmed));
  }, [chapters, column]);

  const activeMode = column.effectiveValueMode || "fill_empty_only";
  const canApplyTarget = useMemo(() => {
    if (targetMode === "keep") return true;
    if (targetMode === "new_assignment") return Boolean(selectedChapterId && cleanName(newAssignmentName));
    if (targetMode === "new_chapter_assignment") return Boolean(cleanName(newChapterName) && cleanName(newAssignmentName));
    if (targetMode.startsWith("assignment:")) return Boolean(targetMode.replace("assignment:", ""));
    return true;
  }, [newAssignmentName, newChapterName, selectedChapterId, targetMode]);

  const applyTarget = () => {
    const nextHeader = cleanName(headerLabel);
    onSetHeader(column, nextHeader || column.sourceHeader || column.header);

    if (targetMode === "keep") {
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
            <h3 id="sipena-column-overlay-title" className="sipena-column-overlay-title">Atur kolom</h3>
            <p className="sipena-column-overlay-desc">
              Pilih apakah kolom ini dipakai, arahnya ke tugas mana, dan bagaimana nilai lama diperlakukan.
            </p>
          </div>
          <button type="button" className="sipena-column-overlay-close" aria-label="Tutup pengaturan kolom" onClick={onClose}>
            Tutup
          </button>
        </div>

        <div className="sipena-column-overlay-body">
          <label className="sipena-column-field">
            <span>Nama kolom di preview</span>
            <input
              value={headerLabel}
              onChange={(event) => setHeaderLabel(event.target.value)}
              placeholder="Contoh: BAB 1 - Tugas 2"
            />
            <small>Nama ini hanya mengatur preview import, bukan mengganti nama tugas existing di database.</small>
          </label>

          <div className="sipena-column-switch-row">
            <div>
              <p className="sipena-column-section-title">Status kolom</p>
              <p className="sipena-column-muted">{column.effectiveInclude === false ? "Kolom dilewati." : "Kolom dipakai untuk import."}</p>
            </div>
            <label className="sipena-column-switch">
              <input
                type="checkbox"
                checked={column.effectiveInclude !== false}
                onChange={(event) => onSetInclude(column, event.target.checked)}
              />
              <span>{column.effectiveInclude === false ? "Dilewati" : "Dipakai"}</span>
            </label>
          </div>

          <div className="sipena-column-field">
            <span>Target kolom nilai</span>
            {column.isNewStructure ? (
              <div className="sipena-column-suggestion-card">
                <b>Kolom baru terdeteksi</b>
                <p>
                  SIPENA membaca kolom ini sebagai {newChapterName && newAssignmentName
                    ? `${newChapterName} - ${newAssignmentName}`
                    : "BAB/tugas baru"}. Setujui hanya jika targetnya benar.
                </p>
                <div className="sipena-column-suggestion-actions">
                  <button
                    type="button"
                    className="sipena-column-btn sipena-column-btn-primary"
                    onClick={() => setTargetMode(column.chapterId ? "new_assignment" : "new_chapter_assignment")}
                  >
                    Pakai saran SIPENA
                  </button>
                  <button type="button" className="sipena-column-btn" onClick={() => setTargetMode("ignore")}>
                    Lewati kolom
                  </button>
                </div>
              </div>
            ) : null}

            <div className="sipena-column-target-grid" aria-label="Pilihan cepat target kolom">
              <TargetQuickButton
                active={targetMode === "keep"}
                title="Target saat ini"
                description={column.targetLabel || "Gunakan hasil baca SIPENA"}
                onClick={() => setTargetMode("keep")}
              />
              <TargetQuickButton
                active={targetMode === "sts"}
                title="STS"
                description="Nilai tengah semester"
                onClick={() => setTargetMode("sts")}
              />
              <TargetQuickButton
                active={targetMode === "sas"}
                title="SAS"
                description="Nilai akhir semester"
                onClick={() => setTargetMode("sas")}
              />
              <TargetQuickButton
                active={targetMode === "new_assignment"}
                title="Tugas baru"
                description="Tambahkan ke BAB yang ada"
                onClick={() => setTargetMode("new_assignment")}
              />
              <TargetQuickButton
                active={targetMode === "new_chapter_assignment"}
                title="BAB + tugas baru"
                description="Buat struktur baru"
                onClick={() => setTargetMode("new_chapter_assignment")}
              />
              <TargetQuickButton
                active={targetMode === "ignore"}
                title="Lewati"
                description="Kolom tidak diimport"
                onClick={() => setTargetMode("ignore")}
              />
            </div>

            <select value={targetMode} onChange={(event) => setTargetMode(event.target.value as TargetMode)}>
              <option value="keep">Gunakan target saat ini</option>
              <option value="sts">Jadikan STS</option>
              <option value="sas">Jadikan SAS</option>
              {assignments.length ? (
                <optgroup label="Tugas yang sudah ada">
                  {assignments.map((assignment) => (
                    <option key={assignment.id} value={`assignment:${assignment.id}`}>
                      {assignment.label}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <option value="new_assignment">Buat tugas baru di BAB yang ada</option>
              <option value="new_chapter_assignment">Buat BAB dan tugas baru</option>
              <option value="ignore">Lewati kolom ini</option>
            </select>
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

          <div className="sipena-column-mode-list" aria-label="Mode nilai kolom">
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
              <span>Saya paham nilai lama pada kolom ini dapat diganti.</span>
            </label>
          ) : null}

          <div className="sipena-column-stat-grid">
            <span><b>{column.stats?.validValues || 0}</b> nilai terbaca</span>
            <span><b>{column.stats?.willFill || 0}</b> akan diisi</span>
            <span><b>{column.stats?.skippedManual || 0}</b> dilewati manual</span>
            <span><b>{column.stats?.overwrite || 0}</b> akan ditimpa</span>
          </div>
        </div>

        <div className="sipena-column-overlay-actions">
          <button type="button" className="sipena-column-btn sipena-column-btn-primary" onClick={applyTarget} disabled={!canApplyTarget}>
            Simpan pengaturan
          </button>
          <button type="button" className="sipena-column-btn" onClick={() => onBulkColumnAction(column, "include_valid")}>
            Include semua nilai valid
          </button>
          <button type="button" className="sipena-column-btn" onClick={() => onBulkColumnAction(column, "skip_existing")}>
            Lewati nilai yang sudah ada
          </button>
          <button type="button" className="sipena-column-btn sipena-column-btn-warning" onClick={() => onBulkColumnAction(column, "skip_all")}>
            Lewati kolom ini
          </button>
          <button type="button" className="sipena-column-btn" onClick={() => onResetColumnSelection(column)}>
            Reset pilihan
          </button>
        </div>
      </section>
    </div>
  );
}
