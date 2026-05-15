import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  AlertTriangle,
  ArchiveRestore,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  if (status === "added") return "border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-50 dark:ring-emerald-900/40";
  if (status === "overwrite") return "border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-amber-100 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-50 dark:ring-amber-900/40";
  if (status === "invalid") return "border-destructive/40 bg-destructive/10 text-destructive ring-1 ring-destructive/15";
  if (status === "skipped") return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-200";
  return "border-slate-200 bg-white text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200";
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

  const previewGridStyle = useMemo<CSSProperties>(() => ({
    gridTemplateColumns: `clamp(12rem, 16vw, 18rem) repeat(${columns.length}, minmax(clamp(8.75rem, 9vw, 11.5rem), 1fr))`,
  }), [columns.length]);

  const statusBadgeText = (status: GradeBackupRestoreOperation["status"]) => {
    if (status === "overwrite") return "Timpa";
    if (status === "added") return "Baru";
    if (status === "invalid") return "Konflik";
    if (status === "unchanged") return "Sama";
    return "Skip";
  };

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <CardTitle className="text-base">Preview tabel restore</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Bandingkan nilai backup dengan nilai halaman aktif sebelum memilih mode restore.
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-1.5 lg:justify-end">
            {(["added", "overwrite", "unchanged", "skipped", "invalid"] as const).map((status) => (
              <Badge key={status} variant={statusTone(status)} className="px-2 py-0.5 text-[11px]">
                {statusLabel(status)}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {columns.length === 0 || rows.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Tidak ada nilai untuk ditampilkan</AlertTitle>
            <AlertDescription>Backup terbaca, tetapi tidak ada baris nilai yang bisa dibuat menjadi preview tabel.</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="sipena-restore-preview-scroll hidden h-[min(58dvh,39rem)] min-h-[24rem] overflow-auto rounded-2xl border border-slate-200 bg-white text-xs shadow-inner dark:border-slate-800 dark:bg-slate-950 md:block">
              <div className="min-w-max">
                <div
                  className="sipena-restore-preview-grid sticky top-0 z-30 grid min-w-max border-b border-slate-200 bg-slate-50/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
                  style={previewGridStyle}
                >
                  <div className="sticky left-0 z-40 min-w-0 border-r border-slate-200 bg-slate-50/95 px-4 py-3 font-semibold text-slate-900 shadow-[1px_0_0_hsl(var(--border))] dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100">
                    Siswa
                  </div>
                  {columns.map((column) => (
                    <div key={column.key} className="min-w-0 border-r border-slate-200 px-3 py-3 align-bottom last:border-r-0 dark:border-slate-800">
                      <div className="truncate font-semibold text-slate-900 dark:text-slate-100" title={column.label}>{column.label}</div>
                      <div className="truncate text-[11px] font-normal text-muted-foreground" title={column.sublabel}>{column.sublabel}</div>
                    </div>
                  ))}
                </div>
                {rows.map((row) => (
                  <div
                    key={row.studentId}
                    className="sipena-restore-preview-grid grid min-w-max border-b border-slate-200 last:border-b-0 dark:border-slate-800"
                    style={previewGridStyle}
                  >
                    <div className="sticky left-0 z-20 min-w-0 border-r border-slate-200 bg-white px-4 py-3 shadow-[1px_0_0_hsl(var(--border))] dark:border-slate-800 dark:bg-slate-950">
                      <div className="truncate font-medium text-slate-950 dark:text-slate-50" title={row.name}>{row.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground" title={row.nisn || row.studentId}>{row.nisn || row.studentId}</div>
                    </div>
                    {columns.map((column) => {
                      const operation = operationByCell.get(`${row.studentId}|${column.key}`);
                      if (!operation) {
                        return (
                          <div key={column.key} className="min-w-0 border-r border-slate-200 px-3 py-3 text-center text-muted-foreground last:border-r-0 dark:border-slate-800">
                            -
                          </div>
                        );
                      }
                      return (
                        <div key={column.key} className={cn("min-w-0 border-r px-3 py-2.5 last:border-r-0", previewCellClass(operation.status))}>
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-medium" title={statusLabel(operation.status)}>{statusLabel(operation.status)}</span>
                            <Badge variant={statusTone(operation.status)} className="shrink-0 px-1.5 py-0 text-[10px] leading-4">
                              {statusBadgeText(operation.status)}
                            </Badge>
                          </div>
                          <div className="mt-1.5 grid min-w-0 grid-cols-2 gap-2">
                            <div className="min-w-0 rounded-md bg-white/65 px-2 py-1 dark:bg-slate-950/45">
                              <div className="truncate text-[10px] text-muted-foreground">Saat ini</div>
                              <div className="truncate text-base font-semibold leading-5 text-slate-950 dark:text-slate-50">{valueLabel(operation.currentValue)}</div>
                            </div>
                            <div className="min-w-0 rounded-md bg-white/65 px-2 py-1 dark:bg-slate-950/45">
                              <div className="truncate text-[10px] text-muted-foreground">Backup</div>
                              <div className="truncate text-base font-semibold leading-5 text-slate-950 dark:text-slate-50">{valueLabel(operation.backupValue)}</div>
                            </div>
                          </div>
                          {operation.conflicts.length > 0 || operation.warnings.length > 0 ? (
                            <div className="mt-1.5 truncate text-[10px] leading-4 text-muted-foreground">
                              {operation.conflicts.length > 0 ? `${operation.conflicts.length} konflik` : `${operation.warnings.length} catatan`}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="sipena-restore-preview-mobile space-y-3 md:hidden">
              {rows.map((row) => {
                const rowOperations = columns
                  .map((column) => ({
                    column,
                    operation: operationByCell.get(`${row.studentId}|${column.key}`),
                  }))
                  .filter((item): item is { column: typeof columns[number]; operation: GradeBackupRestoreOperation } => Boolean(item.operation));
                return (
                  <div key={row.studentId} className="rounded-xl border bg-background p-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-foreground" title={row.name}>{row.name}</div>
                      <div className="truncate text-xs text-muted-foreground" title={row.nisn || row.studentId}>{row.nisn || row.studentId}</div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {rowOperations.map(({ column, operation }) => (
                        <div key={column.key} className={cn("rounded-lg border px-3 py-2 text-xs", previewCellClass(operation.status))}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-foreground" title={column.label}>{column.label}</div>
                              <div className="truncate text-[11px] text-muted-foreground" title={column.sublabel}>{column.sublabel}</div>
                            </div>
                            <Badge variant={statusTone(operation.status)} className="shrink-0 px-2 py-0 text-[10px]">
                              {statusBadgeText(operation.status)}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <div className="min-w-0 rounded-md bg-background/60 px-2 py-1">
                              <div className="truncate text-[10px] text-muted-foreground">Saat ini</div>
                              <div className="truncate text-sm font-semibold text-foreground">{valueLabel(operation.currentValue)}</div>
                            </div>
                            <div className="min-w-0 rounded-md bg-background/60 px-2 py-1">
                              <div className="truncate text-[10px] text-muted-foreground">Backup</div>
                              <div className="truncate text-sm font-semibold text-foreground">{valueLabel(operation.backupValue)}</div>
                            </div>
                          </div>
                          {operation.conflicts.length > 0 || operation.warnings.length > 0 ? (
                            <div className="mt-2 text-[11px] leading-4 text-muted-foreground">
                              {operation.conflicts.length > 0 ? `${operation.conflicts.length} konflik` : `${operation.warnings.length} catatan`}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
      <DialogContent className="sipena-grade-restore-dialog flex h-[calc(100dvh-0.25rem)] max-h-[980px] w-[calc(100vw-0.25rem)] max-w-[1880px] flex-col gap-0 overflow-hidden rounded-[24px] border-slate-300 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:h-[min(96dvh,980px)] sm:w-[calc(100vw-0.75rem)] xl:w-[min(98vw,1880px)]">
        <div className="shrink-0 border-b px-4 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
              <ArchiveRestore className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Restore Backup Nilai</DialogTitle>
              <DialogDescription className="mt-1">
                Restore selalu lewat preview dan konfirmasi sebelum nilai disimpan.
              </DialogDescription>
            </div>
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1 bg-slate-50/70 dark:bg-slate-950">
          <div className="space-y-4 p-4 sm:p-6">
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
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
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 2xl:grid-cols-6">
                  <SummaryMetric label="Tambah" value={plan.summary.added} />
                  <SummaryMetric label="Timpa" value={plan.summary.overwrite} tone="border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20" />
                  <SummaryMetric label="Sama" value={plan.summary.unchanged} />
                  <SummaryMetric label="Dilewati" value={plan.summary.skipped} />
                  <SummaryMetric label="Konflik" value={plan.summary.invalid} tone="border-destructive/30 bg-destructive/5" />
                  <SummaryMetric label="Siap" value={plan.summary.restorable} tone="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20" />
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
          </div>
        </ScrollArea>

        <div className="shrink-0 flex flex-col-reverse gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} disabled={isRestoring} className="sm:w-auto">
            Tutup
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {step !== "upload" && step !== "running" && step !== "result" ? (
              <Button type="button" variant="outline" onClick={() => setStep(step === "confirm" ? "mode" : step === "mode" ? "preview" : "upload")} disabled={isRestoring}>
                Kembali
              </Button>
            ) : null}
            {step === "preview" ? (
              <Button type="button" onClick={() => setStep("mode")} disabled={!canContinueFromPreview}>
                Pilih Mode
              </Button>
            ) : null}
            {step === "mode" ? (
              <Button type="button" onClick={() => setStep("confirm")}>
                Review Konfirmasi
              </Button>
            ) : null}
            {step === "confirm" ? (
              <Button type="button" onClick={() => void executeRestore()} disabled={!canRunRestore}>
                {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Jalankan Restore
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
