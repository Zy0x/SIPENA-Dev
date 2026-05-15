import { useCallback, useMemo, useRef, useState, type CSSProperties, type DragEvent } from "react";
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Upload,
  XCircle,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  buildGradeBackupRestoreBatchItems,
  buildGradeBackupRestorePlan,
  gradeBackupOperationLabel,
  readGradeBackupWorkbook,
  readWorkbookFile,
  type GradeBackupRestoreBatchBuildResult,
  type GradeBackupRestoreContext,
  type GradeBackupRestoreMode,
  type GradeBackupRestoreOperation,
  type GradeBackupRestorePlan,
} from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

type RestoreStep = "upload" | "validate" | "preview" | "confirm" | "running" | "result";

interface GradeBackupRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restoreContext: GradeBackupRestoreContext;
  onRestoreBatch: (items: Array<{
    studentId: string;
    gradeType: "assignment" | "sts" | "sas";
    value: number | null;
    assignmentId?: string;
    academicYearId?: string | null;
    semesterId?: string | null;
  }>) => Promise<{ savedCount: number; skippedUnchangedCount?: number } | void>;
  canUndoRestore?: boolean;
  onUndoRestore?: () => void | Promise<void>;
  onRestoreComplete?: () => void | Promise<void>;
}

const RESTORE_CONFIRMATION = "RESTORE NILAI";
const NULL_CONFIRMATION = "KOSONGKAN NILAI";

function statusTone(status: GradeBackupRestoreOperation["status"]) {
  if (status === "added") return "pass";
  if (status === "overwrite") return "warning";
  if (status === "invalid") return "destructive";
  return "outline";
}

function statusLabel(status: GradeBackupRestoreOperation["status"]) {
  if (status === "added") return "Akan ditambahkan";
  if (status === "overwrite") return "Akan menimpa";
  if (status === "unchanged") return "Sama";
  if (status === "invalid") return "Konflik";
  return "Dilewati";
}

function modeLabel(mode: GradeBackupRestoreMode) {
  if (mode === "fill_empty_only") return "Restore nilai kosong saja";
  if (mode === "overwrite_selected") return "Timpa nilai yang dipilih";
  return "Restore penuh dengan konfirmasi";
}

function valueLabel(value: number | null) {
  return value === null ? "Kosong" : String(value);
}

function operationNotes(operation: GradeBackupRestoreOperation): string[] {
  return [
    ...operation.conflicts.map((conflict) => conflict.message),
    ...operation.warnings,
  ];
}

function isIdentityWarning(conflict: GradeBackupRestoreOperation["conflicts"][number]) {
  return conflict.type === "student"
    && conflict.severity === "warning"
    && (conflict.code === "RESTORE_STUDENT_NAME_CHANGED" || conflict.code === "RESTORE_STUDENT_NISN_CHANGED");
}

function operationHasIdentityWarning(operation: GradeBackupRestoreOperation) {
  return operation.conflicts.some(isIdentityWarning);
}

function operationCellTitle(operation: GradeBackupRestoreOperation) {
  return [
    statusLabel(operation.status),
    `Saat ini: ${valueLabel(operation.currentValue)}`,
    `Backup: ${valueLabel(operation.backupValue)}`,
    ...operationNotes(operation),
  ].join(" / ");
}

function operationTargetKey(operation: Pick<GradeBackupRestoreOperation, "gradeType" | "assignmentId">) {
  return `${operation.gradeType}:${operation.assignmentId || ""}`;
}

function previewCellClass(status: GradeBackupRestoreOperation["status"]) {
  if (status === "added") return "sipena-preview-cell--new-value";
  if (status === "overwrite") return "sipena-preview-cell--overwrite";
  if (status === "invalid") return "sipena-preview-cell--invalid";
  if (status === "skipped") return "sipena-preview-cell--skipped";
  return "sipena-preview-cell--unchanged";
}

function stickyStyle(index: number): CSSProperties | undefined {
  if (index === 0) return { left: 0 };
  if (index === 1) return { left: "var(--sipena-preview-sticky-2)" };
  if (index === 2) return { left: "var(--sipena-preview-sticky-3)" };
  return undefined;
}

function operationIsIncludedInBatch(operation: GradeBackupRestoreOperation, batch: GradeBackupRestoreBatchBuildResult | null | undefined) {
  if (!batch) return false;
  return batch.items.some((item) => item.studentId === operation.studentId
    && item.gradeType === operation.gradeType
    && (item.assignmentId || "") === (operation.assignmentId || "")
    && item.value === operation.backupValue);
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border bg-background px-3 py-2", tone)}>
      <div className="truncate text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function OperationNoteBadge({ operation }: { operation: GradeBackupRestoreOperation }) {
  const notes = operationNotes(operation);
  if (notes.length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="sipena-preview-cell-note-badge" aria-label={`Lihat ${notes.length} catatan restore`}>
          {notes.length} catatan
          <span className="sipena-ai-note-badge">AI</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="max-w-[min(26rem,calc(100vw-2rem))]">
        <div className="space-y-1 text-xs">
          <p className="font-semibold text-blue-700">AI membantu menjelaskan catatan audit; keputusan restore tetap dihitung dari data backup dan halaman aktif.</p>
          {notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

const MODE_OPTIONS: Array<{
  value: GradeBackupRestoreMode;
  title: string;
  description: string;
  tooltip: string;
}> = [
  {
    value: "fill_empty_only",
    title: "Isi kosong saja",
    description: "Nilai lama tidak ditimpa.",
    tooltip: "Mode paling aman. Restore hanya mengisi cell yang saat ini kosong.",
  },
  {
    value: "overwrite_selected",
    title: "Timpa dipilih",
    description: "Pilih nilai timpa dari dialog.",
    tooltip: "Buka daftar nilai yang akan menimpa nilai lama, lalu pilih satu per satu atau sekaligus.",
  },
  {
    value: "full_confirmed",
    title: "Restore penuh",
    description: "Perlu konfirmasi final.",
    tooltip: "Mode paling berisiko. Semua nilai valid diproses setelah konfirmasi RESTORE NILAI.",
  },
];

function RestoreModeFooterCard({
  mode,
  onModeChange,
  overwriteCount,
  selectedOverwriteCount,
  identityWarningCount,
  allowIdentityMismatch,
  onAllowIdentityMismatchChange,
  onOpenOverwriteDialog,
}: {
  mode: GradeBackupRestoreMode;
  onModeChange: (mode: GradeBackupRestoreMode) => void;
  overwriteCount: number;
  selectedOverwriteCount: number;
  identityWarningCount: number;
  allowIdentityMismatch: boolean;
  onAllowIdentityMismatchChange: (checked: boolean) => void;
  onOpenOverwriteDialog: () => void;
}) {
  const [modeMenuOpen, setModeMenuOpen] = useState(false);

  return (
    <Popover open={modeMenuOpen} onOpenChange={setModeMenuOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="sipena-restore-mode-trigger">
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-blue-700">Mode restore</span>
          <span className="block truncate text-sm font-semibold text-slate-950">{modeLabel(mode)}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={10} className="sipena-restore-mode-popover">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Mode restore</div>
            <div className="mt-0.5 text-xs text-muted-foreground">Arahkan cursor ke opsi untuk melihat detail.</div>
          </div>
          <RadioGroup
            value={mode}
            onValueChange={(value) => {
              const nextMode = value as GradeBackupRestoreMode;
              onModeChange(nextMode);
              setModeMenuOpen(false);
              if (nextMode === "overwrite_selected") window.setTimeout(onOpenOverwriteDialog, 0);
            }}
            className="grid gap-2"
          >
            {MODE_OPTIONS.map((option) => (
              <Tooltip key={option.value}>
                <TooltipTrigger asChild>
                  <label className="flex cursor-pointer gap-2 rounded-lg border bg-white p-2 text-xs transition hover:border-blue-300 hover:bg-blue-50/60">
                    <RadioGroupItem value={option.value} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{option.title}</span>
                      <span className="block text-muted-foreground">
                        {option.value === "overwrite_selected"
                          ? `${selectedOverwriteCount}/${overwriteCount} nilai timpa dipilih.`
                          : option.description}
                      </span>
                    </span>
                  </label>
                </TooltipTrigger>
                <TooltipContent side="right" align="center" className="max-w-xs text-xs">
                  {option.tooltip}
                </TooltipContent>
              </Tooltip>
            ))}
          </RadioGroup>

          {mode === "overwrite_selected" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                setModeMenuOpen(false);
                window.setTimeout(onOpenOverwriteDialog, 0);
              }}
            >
              Atur nilai yang ditimpa
            </Button>
          ) : null}

          {identityWarningCount > 0 ? (
            <label className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/70 p-2 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100">
              <Checkbox checked={allowIdentityMismatch} onCheckedChange={(value) => onAllowIdentityMismatchChange(value === true)} />
              <span>Izinkan restore untuk {identityWarningCount} nilai dengan identitas siswa berubah setelah saya cek detailnya.</span>
            </label>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OverwriteSelectionDialog({
  open,
  onOpenChange,
  operations,
  selectedOperationIds,
  onToggleOperation,
  onSelectAll,
  onClear,
  onInspectOperation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operations: GradeBackupRestoreOperation[];
  selectedOperationIds: string[];
  onToggleOperation: (operationId: string, checked: boolean) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onInspectOperation: (operationId: string) => void;
}) {
  const selectedCount = operations.filter((operation) => selectedOperationIds.includes(operation.id)).length;
  const notedCount = operations.filter((operation) => operationNotes(operation).length > 0).length;

  return (
    <div className={cn("sipena-restore-overwrite-layer", open && "sipena-restore-overwrite-layer--open")} aria-hidden={!open}>
      <div className="sipena-restore-overwrite-backdrop" onClick={() => onOpenChange(false)} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="restore-overwrite-title"
        className="sipena-restore-overwrite-dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="restore-overwrite-title" className="text-base font-semibold text-slate-950">Pilih nilai yang akan ditimpa</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pilih hanya nilai yang memang boleh mengganti nilai halaman aktif.</p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="sipena-danger-icon-button" onClick={() => onOpenChange(false)} aria-label="Tutup daftar nilai timpa">
            <XCircle className="h-4 w-4" />
          </Button>
        </header>
        <div className="max-h-[min(72dvh,720px)] overflow-y-auto px-5 py-4 sm:px-6">
          <div className="mb-3 grid gap-2 sm:grid-cols-3">
            <SummaryMetric label="Nilai timpa" value={operations.length} tone="border-amber-200 bg-amber-50/50" />
            <SummaryMetric label="Dipilih" value={selectedCount} tone="border-blue-200 bg-blue-50/50" />
            <SummaryMetric label="Ada catatan" value={notedCount} tone={notedCount ? "border-red-200 bg-red-50/50" : undefined} />
          </div>
          {operations.length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Tidak ada nilai yang perlu ditimpa</AlertTitle>
              <AlertDescription>Mode ini belum memiliki kandidat overwrite pada backup yang dipilih.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid gap-2">
              {operations.map((operation) => {
                const notes = operationNotes(operation);
                const checked = selectedOperationIds.includes(operation.id);
                return (
                  <label
                    key={operation.id}
                    className={cn(
                      "grid cursor-pointer gap-3 rounded-xl border bg-white p-3 text-sm transition hover:border-blue-300 hover:bg-blue-50/40 sm:grid-cols-[auto_minmax(0,1fr)_auto]",
                      checked && "border-blue-300 bg-blue-50/70",
                      notes.length > 0 && "border-amber-200",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => onToggleOperation(operation.id, value === true)}
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{operation.studentName || operation.backupStudentName || operation.studentId}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {gradeBackupOperationLabel(operation)}{operation.chapterName ? ` - ${operation.chapterName}` : ""}
                      </span>
                      {notes.length > 0 ? (
                        <span className="mt-1 block truncate text-xs text-amber-700" title={notes.join(" / ")}>
                          <span className="sipena-ai-note-badge mr-1">AI</span>{notes[0]}
                        </span>
                      ) : null}
                    </span>
                    <span className="grid grid-cols-[auto_auto_auto] items-center gap-2 text-xs">
                      <span className="rounded-lg bg-muted px-2 py-1">
                        <span className="block text-muted-foreground">Saat ini</span>
                        <span className="font-semibold">{valueLabel(operation.currentValue)}</span>
                      </span>
                      <span className="text-muted-foreground">{"->"}</span>
                      <span className="rounded-lg bg-amber-50 px-2 py-1 text-amber-900">
                        <span className="block text-amber-700">Backup</span>
                        <span className="font-semibold">{valueLabel(operation.backupValue)}</span>
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="col-span-3 justify-self-end border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={(event) => {
                          event.preventDefault();
                          onInspectOperation(operation.id);
                          onOpenChange(false);
                        }}
                      >
                        Detail
                      </Button>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <footer className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button type="button" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={onClear}>Hapus pilihan</Button>
          <Button type="button" variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50" onClick={onSelectAll}>Pilih semua</Button>
          <Button type="button" className="bg-blue-600 text-white hover:bg-blue-700" onClick={() => onOpenChange(false)}>Selesai</Button>
        </footer>
      </section>
    </div>
  );
}

function RestoreOperationInspector({
  operation,
  mode,
  readOnly,
  checked,
  onCheckedChange,
  onClose,
}: {
  operation: GradeBackupRestoreOperation | null;
  mode: GradeBackupRestoreMode;
  readOnly: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onClose: () => void;
}) {
  if (!operation) {
    return (
      <aside className="sipena-restore-inspector sipena-restore-inspector--empty">
        <div className="text-sm font-semibold text-foreground">Detail nilai</div>
        <p className="mt-2 text-sm text-muted-foreground">Pilih salah satu cell nilai pada tabel untuk melihat detail restore.</p>
      </aside>
    );
  }

  const notes = operationNotes(operation);
  const canSelectOverwrite = mode === "overwrite_selected" && operation.status === "overwrite" && !readOnly;

  return (
    <aside className="sipena-restore-inspector sipena-restore-inspector--active" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">Detail nilai</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">{gradeBackupOperationLabel(operation)}</div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onClose}>Tutup</Button>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Siswa aktif</div>
          <div className="mt-1 font-semibold">{operation.studentName || "Tidak ditemukan"}</div>
          <div className="mt-1 text-xs text-muted-foreground">NISN: {operation.studentNisn || "Kosong"}</div>
          <div className="mt-1 break-all text-[11px] text-muted-foreground">student_id: {operation.studentId}</div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-semibold uppercase text-muted-foreground">Backup</div>
          <div className="mt-1 font-semibold">{operation.backupStudentName || "Tidak ada di _students"}</div>
          <div className="mt-1 text-xs text-muted-foreground">NISN backup: {operation.backupStudentNisn || "Kosong"}</div>
          <div className="mt-1 text-xs text-muted-foreground">Target: {gradeBackupOperationLabel(operation)}{operation.chapterName ? ` - ${operation.chapterName}` : ""}</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs text-muted-foreground">Saat ini</div>
            <div className="mt-1 text-lg font-semibold">{valueLabel(operation.currentValue)}</div>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs text-muted-foreground">Backup</div>
            <div className="mt-1 text-lg font-semibold">{valueLabel(operation.backupValue)}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant={statusTone(operation.status)}>{statusLabel(operation.status)}</Badge>
          {operationHasIdentityWarning(operation) ? <Badge variant="warning">Identitas berubah</Badge> : null}
          {operation.conflicts.some((conflict) => conflict.severity === "blocked") ? <Badge variant="destructive">Diblokir</Badge> : null}
        </div>

        {canSelectOverwrite ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
            <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
            <span>
              <span className="block font-semibold">Timpa nilai ini</span>
              <span className="text-xs text-muted-foreground">Hanya cell overwrite yang dicentang akan masuk batch restore.</span>
            </span>
          </label>
        ) : null}

        {notes.length > 0 ? (
          <div className="rounded-lg border bg-background p-3">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Catatan dan konflik</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              {notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg border bg-emerald-50/60 p-3 text-xs text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-200">
            Tidak ada catatan khusus untuk cell ini.
          </div>
        )}
      </div>
    </aside>
  );
}

function RestorePreviewTable({
  plan,
  mode,
  selectedOperationIds,
  selectedOperationId,
  batchPreview,
  readOnly = false,
  onSelectOperation,
  onToggleOperation,
}: {
  plan: GradeBackupRestorePlan;
  mode: GradeBackupRestoreMode;
  selectedOperationIds: string[];
  selectedOperationId: string | null;
  batchPreview?: GradeBackupRestoreBatchBuildResult | null;
  readOnly?: boolean;
  onSelectOperation: (operationId: string | null) => void;
  onToggleOperation: (operationId: string, checked: boolean) => void;
}) {
  const columns = useMemo(() => {
    const byKey = new Map<string, GradeBackupRestoreOperation>();
    plan.operations.forEach((operation) => {
      const key = operationTargetKey(operation);
      if (!byKey.has(key)) byKey.set(key, operation);
    });
    return Array.from(byKey.entries()).map(([key, operation]) => ({
      key,
      label: gradeBackupOperationLabel(operation),
      sublabel: operation.chapterName || (operation.gradeType === "assignment" ? "Tugas" : "Nilai akhir"),
    }));
  }, [plan.operations]);

  const rows = useMemo(() => {
    const orderedStudentIds = [
      ...plan.source.students.map((student) => student.studentId),
      ...plan.operations.map((operation) => operation.studentId),
    ];
    const uniqueIds = Array.from(new Set(orderedStudentIds));
    return uniqueIds
      .map((studentId) => {
        const operation = plan.operations.find((item) => item.studentId === studentId);
        const backupStudent = plan.source.students.find((student) => student.studentId === studentId);
        return {
          studentId,
          name: operation?.studentName || backupStudent?.name || operation?.backupStudentName || studentId,
          nisn: backupStudent?.nisn || "",
        };
      })
      .filter((row) => plan.operations.some((operation) => operation.studentId === row.studentId));
  }, [plan.operations, plan.source.students]);

  const operationByCell = useMemo(() => {
    const map = new Map<string, GradeBackupRestoreOperation>();
    plan.operations.forEach((operation) => {
      const key = `${operation.studentId}|${operationTargetKey(operation)}`;
      const current = map.get(key);
      if (!current || (current.status === "skipped" && operation.status !== "skipped")) {
        map.set(key, operation);
      }
    });
    return map;
  }, [plan.operations]);

  const statusBadgeText = (status: GradeBackupRestoreOperation["status"]) => {
    if (status === "overwrite") return "Timpa";
    if (status === "added") return "Baru";
    if (status === "invalid") return "Konflik";
    if (status === "unchanged") return "Sama";
    return "Skip";
  };
  const selectedOperation = selectedOperationId
    ? plan.operations.find((operation) => operation.id === selectedOperationId) || null
    : null;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="space-y-3 pb-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <CardTitle className="text-base">{readOnly ? "Preview akhir restore" : "Preview tabel restore"}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {readOnly
                ? "Cek ulang nilai yang akan diproses sebelum menjalankan restore."
                : "Klik cell untuk melihat detail, lalu pilih mode dan nilai yang akan diproses."}
            </p>
          </div>
          <div className="flex min-w-0 max-w-full gap-1.5 overflow-x-auto pb-1 lg:justify-end">
            {(["added", "overwrite", "unchanged", "skipped", "invalid"] as const).map((status) => (
              <Badge key={status} variant={statusTone(status)} className="shrink-0 px-2 py-0.5 text-[11px]">
                {statusLabel(status)}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="min-w-0 overflow-hidden">
        {columns.length === 0 || rows.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Tidak ada nilai untuk ditampilkan</AlertTitle>
            <AlertDescription>Backup terbaca, tetapi tidak ada baris nilai yang bisa dibuat menjadi preview tabel.</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className={cn("sipena-restore-preview-layout", selectedOperation && "sipena-restore-preview-layout--with-inspector")}>
              <section className="sipena-preview-grid-wrap">
                <div className="sipena-preview-scroll">
                <table className="sipena-preview-table">
                  <thead>
                    <tr>
                      {["No", "NISN", "Siswa"].map((header, index) => (
                        <th key={header} className="sipena-preview-sticky-left" style={stickyStyle(index)}>
                          <span className="block truncate">{header}</span>
                        </th>
                      ))}
                      {columns.map((column) => (
                        <th key={column.key}>
                          <span className="block truncate" title={column.label}>{column.label}</span>
                          <span className="sipena-preview-header-target" title={column.sublabel}>{column.sublabel}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={row.studentId}>
                        <td className="sipena-preview-cell sipena-preview-sticky-left sipena-preview-visual--neutral" style={stickyStyle(0)}>
                          <span className="sipena-preview-cell-value">{rowIndex + 1}</span>
                        </td>
                        <td className="sipena-preview-cell sipena-preview-sticky-left sipena-preview-visual--neutral" style={stickyStyle(1)}>
                          <span className="sipena-preview-cell-value" title={row.nisn || row.studentId}>{row.nisn || row.studentId}</span>
                        </td>
                        <td className="sipena-preview-cell sipena-preview-sticky-left sipena-preview-visual--neutral" style={stickyStyle(2)}>
                          <span className="sipena-preview-cell-value" title={row.name}>{row.name}</span>
                          <span className="sipena-preview-cell-details">
                            <span className="sipena-preview-cell-detail-line">{row.nisn || row.studentId}</span>
                          </span>
                        </td>
                        {columns.map((column) => {
                          const operation = operationByCell.get(`${row.studentId}|${column.key}`);
                          if (!operation) {
                            return (
                              <td key={column.key} className="sipena-preview-cell sipena-preview-cell--ignored text-center text-muted-foreground">
                                <span className="sipena-final-result-empty" aria-label="Tidak ada nilai">-</span>
                              </td>
                            );
                          }
                          const notes = operationNotes(operation);
                          const checked = selectedOperationIds.includes(operation.id);
                          const isSelected = selectedOperationId === operation.id;
                          const isIncluded = operationIsIncludedInBatch(operation, batchPreview);
                          const canCheck = mode === "overwrite_selected" && operation.status === "overwrite" && !readOnly;
                          const selectOperation = () => onSelectOperation(operation.id);
                          return (
                            <td
                              key={column.key}
                              className={cn(
                                "sipena-preview-cell",
                                previewCellClass(operation.status),
                                "sipena-restore-cell-interactive",
                                isSelected && "sipena-restore-cell-selected",
                                readOnly && isIncluded && "sipena-restore-cell-final-included",
                              )}
                              role="button"
                              tabIndex={0}
                              aria-label={`Detail restore ${row.name} ${column.label}`}
                              aria-pressed={isSelected}
                              onClick={selectOperation}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  selectOperation();
                                }
                              }}
                              title={operationCellTitle(operation)}
                            >
                              <div className="sipena-preview-cell-main">
                                <span className="min-w-0 flex-1">
                                  <span className="sipena-preview-cell-value">{valueLabel(operation.backupValue)}</span>
                                  <span className="sipena-preview-cell-details">
                                    <span className="sipena-preview-cell-detail-line">Saat ini: {valueLabel(operation.currentValue)}</span>
                                    <span className="sipena-preview-cell-detail-line">Backup: {valueLabel(operation.backupValue)}</span>
                                    {notes.length > 0 ? (
                                      <span className="sipena-preview-cell-detail-line" title={notes[0]}>
                                        {notes[0]}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                                <span className="sipena-preview-cell-badges">
                                  {canCheck ? (
                                    <span className="sipena-restore-cell-checkbox" onClick={(event) => event.stopPropagation()}>
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(value) => onToggleOperation(operation.id, value === true)}
                                        aria-label={`Pilih timpa ${row.name} ${column.label}`}
                                      />
                                    </span>
                                  ) : null}
                                  <span className="sipena-preview-cell-badge">{readOnly && isIncluded ? "Diproses" : statusBadgeText(operation.status)}</span>
                                  <OperationNoteBadge operation={operation} />
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </section>
              {selectedOperation ? (
                <RestoreOperationInspector
                  operation={selectedOperation}
                  mode={mode}
                  readOnly={readOnly}
                  checked={selectedOperationIds.includes(selectedOperation.id)}
                  onCheckedChange={(checked) => onToggleOperation(selectedOperation.id, checked)}
                  onClose={() => onSelectOperation(null)}
                />
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function GradeBackupRestoreDialog({
  open,
  onOpenChange,
  restoreContext,
  onRestoreBatch,
  canUndoRestore = false,
  onUndoRestore,
  onRestoreComplete,
}: GradeBackupRestoreDialogProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState<RestoreStep>("upload");
  const [fileName, setFileName] = useState("");
  const [plan, setPlan] = useState<GradeBackupRestorePlan | null>(null);
  const [readErrors, setReadErrors] = useState<string[]>([]);
  const [readWarnings, setReadWarnings] = useState<string[]>([]);
  const [isReading, setIsReading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [mode, setMode] = useState<GradeBackupRestoreMode>("fill_empty_only");
  const [allowContextMismatch, setAllowContextMismatch] = useState(false);
  const [allowIdentityMismatch, setAllowIdentityMismatch] = useState(false);
  const [includeNullOverwrites, setIncludeNullOverwrites] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [nullConfirmationText, setNullConfirmationText] = useState("");
  const [selectedOperationIds, setSelectedOperationIds] = useState<string[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);
  const [overwriteDialogOpen, setOverwriteDialogOpen] = useState(false);
  const [restoreResult, setRestoreResult] = useState<{
    savedCount: number;
    skippedUnchangedCount: number;
    batch: GradeBackupRestoreBatchBuildResult;
  } | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setFileName("");
    setPlan(null);
    setReadErrors([]);
    setReadWarnings([]);
    setIsReading(false);
    setIsDragActive(false);
    setIsRestoring(false);
    setMode("fill_empty_only");
    setAllowContextMismatch(false);
    setAllowIdentityMismatch(false);
    setIncludeNullOverwrites(false);
    setConfirmationText("");
    setNullConfirmationText("");
    setSelectedOperationIds([]);
    setSelectedOperationId(null);
    setOverwriteDialogOpen(false);
    setRestoreResult(null);
    setRestoreError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && isRestoring) return;
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }, [isRestoring, onOpenChange, reset]);

  const contextBlocked = useMemo(
    () => Boolean(plan?.contextConflicts.some((conflict) => conflict.severity === "blocked")),
    [plan],
  );
  const overwriteOperations = useMemo(
    () => plan?.operations.filter((operation) => operation.status === "overwrite") || [],
    [plan],
  );
  const batchPreview = useMemo(() => {
    if (!plan) return null;
    return buildGradeBackupRestoreBatchItems(plan, {
      mode,
      selectedOperationIds,
      allowContextMismatch,
      allowIdentityMismatch,
      includeNullOverwrites,
      confirmationText,
      nullOverwriteConfirmationText: nullConfirmationText,
    });
  }, [allowContextMismatch, allowIdentityMismatch, confirmationText, includeNullOverwrites, mode, nullConfirmationText, plan, selectedOperationIds]);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setIsReading(true);
    setFileName(file.name);
    setReadErrors([]);
    setReadWarnings([]);
    setRestoreResult(null);
    setRestoreError(null);
    try {
      const workbook = await readWorkbookFile(file);
      const source = readGradeBackupWorkbook(workbook);
      const nextPlan = buildGradeBackupRestorePlan(source, restoreContext);
      setPlan(nextPlan);
      setSelectedOperationIds(nextPlan.operations.filter((operation) => operation.status === "added").map((operation) => operation.id));
      setSelectedOperationId(null);
      setReadErrors(source.errors.map((error) => error.message));
      setReadWarnings(source.warnings.map((warning) => warning.message));
      setStep(source.ok ? "preview" : "validate");
    } catch (caught) {
      setReadErrors([caught instanceof Error ? caught.message : "Backup gagal dibaca. Pilih file backup SIPENA yang valid."]);
      setReadWarnings([]);
      setStep("validate");
    } finally {
      setIsReading(false);
    }
  }, [restoreContext]);

  const handleUploadDragOver = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (!isReading) setIsDragActive(true);
  }, [isReading]);

  const handleUploadDragLeave = useCallback((event: DragEvent<HTMLLabelElement>) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setIsDragActive(false);
  }, []);

  const handleUploadDrop = useCallback((event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (isReading) return;
    void handleFile(event.dataTransfer.files?.[0] || null);
  }, [handleFile, isReading]);

  const toggleOperation = useCallback((operationId: string, checked: boolean) => {
    setSelectedOperationIds((current) => checked
      ? Array.from(new Set([...current, operationId]))
      : current.filter((item) => item !== operationId));
  }, []);

  const selectAllOverwriteOperations = useCallback(() => {
    setSelectedOperationIds((current) => Array.from(new Set([...current, ...overwriteOperations.map((operation) => operation.id)])));
  }, [overwriteOperations]);

  const clearOverwriteOperations = useCallback(() => {
    setSelectedOperationIds((current) => current.filter((id) => !overwriteOperations.some((operation) => operation.id === id)));
  }, [overwriteOperations]);

  const executeRestore = useCallback(async () => {
    if (!batchPreview || !plan || batchPreview.blockedReasons.length > 0 || batchPreview.items.length === 0) return;
    setIsRestoring(true);
    setRestoreError(null);
    setStep("running");
    try {
      const result = await onRestoreBatch(batchPreview.items);
      await onRestoreComplete?.();
      const batchSaveResult = result || { savedCount: batchPreview.items.length, skippedUnchangedCount: 0 };
      setRestoreResult({
        savedCount: batchSaveResult.savedCount,
        skippedUnchangedCount: batchSaveResult.skippedUnchangedCount ?? 0,
        batch: batchPreview,
      });
      setStep("result");
    } catch (caught) {
      setRestoreError(caught instanceof Error ? caught.message : "Restore backup gagal. Tidak ada ringkasan hasil dari server.");
      setStep("confirm");
    } finally {
      setIsRestoring(false);
    }
  }, [batchPreview, onRestoreBatch, onRestoreComplete, plan]);

  const handleUndo = useCallback(async () => {
    if (!onUndoRestore || !canUndoRestore) return;
    setIsRestoring(true);
    try {
      await onUndoRestore();
      await onRestoreComplete?.();
    } finally {
      setIsRestoring(false);
    }
  }, [canUndoRestore, onRestoreComplete, onUndoRestore]);

  const canContinueFromPreview = Boolean(plan && plan.source.ok && plan.operations.length > 0);
  const canRunRestore = Boolean(batchPreview && batchPreview.items.length > 0 && batchPreview.blockedReasons.length === 0 && !isRestoring);
  const identityWarningCount = useMemo(
    () => plan?.operations.filter(operationHasIdentityWarning).length || 0,
    [plan],
  );

  return (
    <TooltipProvider delayDuration={120}>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sipena-grade-import-dialog sipena-grade-restore-dialog flex h-[calc(100dvh-0.25rem)] max-h-[980px] w-[calc(100vw-0.25rem)] max-w-[1880px] grid-rows-none flex-col gap-0 overflow-hidden rounded-[24px] border-slate-300 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:h-[min(96dvh,980px)] sm:w-[calc(100vw-0.75rem)] xl:w-[min(98vw,1880px)]">
        <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white/95 px-3 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-5">
          <div className="flex min-w-0 flex-col gap-2 pr-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/70">
              <ArchiveRestore className="h-5 w-5" />
            </div>
            <div className="min-w-0">
                <DialogTitle className="text-base font-semibold tracking-normal text-slate-950 dark:text-slate-50">
                  Restore Backup Nilai
                </DialogTitle>
                <DialogDescription className="mt-0.5 max-w-[min(76vw,920px)] truncate text-xs leading-5 text-muted-foreground" title="Restore selalu lewat preview dan konfirmasi sebelum nilai disimpan.">
                Restore selalu lewat preview dan konfirmasi sebelum nilai disimpan.
              </DialogDescription>
            </div>
          </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto overflow-x-hidden bg-slate-50/70 px-3 py-2.5 dark:bg-slate-950 sm:px-5">
          <main className="min-w-0 space-y-4">
            <section className="min-w-0 rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="grid min-w-[34rem] grid-cols-3 gap-2">
                {[
                  ["upload", "Upload & Validasi"],
                  ["preview", "Preview & Pilih Mode"],
                  ["confirm", "Konfirmasi"],
                ].map(([key, label], index) => (
                  <div
                    key={key}
                    className={cn(
                      "min-w-0 rounded-lg border px-3 py-2 text-xs font-medium",
                      step === key || (step === "validate" && key === "upload") || (step === "running" && key === "confirm") || (step === "result" && key === "confirm")
                        ? "border-primary bg-primary/10 text-primary"
                        : "bg-muted/30 text-muted-foreground",
                    )}
                  >
                    <span className="block truncate">{index + 1}. {label}</span>
                  </div>
                ))}
              </div>
            </div>
            </section>

            {step === "upload" || step === "validate" ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload file backup SIPENA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <label
                    htmlFor="grade-backup-restore-file"
                    className={cn(
                      "sipena-restore-dropzone",
                      isDragActive && "sipena-restore-dropzone--active",
                      isReading && "sipena-restore-dropzone--loading",
                    )}
                    onDragEnter={handleUploadDragOver}
                    onDragOver={handleUploadDragOver}
                    onDragLeave={handleUploadDragLeave}
                    onDrop={handleUploadDrop}
                    aria-disabled={isReading}
                  >
                    <span className="sipena-restore-dropzone-icon">
                      {isReading ? <Loader2 className="h-9 w-9 animate-spin" /> : <FileSpreadsheet className="h-9 w-9" />}
                    </span>
                    <span className="mt-4 text-base font-semibold">Tarik dan lepas workbook Backup Nilai SIPENA</span>
                    <span className="mt-1 max-w-xl text-sm text-muted-foreground">
                      Atau klik area ini untuk memilih file .xlsx. File harus memiliki sheet _manifest, _students, _structure, dan _grades.
                    </span>
                    <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
                      <Upload className="h-4 w-4" />
                      Pilih file backup
                    </span>
                    <Input
                      id="grade-backup-restore-file"
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="sr-only"
                      disabled={isReading}
                      onChange={(event) => void handleFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  {isReading ? (
                    <Alert>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <AlertTitle>Membaca backup</AlertTitle>
                      <AlertDescription>Workbook sedang divalidasi sebelum preview dibuat.</AlertDescription>
                    </Alert>
                  ) : null}
                  {fileName ? (
                    <div className="truncate rounded-lg bg-muted/50 px-3 py-2 text-sm" title={fileName}>
                      File: {fileName}
                    </div>
                  ) : null}
                  {readErrors.length > 0 ? (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Backup belum bisa dipakai</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-4">
                          {readErrors.slice(0, 4).map((error) => <li key={error}>{error}</li>)}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {readWarnings.length > 0 ? (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Backup memiliki catatan</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc space-y-1 pl-4">
                          {readWarnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {plan && (step === "preview" || step === "confirm" || step === "running" || step === "result") ? (
              <>
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <div className="grid min-w-[52rem] grid-cols-6 gap-2">
                    <SummaryMetric label="Tambah" value={plan.summary.added} />
                    <SummaryMetric label="Timpa" value={plan.summary.overwrite} tone="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20" />
                    <SummaryMetric label="Sama" value={plan.summary.unchanged} />
                    <SummaryMetric label="Dilewati" value={plan.summary.skipped} />
                    <SummaryMetric label="Konflik" value={plan.summary.invalid} tone="border-destructive/30 bg-destructive/5" />
                    <SummaryMetric label="Siap" value={plan.summary.restorable} tone="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20" />
                  </div>
                </div>

                {plan.contextConflicts.length > 0 ? (
                  <Alert variant={contextBlocked && !allowContextMismatch ? "destructive" : "default"}>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Konteks backup perlu dicek</AlertTitle>
                    <AlertDescription>
                      <div className="space-y-2">
                        {plan.contextConflicts.map((conflict) => (
                          <div key={`${conflict.code}-${conflict.field}`}>{conflict.message}</div>
                        ))}
                        {contextBlocked ? (
                          <label className="flex items-start gap-2 text-sm">
                            <Checkbox checked={allowContextMismatch} onCheckedChange={(value) => setAllowContextMismatch(value === true)} />
                            <span>Paksa restore lintas konteks. Hanya siswa dan tugas yang ID-nya tetap cocok yang akan diproses.</span>
                          </label>
                        ) : null}
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {plan.source.warnings.length > 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Audit backup memiliki catatan</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        {plan.source.warnings.slice(0, 4).map((warning) => <li key={warning.message}>{warning.message}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : null}

                {identityWarningCount > 0 ? (
                  <Alert variant={allowIdentityMismatch ? "default" : "destructive"}>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Identitas siswa berubah</AlertTitle>
                    <AlertDescription>
                      {identityWarningCount} nilai memiliki nama atau NISN aktif yang berbeda dari backup. Klik cell untuk cek detail, lalu aktifkan izin di footer preview jika restore tetap benar.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {step === "preview" ? (
                  <RestorePreviewTable
                    plan={plan}
                    mode={mode}
                    selectedOperationIds={selectedOperationIds}
                    selectedOperationId={selectedOperationId}
                    batchPreview={batchPreview}
                    onSelectOperation={setSelectedOperationId}
                    onToggleOperation={toggleOperation}
                  />
                ) : null}

                {step === "confirm" ? (
                  <>
                    <RestorePreviewTable
                      plan={plan}
                      mode={mode}
                      selectedOperationIds={selectedOperationIds}
                      selectedOperationId={selectedOperationId}
                      batchPreview={batchPreview}
                      readOnly
                      onSelectOperation={setSelectedOperationId}
                      onToggleOperation={toggleOperation}
                    />
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Konfirmasi akhir</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>{modeLabel(mode)}</AlertTitle>
                        <AlertDescription>
                          {batchPreview?.items.length || 0} nilai akan dikirim ke pipeline simpan nilai existing. Restore dapat di-undo dari riwayat terakhir.
                        </AlertDescription>
                      </Alert>
                      {mode === "full_confirmed" ? (
                        <div className="space-y-3 rounded-lg border bg-amber-50/50 p-3 dark:bg-amber-950/20">
                          <Label htmlFor="restore-confirmation">Ketik {RESTORE_CONFIRMATION}</Label>
                          <Input
                            id="restore-confirmation"
                            value={confirmationText}
                            onChange={(event) => setConfirmationText(event.target.value)}
                            placeholder={RESTORE_CONFIRMATION}
                          />
                          {includeNullOverwrites ? (
                            <>
                              <Label htmlFor="restore-null-confirmation">Ketik {NULL_CONFIRMATION}</Label>
                              <Input
                                id="restore-null-confirmation"
                                value={nullConfirmationText}
                                onChange={(event) => setNullConfirmationText(event.target.value)}
                                placeholder={NULL_CONFIRMATION}
                              />
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {batchPreview?.blockedReasons.length ? (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle>Restore belum bisa dijalankan</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc space-y-1 pl-4">
                              {batchPreview.blockedReasons.map((reason) => <li key={reason}>{reason}</li>)}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      ) : null}
                      {restoreError ? (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle>Restore gagal</AlertTitle>
                          <AlertDescription>{restoreError}</AlertDescription>
                        </Alert>
                      ) : null}
                      </CardContent>
                    </Card>
                  </>
                ) : null}

                {step === "running" ? (
                  <Card>
                    <CardContent className="flex min-h-[18rem] flex-col items-center justify-center gap-3 text-center">
                      <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      <div>
                        <div className="font-semibold">Restore sedang diproses</div>
                        <div className="text-sm text-muted-foreground">Jangan tutup dialog sampai proses selesai.</div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                {step === "result" && restoreResult ? (
                  <Card>
                    <CardContent className="space-y-4 p-5">
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertTitle>Restore selesai</AlertTitle>
                        <AlertDescription>
                          {restoreResult.savedCount} nilai disimpan, {restoreResult.skippedUnchangedCount} tidak berubah.
                        </AlertDescription>
                      </Alert>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <SummaryMetric label="Tambah" value={restoreResult.batch.summary.added} />
                        <SummaryMetric label="Timpa" value={restoreResult.batch.summary.overwritten} />
                        <SummaryMetric label="Kosongkan" value={restoreResult.batch.summary.cleared} />
                        <SummaryMetric label="Dilewati" value={restoreResult.batch.summary.skipped} />
                      </div>
                      {onUndoRestore ? (
                        <Button type="button" variant="outline" onClick={() => void handleUndo()} disabled={!canUndoRestore || isRestoring} className="w-full sm:w-auto">
                          {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                          Undo restore terakhir
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : null}
          </main>
        </div>

        <footer className="z-20 shrink-0 border-t border-slate-200 bg-white/95 px-3 py-1.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:px-5">
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {step === "preview" ? (
                <>
                  <RestoreModeFooterCard
                    mode={mode}
                    onModeChange={setMode}
                    overwriteCount={overwriteOperations.length}
                    selectedOverwriteCount={overwriteOperations.filter((operation) => selectedOperationIds.includes(operation.id)).length}
                    identityWarningCount={identityWarningCount}
                    allowIdentityMismatch={allowIdentityMismatch}
                    onAllowIdentityMismatchChange={setAllowIdentityMismatch}
                    onOpenOverwriteDialog={() => setOverwriteDialogOpen(true)}
                  />
                  {mode === "overwrite_selected" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 rounded-full border-amber-300 bg-amber-50 px-4 font-semibold text-amber-900 shadow-sm hover:bg-amber-100"
                      onClick={() => setOverwriteDialogOpen(true)}
                    >
                      Atur nilai timpa ({overwriteOperations.filter((operation) => selectedOperationIds.includes(operation.id)).length}/{overwriteOperations.length})
                    </Button>
                  ) : null}
                  {mode === "full_confirmed" ? (
                    <label className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-950 shadow-sm">
                      <Checkbox checked={includeNullOverwrites} onCheckedChange={(value) => setIncludeNullOverwrites(value === true)} />
                      <span className="truncate">Kosongkan nilai web jika backup kosong</span>
                    </label>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/70">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span className="truncate">{step === "result" ? "Restore selesai" : modeLabel(mode)}</span>
                  </span>
                  <span className="max-w-[min(78vw,760px)] truncate" title="Restore tidak menyimpan data sebelum preview, mode, dan konfirmasi selesai.">
                    Restore tidak menyimpan data sebelum preview, mode, dan konfirmasi selesai.
                  </span>
                </>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            {step !== "upload" && step !== "running" && step !== "result" ? (
              <Button type="button" variant="outline" className="min-h-10 w-full rounded-full sm:w-auto" onClick={() => setStep(step === "confirm" ? "preview" : "upload")} disabled={isRestoring}>
                Kembali
              </Button>
            ) : null}
            {step === "preview" ? (
              <Button type="button" className="sipena-guided-action min-h-10 w-full rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto" onClick={() => setStep("confirm")} disabled={!canContinueFromPreview}>
                Review Konfirmasi
              </Button>
            ) : null}
            {step === "confirm" ? (
              <Button type="button" className="sipena-guided-action min-h-10 w-full rounded-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto" onClick={() => void executeRestore()} disabled={!canRunRestore}>
                {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Jalankan Restore
              </Button>
            ) : null}
          </div>
          </div>
        </footer>
        </DialogContent>
      </Dialog>
      <OverwriteSelectionDialog
        open={overwriteDialogOpen}
        onOpenChange={setOverwriteDialogOpen}
        operations={overwriteOperations}
        selectedOperationIds={selectedOperationIds}
        onToggleOperation={toggleOperation}
        onSelectAll={selectAllOverwriteOperations}
        onClear={clearOverwriteOperations}
        onInspectOperation={setSelectedOperationId}
      />
    </TooltipProvider>
  );
}
