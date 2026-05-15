import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

type RestoreStep = "upload" | "validate" | "preview" | "mode" | "confirm" | "running" | "result";

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

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border bg-background px-3 py-2", tone)}>
      <div className="truncate text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 truncate text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function OperationRow({
  operation,
  selectable,
  checked,
  onCheckedChange,
}: {
  operation: GradeBackupRestoreOperation;
  selectable: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-3 text-sm md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
      <div className="flex items-start gap-3">
        {selectable ? (
          <Checkbox
            checked={checked}
            onCheckedChange={(value) => onCheckedChange(value === true)}
            aria-label={`Pilih restore ${operation.studentName || operation.backupStudentName || operation.studentId}`}
            className="mt-1"
          />
        ) : (
          <span className="mt-1 h-4 w-4" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <div className="font-medium text-foreground">
            {operation.studentName || operation.backupStudentName || operation.studentId}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {gradeBackupOperationLabel(operation)}
            {operation.chapterName ? ` - ${operation.chapterName}` : ""}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs md:max-w-[16rem]">
        <div className="rounded-md bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Saat ini</span>
          <div className="font-semibold">{operation.currentValue ?? "Kosong"}</div>
        </div>
        <div className="rounded-md bg-muted/50 px-2 py-1">
          <span className="text-muted-foreground">Backup</span>
          <div className="font-semibold">{operation.backupValue ?? "Kosong"}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Badge variant={statusTone(operation.status)}>{statusLabel(operation.status)}</Badge>
        {operation.conflicts.length > 0 ? <Badge variant="destructive">{operation.conflicts.length} konflik</Badge> : null}
        {operation.warnings.length > 0 ? <Badge variant="outline">{operation.warnings.length} catatan</Badge> : null}
      </div>
    </div>
  );
}

function RestorePreviewTable({ plan }: { plan: GradeBackupRestorePlan }) {
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
      map.set(`${operation.studentId}|${operationTargetKey(operation)}`, operation);
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

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="space-y-3 pb-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <CardTitle className="text-base">Preview tabel restore</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Bandingkan nilai backup dengan nilai halaman aktif sebelum memilih mode restore.
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
            <section className="sipena-preview-grid-wrap">
              <div className="sipena-preview-scroll">
                <table className="sipena-preview-table">
                  <thead>
                    <tr>
                      {["No", "ID", "Siswa"].map((header, index) => (
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
                          const hasNotes = operation.conflicts.length > 0 || operation.warnings.length > 0;
                          return (
                            <td
                              key={column.key}
                              className={cn("sipena-preview-cell", previewCellClass(operation.status))}
                              title={`${statusLabel(operation.status)} / Saat ini: ${valueLabel(operation.currentValue)} / Backup: ${valueLabel(operation.backupValue)}`}
                            >
                              <div className="sipena-preview-cell-main">
                                <span className="min-w-0 flex-1">
                                  <span className="sipena-preview-cell-value">{valueLabel(operation.backupValue)}</span>
                                  <span className="sipena-preview-cell-details">
                                    <span className="sipena-preview-cell-detail-line">Saat ini: {valueLabel(operation.currentValue)}</span>
                                    <span className="sipena-preview-cell-detail-line">Backup: {valueLabel(operation.backupValue)}</span>
                                    {hasNotes ? (
                                      <span className="sipena-preview-cell-detail-line">
                                        {operation.conflicts.length > 0 ? `${operation.conflicts.length} konflik` : `${operation.warnings.length} catatan`}
                                      </span>
                                    ) : null}
                                  </span>
                                </span>
                                <span className="sipena-preview-cell-badges">
                                  <span className="sipena-preview-cell-badge">{statusBadgeText(operation.status)}</span>
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
  const [isReading, setIsReading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [mode, setMode] = useState<GradeBackupRestoreMode>("fill_empty_only");
  const [allowContextMismatch, setAllowContextMismatch] = useState(false);
  const [includeNullOverwrites, setIncludeNullOverwrites] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [nullConfirmationText, setNullConfirmationText] = useState("");
  const [selectedOperationIds, setSelectedOperationIds] = useState<string[]>([]);
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
    setIsReading(false);
    setIsRestoring(false);
    setMode("fill_empty_only");
    setAllowContextMismatch(false);
    setIncludeNullOverwrites(false);
    setConfirmationText("");
    setNullConfirmationText("");
    setSelectedOperationIds([]);
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
      includeNullOverwrites,
      confirmationText,
      nullOverwriteConfirmationText: nullConfirmationText,
    });
  }, [allowContextMismatch, confirmationText, includeNullOverwrites, mode, nullConfirmationText, plan, selectedOperationIds]);

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setIsReading(true);
    setFileName(file.name);
    setReadErrors([]);
    setRestoreResult(null);
    setRestoreError(null);
    try {
      const workbook = await readWorkbookFile(file);
      const source = readGradeBackupWorkbook(workbook);
      const nextPlan = buildGradeBackupRestorePlan(source, restoreContext);
      setPlan(nextPlan);
      setSelectedOperationIds(nextPlan.operations.filter((operation) => operation.status === "added").map((operation) => operation.id));
      setReadErrors(source.errors.map((error) => error.message));
      setStep(source.ok ? "preview" : "validate");
    } catch (caught) {
      setReadErrors([caught instanceof Error ? caught.message : "Backup gagal dibaca. Pilih file backup SIPENA yang valid."]);
      setStep("validate");
    } finally {
      setIsReading(false);
    }
  }, [restoreContext]);

  const toggleOperation = useCallback((operationId: string, checked: boolean) => {
    setSelectedOperationIds((current) => checked
      ? Array.from(new Set([...current, operationId]))
      : current.filter((item) => item !== operationId));
  }, []);

  const selectColumn = useCallback((gradeType: string, assignmentId: string | undefined, checked: boolean) => {
    const ids = overwriteOperations
      .filter((operation) => operation.gradeType === gradeType && (operation.assignmentId || "") === (assignmentId || ""))
      .map((operation) => operation.id);
    setSelectedOperationIds((current) => {
      if (checked) return Array.from(new Set([...current, ...ids]));
      return current.filter((item) => !ids.includes(item));
    });
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

  return (
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
              <div className="grid min-w-[42rem] grid-cols-4 gap-2">
                {[
                  ["upload", "Upload"],
                  ["preview", "Preview"],
                  ["mode", "Mode"],
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
                  <div className="rounded-xl border border-dashed bg-muted/20 p-5 text-center">
                    <FileSpreadsheet className="mx-auto h-9 w-9 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">Pilih workbook Backup Nilai SIPENA (.xlsx)</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      File harus memiliki sheet _manifest, _students, _structure, dan _grades.
                    </p>
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="mt-4"
                      disabled={isReading}
                      onChange={(event) => void handleFile(event.target.files?.[0] || null)}
                    />
                  </div>
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
                </CardContent>
              </Card>
            ) : null}

            {plan && (step === "preview" || step === "mode" || step === "confirm" || step === "running" || step === "result") ? (
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

                {step === "preview" ? (
                  <RestorePreviewTable plan={plan} />
                ) : null}

                {step === "mode" || step === "confirm" ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Pilih mode restore</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <RadioGroup value={mode} onValueChange={(value) => setMode(value as GradeBackupRestoreMode)}>
                          {[
                            ["fill_empty_only", "Restore nilai kosong saja", "Default aman. Nilai lama tidak ditimpa."],
                            ["overwrite_selected", "Timpa nilai yang dipilih", "Pilih item overwrite satu per satu, per kolom, atau semua."],
                            ["full_confirmed", "Restore penuh dengan konfirmasi", "Mode berisiko. Butuh frasa konfirmasi."],
                          ].map(([value, title, description]) => (
                            <label key={value} className="flex cursor-pointer gap-3 rounded-lg border p-3">
                              <RadioGroupItem value={value} className="mt-1" />
                              <span>
                                <span className="block text-sm font-medium">{title}</span>
                                <span className="text-xs text-muted-foreground">{description}</span>
                              </span>
                            </label>
                          ))}
                        </RadioGroup>

                        {mode === "full_confirmed" ? (
                          <div className="space-y-3 rounded-lg border bg-amber-50/50 p-3 dark:bg-amber-950/20">
                            <Label htmlFor="restore-confirmation">Ketik {RESTORE_CONFIRMATION}</Label>
                            <Input
                              id="restore-confirmation"
                              value={confirmationText}
                              onChange={(event) => setConfirmationText(event.target.value)}
                              placeholder={RESTORE_CONFIRMATION}
                            />
                            <label className="flex items-start gap-2 text-sm">
                              <Checkbox checked={includeNullOverwrites} onCheckedChange={(value) => setIncludeNullOverwrites(value === true)} />
                              <span>Kosongkan nilai web jika backup kosong.</span>
                            </label>
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
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <CardTitle className="text-base">Item restore</CardTitle>
                          {mode === "overwrite_selected" ? (
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedOperationIds(Array.from(new Set([...selectedOperationIds, ...overwriteOperations.map((item) => item.id)])))}>
                                Pilih semua timpa
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedOperationIds(selectedOperationIds.filter((id) => !overwriteOperations.some((item) => item.id === id)))}>
                                Hapus pilihan
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {mode === "overwrite_selected" && overwriteOperations.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {Array.from(new Map(overwriteOperations.map((operation) => [
                              `${operation.gradeType}:${operation.assignmentId || ""}`,
                              operation,
                            ])).values()).map((operation) => (
                              <Button
                                key={`${operation.gradeType}:${operation.assignmentId || ""}`}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => selectColumn(operation.gradeType, operation.assignmentId, true)}
                              >
                                Pilih {gradeBackupOperationLabel(operation)}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                        <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                          {plan.operations.slice(0, 60).map((operation) => (
                            <OperationRow
                              key={operation.id}
                              operation={operation}
                              selectable={mode === "overwrite_selected" && operation.status === "overwrite"}
                              checked={selectedOperationIds.includes(operation.id)}
                              onCheckedChange={(checked) => toggleOperation(operation.id, checked)}
                            />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null}

                {step === "confirm" ? (
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
              <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:text-blue-200 dark:ring-blue-900/70">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="truncate">{step === "result" ? "Restore selesai" : "Mode restore aman"}</span>
              </span>
              <span className="max-w-[min(78vw,760px)] truncate" title="Restore tidak menyimpan data sebelum preview, mode, dan konfirmasi selesai.">
                Restore tidak menyimpan data sebelum preview, mode, dan konfirmasi selesai.
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
            {step !== "upload" && step !== "running" && step !== "result" ? (
              <Button type="button" variant="outline" className="min-h-10 w-full rounded-full sm:w-auto" onClick={() => setStep(step === "confirm" ? "mode" : step === "mode" ? "preview" : "upload")} disabled={isRestoring}>
                Kembali
              </Button>
            ) : null}
            {step === "preview" ? (
              <Button type="button" className="min-h-10 w-full rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto" onClick={() => setStep("mode")} disabled={!canContinueFromPreview}>
                Pilih Mode
              </Button>
            ) : null}
            {step === "mode" ? (
              <Button type="button" className="min-h-10 w-full rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto" onClick={() => setStep("confirm")}>
                Review Konfirmasi
              </Button>
            ) : null}
            {step === "confirm" ? (
              <Button type="button" className="min-h-10 w-full rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto" onClick={() => void executeRestore()} disabled={!canRunRestore}>
                {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Jalankan Restore
              </Button>
            ) : null}
          </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
