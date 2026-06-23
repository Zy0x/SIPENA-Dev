import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FilePenLine,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Plus,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StudioActionFooter, StudioInfoCollapsible, StudioStepHeader } from "@/components/studio/ResponsiveStudio";
import { useEnhancedToast } from "@/contexts/ToastContext";
import {
  OCR_MAX_IMAGES,
  hasBlockingOcrIssues,
  hasOcrWarnings,
  parseManualOcrText,
  prepareOcrDraft,
  prepareOcrImage,
  requestOcrExtraction,
  validateOcrDraft,
  validateOcrImageFiles,
  type OcrColumn,
  type OcrDraftRow,
  type OcrImportContext,
  type OcrImportKind,
  type OcrImportPlan,
  type OcrImportResult,
  type OcrPageText,
  type PreparedOcrImage,
} from "@/lib/ocrImport";
import { cn } from "@/lib/utils";
import OcrImageViewerDialog from "./OcrImageViewerDialog";

type OcrStudioStep = "capture" | "processing" | "review" | "confirm" | "done";

interface OcrClassOption {
  id: string;
  name: string;
}

interface OCRImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: OcrImportKind;
  title: string;
  description: string;
  context: OcrImportContext;
  availableClasses?: OcrClassOption[];
  targetClassId?: string;
  onTargetClassIdChange?: (classId: string) => void;
  onRequestCreateClass?: () => void;
  onConfirmImport: (plan: OcrImportPlan) => Promise<OcrImportResult>;
}

interface OcrPageSwitcherProps {
  images: PreparedOcrImage[];
  activeImageId: string | null;
  onChange: (imageId: string) => void;
}

function OcrPageSwitcher({ images, activeImageId, onChange }: OcrPageSwitcherProps) {
  const activeIndex = Math.max(0, images.findIndex((image) => image.id === activeImageId));
  const activeImage = images[activeIndex];
  if (!activeImage) return null;

  const moveTo = (nextIndex: number) => {
    const nextImage = images[nextIndex];
    if (nextImage) onChange(nextImage.id);
  };

  return (
    <div className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 rounded-xl border border-border bg-muted/30 p-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 touch-manipulation"
        disabled={activeIndex === 0}
        onClick={() => moveTo(activeIndex - 1)}
        aria-label="Tampilkan foto sebelumnya"
        data-touch-scroll-click-target="true"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-0">
        <Select value={activeImage.id} onValueChange={onChange}>
          <SelectTrigger className="h-11 min-w-0 bg-background" aria-label="Pilih halaman foto sumber">
            <SelectValue />
          </SelectTrigger>
          <SelectContent isEmpty={images.length === 0} emptyLabel="Tidak ada pilihan Foto Sumber">
            {images.map((image, index) => (
              <SelectItem key={image.id} value={image.id}>
                Halaman {index + 1} - {image.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 truncate px-1 text-[10px] text-muted-foreground">
          Halaman {activeIndex + 1} dari {images.length}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-11 w-11 touch-manipulation"
        disabled={activeIndex === images.length - 1}
        onClick={() => moveTo(activeIndex + 1)}
        aria-label="Tampilkan foto berikutnya"
        data-touch-scroll-click-target="true"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

const CREATE_CLASS_OPTION = "__create-new-class__";

const STEP_LABELS = [
  { id: "capture" as const, label: "Pilih Foto" },
  { id: "processing" as const, label: "OCR & AI" },
  { id: "review" as const, label: "Periksa/Edit" },
  { id: "confirm" as const, label: "Konfirmasi" },
  { id: "done" as const, label: "Hasil" },
];

const KIND_COPY: Record<OcrImportKind, { subject: string; manualExample: string }> = {
  students: {
    subject: "murid",
    manualExample: "1\tAhmad Fauzi\t0012345678\n2\tBudi Santoso\t0012345679",
  },
  grades: {
    subject: "nilai",
    manualExample: "Ahmad Fauzi\t0012345678\t85\t90\nBudi Santoso\t0012345679\t88\t92",
  },
  attendance: {
    subject: "presensi",
    manualExample: "Ahmad Fauzi\t0012345678\t19/06/2026\tH\nBudi Santoso\t0012345679\t19/06/2026\tS",
  },
};

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function issueTone(row: OcrDraftRow) {
  if (row.issues.some((issue) => issue.severity === "error")) return "border-destructive/35 bg-destructive/5";
  if (row.issues.some((issue) => issue.severity === "warning")) return "border-amber-400/40 bg-amber-500/5";
  return "border-border bg-background";
}

export default function OCRImportDialog({
  open,
  onOpenChange,
  type,
  title,
  description,
  context,
  availableClasses = [],
  targetClassId,
  onTargetClassIdChange,
  onRequestCreateClass,
  onConfirmImport,
}: OCRImportDialogProps) {
  const [step, setStep] = useState<OcrStudioStep>("capture");
  const [images, setImages] = useState<PreparedOcrImage[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [guideViewerOpen, setGuideViewerOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentErrorHighlight, setConsentErrorHighlight] = useState(false);
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [processStage, setProcessStage] = useState(0);
  const [processError, setProcessError] = useState("");
  const [pageTexts, setPageTexts] = useState<OcrPageText[]>([]);
  const [manualText, setManualText] = useState("");
  const [columns, setColumns] = useState<OcrColumn[]>([]);
  const [rows, setRows] = useState<OcrDraftRow[]>([]);
  const [warningsAccepted, setWarningsAccepted] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<OcrImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { error: showError } = useEnhancedToast();
  const copy = KIND_COPY[type];

  const resetState = useCallback(() => {
    setStep("capture");
    setImages([]);
    setActiveImageId(null);
    setImageViewerOpen(false);
    setGuideViewerOpen(false);
    setConsent(false);
    setConsentErrorHighlight(false);
    setIsPreparingImages(false);
    setProcessStage(0);
    setProcessError("");
    setPageTexts([]);
    setManualText("");
    setColumns([]);
    setRows([]);
    setWarningsAccepted(false);
    setIsImporting(false);
    setImportResult(null);
  }, []);

  const activeImage = images.find((image) => image.id === activeImageId) || images[0];
  const activePageText = pageTexts.find((item) => item.page === activeImage?.page);
  const includedRows = rows.filter((row) => row.included);
  const blocking = hasBlockingOcrIssues(rows);
  const hasWarnings = hasOcrWarnings(rows);
  const canContinueReview = includedRows.length > 0 && !blocking && (!hasWarnings || warningsAccepted);

  const closeDialog = useCallback((nextOpen: boolean) => {
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }, [onOpenChange, resetState]);

  const handleTargetClassChange = useCallback((value: string) => {
    if (value === CREATE_CLASS_OPTION) {
      onRequestCreateClass?.();
      return;
    }
    onTargetClassIdChange?.(value);
  }, [onRequestCreateClass, onTargetClassIdChange]);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    try {
      validateOcrImageFiles(files, images.length);
      setIsPreparingImages(true);
      const prepared: PreparedOcrImage[] = [];
      for (let index = 0; index < files.length; index += 1) {
        prepared.push(await prepareOcrImage(files[index], images.length + index + 1));
      }
      setImages((current) => [...current, ...prepared]);
      setActiveImageId((current) => current || prepared[0]?.id || null);
      setProcessError("");
    } catch (error) {
      showError("Foto tidak dapat digunakan", error instanceof Error ? error.message : "Periksa kembali foto yang dipilih.");
    } finally {
      setIsPreparingImages(false);
    }
  }, [images.length, showError]);

  const onFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    void handleFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }, [handleFiles]);

  const renumberImages = useCallback((nextImages: PreparedOcrImage[]) => (
    nextImages.map((image, index) => ({ ...image, page: index + 1 }))
  ), []);

  const moveImage = useCallback((id: string, direction: -1 | 1) => {
    setImages((current) => {
      const index = current.findIndex((image) => image.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return renumberImages(next);
    });
  }, [renumberImages]);

  const removeImage = useCallback((id: string) => {
    setImages((current) => {
      const next = renumberImages(current.filter((image) => image.id !== id));
      setActiveImageId((active) => active === id ? next[0]?.id || null : active);
      return next;
    });
  }, [renumberImages]);

  const applyExtraction = useCallback((result: ReturnType<typeof parseManualOcrText>) => {
    const draft = prepareOcrDraft(result, context);
    setColumns(draft.columns);
    setRows(draft.rows);
    setPageTexts(result.pageTexts);
    setWarningsAccepted(false);
  }, [context]);

  const runOcr = useCallback(async () => {
    if (!images.length || (type === "students" && !targetClassId)) return;
    if (!consent) {
      setConsentErrorHighlight(true);
      showError("Persetujuan Diperlukan", "Harap centang persetujuan pemrosesan foto oleh layanan AI sebelum memproses.");
      return;
    }
    setStep("processing");
    setProcessStage(1);
    setProcessError("");
    try {
      const result = await requestOcrExtraction({
        mode: "ocr_import",
        kind: type,
        images: images.map(({ name, mimeType, base64, page }) => ({ name, mimeType, base64, page })),
      });
      setProcessStage(2);
      applyExtraction(result);
      setProcessStage(3);
      setStep("review");
    } catch (error) {
      setProcessError(error instanceof Error ? error.message : "OCR gagal memproses foto.");
      setStep("review");
    }
  }, [applyExtraction, consent, images, targetClassId, type, showError]);

  const applyManualText = useCallback(() => {
    if (!manualText.trim()) return;
    applyExtraction(parseManualOcrText(manualText, type));
    setProcessError("");
  }, [applyExtraction, manualText, type]);

  const revalidate = useCallback((nextRows: OcrDraftRow[], nextColumns = columns) => {
    const validated = validateOcrDraft(nextRows, nextColumns, context);
    setColumns(validated.columns);
    setRows(validated.rows);
    setWarningsAccepted(false);
  }, [columns, context]);

  const updateCell = useCallback((rowId: string, columnIndex: number, value: string) => {
    const isStudentNameCol = columns[columnIndex]?.semantic === "student_name";
    revalidate(rows.map((row) => row.id === rowId
      ? {
          ...row,
          manualStudentId: isStudentNameCol ? undefined : row.manualStudentId,
          values: row.values.map((cell, index) => index === columnIndex ? value : cell),
        }
      : row));
  }, [revalidate, rows, columns]);

  const handleManualStudentSelect = useCallback((rowId: string, studentId: string) => {
    revalidate(rows.map((row) => row.id === rowId
      ? { ...row, manualStudentId: studentId }
      : row));
  }, [revalidate, rows]);

  const toggleRow = useCallback((rowId: string, included: boolean) => {
    revalidate(rows.map((row) => row.id === rowId ? { ...row, included } : row));
  }, [revalidate, rows]);

  const mapGradeColumn = useCallback((columnId: string, targetId: string) => {
    const nextColumns = columns.map((column) => column.id === columnId ? { ...column, targetId } : column);
    revalidate(rows, nextColumns);
  }, [columns, revalidate, rows]);

  const isScale10Detected = useMemo(() => {
    if (type !== "grades" || rows.length === 0) return false;
    const gradeIndexes = columns
      .map((col, index) => (col.semantic === "grade" ? index : -1))
      .filter((index) => index >= 0);

    if (gradeIndexes.length === 0) return false;

    let hasNumericGrade = false;
    let allNumericGradesAreScale10 = true;

    for (const row of rows) {
      for (const idx of gradeIndexes) {
        const val = row.values[idx]?.trim();
        if (!val) continue;
        const num = Number(val);
        if (Number.isFinite(num)) {
          hasNumericGrade = true;
          if (num > 10) {
            allNumericGradesAreScale10 = false;
            break;
          }
        }
      }
      if (!allNumericGradesAreScale10) break;
    }

    return hasNumericGrade && allNumericGradesAreScale10;
  }, [type, rows, columns]);

  const handleScale10To100 = useCallback(() => {
    const gradeIndexes = columns
      .map((col, index) => (col.semantic === "grade" ? index : -1))
      .filter((index) => index >= 0);

    const nextRows = rows.map((row) => {
      const nextValues = row.values.map((val, idx) => {
        if (!gradeIndexes.includes(idx)) return val;
        const cleaned = val.trim();
        if (!cleaned) return val;
        const num = Number(cleaned);
        if (Number.isFinite(num)) {
          return (num * 10).toString();
        }
        return val;
      });
      return { ...row, values: nextValues };
    });

    revalidate(nextRows);
  }, [rows, columns, revalidate]);

  const executeImport = useCallback(async () => {
    if (!canContinueReview) return;
    setIsImporting(true);
    try {
      const result = await onConfirmImport({
        kind: type,
        targetClassId: context.targetClassId,
        columns,
        rows,
      });
      setImportResult(result);

      setStep("done");
    } catch (error) {
      showError("Import gagal", error instanceof Error ? error.message : "Data belum tersimpan. Coba kembali.");
    } finally {
      setIsImporting(false);
    }
  }, [
    canContinueReview,
    columns,
    context.targetClassId,
    context.targetSubjectId,
    targetClassId,
    images,
    onConfirmImport,
    rows,
    showError,
    type,
  ]);

  const summary = useMemo(() => ({
    included: includedRows.length,
    excluded: rows.length - includedRows.length,
    errors: rows.filter((row) => row.included && row.issues.some((issue) => issue.severity === "error")).length,
    warnings: rows.filter((row) => row.included && row.issues.some((issue) => issue.severity === "warning")).length,
  }), [includedRows.length, rows]);

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={onFileChange} />

      <DialogContent className="flex h-[min(100dvh-0.75rem,56rem)] w-[calc(100vw-0.75rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-[20px] p-0">
        <DialogHeader className="shrink-0 border-b border-border px-4 pb-3 pt-4 pr-14 sm:px-6 sm:pt-5">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
            <ScanLine className="h-5 w-5 text-primary" />
            {title}
            <Badge className="gap-1 bg-amber-500 text-amber-950 hover:bg-amber-500">
              <Sparkles className="h-3 w-3" /> BETA
            </Badge>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 max-w-full space-y-4">
            <StudioStepHeader steps={STEP_LABELS} currentStep={step} />

            {step === "capture" ? (
              <>
                {type === "students" ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <label className="mb-2 block text-xs font-semibold">Kelas tujuan *</label>
                    <Select value={targetClassId || ""} onValueChange={handleTargetClassChange}>
                      <SelectTrigger className="min-h-11 bg-background"><SelectValue placeholder="Pilih kelas tujuan" /></SelectTrigger>
                      <SelectContent isEmpty={availableClasses.length === 0} emptyLabel="Tidak ada pilihan Kelas">
                        {availableClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                        {onRequestCreateClass ? (
                          <>
                            <SelectSeparator />
                            <SelectItem value={CREATE_CLASS_OPTION} className="font-medium text-primary">
                              <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Tambah Kelas Baru</span>
                            </SelectItem>
                          </>
                        ) : null}
                      </SelectContent>
                    </Select>
                    <p className="mt-2 text-[11px] text-muted-foreground">SIPENA tidak memilih kelas pertama secara otomatis.</p>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={images.length >= OCR_MAX_IMAGES || isPreparingImages} className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center hover:bg-muted/40 disabled:opacity-50">
                    <Camera className="h-8 w-8 text-primary" />
                    <span><span className="block text-sm font-semibold">Ambil Foto</span><span className="text-[11px] text-muted-foreground">Kamera perangkat</span></span>
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={images.length >= OCR_MAX_IMAGES || isPreparingImages} className="flex min-h-32 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center hover:bg-muted/40 disabled:opacity-50">
                    {isPreparingImages ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <ImageIcon className="h-8 w-8 text-primary" />}
                    <span><span className="block text-sm font-semibold">Pilih dari Galeri</span><span className="text-[11px] text-muted-foreground">JPG, PNG, WebP; maksimal 5 foto</span></span>
                  </button>
                </div>

                {images.length ? (
                  <div className="grid min-w-0 max-w-full gap-3 overflow-hidden lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <button
                      type="button"
                      className="flex min-h-56 min-w-0 max-w-full touch-manipulation items-center justify-center overflow-hidden rounded-xl border border-border bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onClick={() => setImageViewerOpen(true)}
                      aria-label={`Buka foto sumber halaman ${activeImage?.page || 1} dalam viewer`}
                    >
                      {activeImage ? <img src={activeImage.previewUrl} alt={`Foto sumber halaman ${activeImage.page}`} className="block h-auto max-h-[24rem] w-auto max-w-full object-contain" /> : null}
                    </button>
                    <div className="min-w-0 max-w-full space-y-2 overflow-hidden">
                      {images.map((image, index) => (
                        <div key={image.id} className="flex min-w-0 max-w-full items-center gap-1 rounded-xl border border-border bg-background p-1.5">
                          <button
                            type="button"
                            aria-pressed={activeImage?.id === image.id}
                            data-selected={activeImage?.id === image.id}
                            data-touch-scroll-click-target="true"
                            onClick={() => setActiveImageId(image.id)}
                            className={cn("sipena-ocr-image-selector flex min-h-11 min-w-0 flex-1 touch-manipulation items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activeImage?.id === image.id ? "border-primary bg-primary/10 text-foreground" : "bg-transparent text-foreground")}
                          >
                            <img src={image.previewUrl} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
                            <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">Halaman {index + 1}: {image.name}</span><span className="block truncate text-[10px] text-muted-foreground">{formatBytes(image.processedSize)} setelah kompresi</span></span>
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 touch-manipulation" disabled={index === 0} onClick={() => moveImage(image.id, -1)} aria-label="Geser foto ke atas"><ArrowUp className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 touch-manipulation" disabled={index === images.length - 1} onClick={() => moveImage(image.id, 1)} aria-label="Geser foto ke bawah"><ArrowDown className="h-4 w-4" /></Button>
                            <Button type="button" variant="ghost" size="icon" className="h-11 w-11 touch-manipulation text-destructive" onClick={() => removeImage(image.id)} aria-label="Hapus foto"><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <label 
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all duration-300",
                    consentErrorHighlight 
                      ? "border-destructive bg-destructive/5 ring-2 ring-destructive/20 animate-pulse" 
                      : "border-primary/25 bg-primary/5"
                  )}
                >
                  <Checkbox 
                    checked={consent} 
                    onCheckedChange={(checked) => {
                      setConsent(checked === true);
                      if (checked === true) {
                        setConsentErrorHighlight(false);
                      }
                    }} 
                    className="mt-0.5 h-5 w-5" 
                  />
                  <span className="text-xs leading-relaxed"><span className="block font-semibold">Saya setuju foto diproses oleh layanan AI untuk sesi ini.</span><span className="text-muted-foreground">Foto tidak disimpan oleh SIPENA. Foto dan base64 dibuang saat modal ditutup.</span></span>
                </label>

                <StudioInfoCollapsible title="Panduan Format & Peletakan Foto Tabel" description="Sistem OCR cerdas SIPENA mendukung pencocokan nama, No. Urut Absen, dan deteksi typo." defaultOpen={true}>
                  <div className="space-y-3 text-xs text-muted-foreground">
                    <div className="flex flex-col md:flex-row gap-4 items-start border-b border-border/30 pb-3">
                      <div className="flex-1 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
                            <strong className="block text-foreground mb-1">Layout A (Nama & Nilai)</strong>
                            Pencocokan standar menggunakan nama murid. Sangat cocok untuk daftar nilai digital atau cetakan.
                          </div>
                          <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
                            <strong className="block text-foreground mb-1">Layout B (No. Absen & Nilai)</strong>
                            Pencocokan alternatif menggunakan nomor urut absen (1, 2, 3...) sesuai daftar alfabetis kelas. Berguna jika nama buram/tidak terbaca.
                          </div>
                          <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
                            <strong className="block text-foreground mb-1">Layout C (Lengkap)</strong>
                            Menyertakan No. Urut, Nama Murid, dan Nilai. Sistem akan memvalidasi keselarasan nomor urut dengan nama untuk mendeteksi data tertukar.
                          </div>
                        </div>
                      </div>
                      <div className="w-full md:w-80 shrink-0 overflow-hidden rounded-lg border border-border bg-background p-1">
                        <button
                          type="button"
                          className="group relative flex w-full touch-manipulation items-center justify-center overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setGuideViewerOpen(true)}
                          aria-label="Perbesar gambar panduan format tabel"
                        >
                          <img 
                            src="/ocr-guide-example.webp" 
                            alt="Contoh Format Foto Tabel" 
                            className="h-auto w-full rounded-md object-contain transition-transform duration-300 group-hover:scale-105" 
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                            <Maximize2 className="h-6 w-6 text-white" />
                          </div>
                        </button>
                      </div>
                    </div>
                    <ul className="space-y-1.5 list-disc pl-4">
                      <li><strong>Pencocokan Cerdas:</strong> Jika terjadi typo kecil pada nama dari hasil OCR (misal "Ahnad Fauzi"), sistem akan otomatis mencocokkannya ke "Ahmad Fauzi" (fuzzy matching).</li>
                      <li><strong>Tips Foto:</strong> Posisikan kamera sejajar/tegak lurus di atas kertas, pastikan cahaya cukup terang tanpa bayangan, dan hindari melipat atau memotong pinggiran tabel.</li>
                    </ul>
                  </div>
                </StudioInfoCollapsible>
              </>
            ) : null}

            {step === "processing" ? (
              <div className="mx-auto flex min-h-[24rem] max-w-xl flex-col items-center justify-center gap-5 text-center">
                <div className="relative"><ScanLine className="h-14 w-14 animate-pulse text-primary" /><Sparkles className="absolute -right-3 -top-2 h-6 w-6 animate-pulse text-amber-500" /></div>
                <div><h3 className="text-lg font-semibold">OCR & AI BETA sedang bekerja</h3><p className="mt-1 text-sm text-muted-foreground">{processStage <= 1 ? "Membaca teks dan struktur dari foto..." : processStage === 2 ? "Merapikan data ke bentuk tabel..." : "Memeriksa aturan data SIPENA..."}</p></div>
                <Progress value={processStage === 1 ? 35 : processStage === 2 ? 75 : 95} className="h-2" />
                <p className="text-[11px] text-muted-foreground">Jangan tutup modal selama foto sedang diproses.</p>
              </div>
            ) : null}

            {step === "review" ? (
              <>
                {processError ? (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" /><AlertTitle>OCR belum berhasil</AlertTitle><AlertDescription>{processError} Foto tetap tersedia. Coba lagi atau masukkan teks secara manual.</AlertDescription>
                  </Alert>
                ) : null}

                {isScale10Detected && (
                  <Alert className="border-amber-400/40 bg-amber-500/5">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <AlertTitle>Skala Nilai 10 Terdeteksi</AlertTitle>
                    <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span>Semua nilai angka yang terbaca berukuran &le; 10 (misal: 8.5). Apakah Anda ingin mengkonversinya ke skala 100 secara massal?</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="self-start sm:self-auto border-amber-500/40 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium shrink-0"
                        onClick={handleScale10To100}
                      >
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Konversi ke Skala 100
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2"><Badge variant="outline">{rows.length} baris</Badge><Badge variant="outline">{summary.errors} error</Badge><Badge variant="outline">{summary.warnings} peringatan</Badge></div>
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void runOcr()} disabled={!images.length}><RefreshCw className="h-3.5 w-3.5" /> Coba OCR Lagi</Button>
                </div>

                {type === "students" ? (
                  <Alert className="border-primary/25 bg-primary/5">
                    <FilePenLine className="h-4 w-4 text-primary" />
                    <AlertTitle>Kolom import siswa</AlertTitle>
                    <AlertDescription>Hanya Nama Siswa dan NISN yang disimpan. NISN yang tidak terbaca ditulis sebagai tanda -, sedangkan kolom lain hanya membantu pemeriksaan.</AlertDescription>
                  </Alert>
                ) : null}

                {!rows.length || processError ? (
                  <div className="space-y-2 rounded-xl border border-border p-3">
                    <label className="flex items-center gap-2 text-xs font-semibold"><FilePenLine className="h-4 w-4" /> Editor manual</label>
                    <Textarea value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder={copy.manualExample} className="min-h-40 font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={applyManualText} disabled={!manualText.trim()}>Buat tabel dari teks</Button>
                  </div>
                ) : null}

                {rows.length ? (
                  <div className="overflow-hidden rounded-xl border border-border bg-background">
                    <div className="sipena-native-horizontal-scroll max-w-full overflow-x-auto overscroll-x-contain touch-pan-x">
                      <table className="w-full min-w-max border-collapse text-xs">
                        <thead className="sticky top-0 z-10 bg-muted shadow-[0_2px_5px_rgba(15,23,42,0.16)]">
                          <tr>
                            <th className="min-w-16 border-b border-r border-border px-2 py-2 text-center">Ikut</th>
                            <th className="min-w-20 border-b border-r border-border px-2 py-2 text-center">Sumber</th>
                            {columns.map((column) => (
                              <th key={column.id} className="min-w-36 border-b border-r border-border px-2 py-2 text-center">
                                <span className="block font-semibold">{column.label}</span>
                                {type === "grades" && (column.semantic === "grade" || column.semantic === "unknown") ? (
                                  <Select value={column.targetId || ""} onValueChange={(value) => mapGradeColumn(column.id, value)}>
                                    <SelectTrigger className="mt-1 h-8 min-w-40 bg-background text-[10px]"><SelectValue placeholder="Pilih tugas" /></SelectTrigger>
                                    <SelectContent isEmpty={(context.assignments || []).length === 0} emptyLabel="Tidak ada pilihan Tugas">{(context.assignments || []).map((assignment) => <SelectItem key={assignment.id} value={assignment.id}>{assignment.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                ) : null}
                              </th>
                            ))}
                            <th className="min-w-64 border-b border-border px-2 py-2 text-center">Pemeriksaan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={row.id} className={cn("border-b border-border", !row.included && "opacity-55")}>
                              <td className="border-r border-border p-2 text-center"><Checkbox checked={row.included} onCheckedChange={(checked) => toggleRow(row.id, checked === true)} aria-label={`Sertakan baris halaman ${row.page}`} /></td>
                              <td className="border-r border-border p-2 text-center"><button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => { setActiveImageId(images.find((image) => image.page === row.page)?.id || null); }}>Foto {row.page}</button><span className="mt-1 block text-[10px] text-muted-foreground">{Math.round(row.confidence * 100)}%</span></td>
                              {columns.map((column, columnIndex) => (
                                <td key={column.id} className="border-r border-border p-1.5">
                                  <Input 
                                    value={row.values[columnIndex] || ""} 
                                    onChange={(event) => updateCell(row.id, columnIndex, event.target.value)} 
                                    disabled={!row.included} 
                                    className="h-9 min-w-32 bg-background text-xs" 
                                  />
                                  {column.semantic === "student_name" && type !== "students" && (
                                    <div className="mt-1">
                                      <Select
                                        value={row.manualStudentId || row.targetStudentId || ""}
                                        onValueChange={(studentId) => handleManualStudentSelect(row.id, studentId)}
                                      >
                                        <SelectTrigger 
                                          className={cn(
                                            "h-7 bg-background text-[10px] min-w-32", 
                                            !row.targetStudentId ? "border-amber-500/50 text-amber-700 dark:text-amber-300" : "border-border/60"
                                          )} 
                                          aria-label="Lakukan pencocokan manual"
                                        >
                                          <SelectValue placeholder="-- Cocokkan manual --" />
                                        </SelectTrigger>
                                        <SelectContent isEmpty={context.students.length === 0} emptyLabel="Tidak ada siswa">
                                          {context.students.map((student) => (
                                            <SelectItem key={student.id} value={student.id}>
                                              {student.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </td>
                              ))}
                              <td className="p-2 align-top"><div className={cn("rounded-lg border p-2", issueTone(row))}>{row.issues.length ? row.issues.map((issue, index) => <p key={`${issue.code}-${index}`} className={cn("text-[10px] leading-relaxed", issue.severity === "error" ? "text-destructive" : issue.severity === "warning" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>{issue.message}</p>) : <p className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Siap</p>}</div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {images.length && activeImage ? (
                  <StudioInfoCollapsible title={`Foto sumber - Halaman ${activeImage.page} dari ${images.length}`} description="Pilih halaman, lalu buka foto untuk mencocokkan isi tabel." defaultOpen={false}>
                    <div className="min-w-0 space-y-3">
                      <OcrPageSwitcher images={images} activeImageId={activeImage.id} onChange={setActiveImageId} />
                      <button type="button" className="flex w-full touch-manipulation items-center justify-center overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setImageViewerOpen(true)} aria-label={`Buka foto sumber halaman ${activeImage.page} dalam viewer`}>
                        <img src={activeImage.previewUrl} alt={`Foto sumber halaman ${activeImage.page}`} className="block h-auto max-h-[28rem] w-auto max-w-full object-contain" />
                      </button>
                    </div>
                  </StudioInfoCollapsible>
                ) : null}
                {images.length && activeImage ? (
                  <StudioInfoCollapsible title={`Teks OCR mentah - Halaman ${activeImage.page} dari ${images.length}`} description="Teks mengikuti foto sumber yang sedang dipilih.">
                    <div className="min-w-0 space-y-3">
                      <OcrPageSwitcher images={images} activeImageId={activeImage.id} onChange={setActiveImageId} />
                      {activePageText?.text ? (
                        <div className="min-w-0 space-y-2">
                          {activePageText.source === "table_fallback" ? (
                            <Badge variant="outline" className="border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                              Disusun dari hasil tabel
                            </Badge>
                          ) : activePageText.source === "manual" ? (
                            <Badge variant="outline">Input manual</Badge>
                          ) : null}
                          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/30 p-3 text-[11px] text-muted-foreground">{activePageText.text}</pre>
                        </div>
                      ) : (
                        <p className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                          Tidak ada teks OCR yang terbaca untuk halaman ini.
                        </p>
                      )}
                    </div>
                  </StudioInfoCollapsible>
                ) : null}

                {hasWarnings ? (
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-400/40 bg-amber-500/5 p-3"><Checkbox checked={warningsAccepted} onCheckedChange={(checked) => setWarningsAccepted(checked === true)} className="mt-0.5" /><span className="text-xs"><span className="block font-semibold">Saya sudah memeriksa baris yang memiliki peringatan.</span><span className="text-muted-foreground">Termasuk tulisan tangan, confidence rendah, data mirip, dan konflik data lama.</span></span></label>
                ) : null}
              </>
            ) : null}

            {step === "confirm" ? (
              <div className="mx-auto max-w-2xl space-y-4">
                <Alert><ShieldCheck className="h-4 w-4" /><AlertTitle>Konfirmasi import {copy.subject}</AlertTitle><AlertDescription>AI sudah selesai bekerja. Hanya baris yang dicentang dan telah lolos pemeriksaan yang akan disimpan.</AlertDescription></Alert>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border p-4 text-center"><p className="text-2xl font-semibold">{summary.included}</p><p className="text-xs text-muted-foreground">Akan disimpan</p></div>
                  <div className="rounded-xl border p-4 text-center"><p className="text-2xl font-semibold">{summary.excluded}</p><p className="text-xs text-muted-foreground">Tidak disertakan</p></div>
                  <div className="rounded-xl border p-4 text-center"><p className="text-2xl font-semibold">{images.length}</p><p className="text-xs text-muted-foreground">Foto sumber</p></div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">Nilai dan presensi yang sudah ada tidak ditimpa secara default. Setelah tombol konfirmasi ditekan, SIPENA menjalankan penyimpanan melalui alur domain yang sama dengan input manual.</p>
              </div>
            ) : null}

            {step === "done" && importResult ? (
              <div className="mx-auto flex min-h-[22rem] max-w-xl flex-col items-center justify-center gap-5 text-center">
                <CheckCircle2 className="h-16 w-16 text-emerald-500" /><div><h3 className="text-xl font-semibold">Import selesai</h3><p className="mt-1 text-sm text-muted-foreground">{importResult.message || "Hasil import sudah diproses."}</p></div>
                <div className="grid w-full grid-cols-3 gap-2"><div className="rounded-xl border p-3"><strong className="block text-xl text-emerald-600">{importResult.success}</strong><span className="text-[10px] text-muted-foreground">Berhasil</span></div><div className="rounded-xl border p-3"><strong className="block text-xl text-amber-600">{importResult.skipped}</strong><span className="text-[10px] text-muted-foreground">Dilewati</span></div><div className="rounded-xl border p-3"><strong className="block text-xl text-destructive">{importResult.failed}</strong><span className="text-[10px] text-muted-foreground">Gagal</span></div></div>
              </div>
            ) : null}
          </div>
        </div>

        <StudioActionFooter
          sticky
          helperText={step === "capture" ? "Foto hanya hidup selama modal ini terbuka dan tidak disimpan oleh SIPENA." : step === "review" ? "Geser tabel secara horizontal pada layar kecil. Keluarkan baris bermasalah atau perbaiki isinya." : "OCR BETA selalu memerlukan pemeriksaan manusia sebelum data disimpan."}
          actions={(
            <>
              {step === "capture" ? <><Button variant="outline" onClick={() => closeDialog(false)}>Batal</Button><Button onClick={() => void runOcr()} disabled={!images.length || isPreparingImages || (type === "students" && !targetClassId)} className="gap-2"><ScanLine className="h-4 w-4" /> Proses OCR & AI</Button></> : null}
              {step === "processing" ? <Button variant="outline" disabled><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sedang memproses</Button> : null}
              {step === "review" ? <><Button variant="outline" onClick={() => setStep("capture")}>Kembali ke Foto</Button><Button onClick={() => setStep("confirm")} disabled={!canContinueReview}>Lanjut Konfirmasi ({includedRows.length})</Button></> : null}
              {step === "confirm" ? <><Button variant="outline" onClick={() => setStep("review")}>Periksa Lagi</Button><Button onClick={() => void executeImport()} disabled={isImporting} className="gap-2">{isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Konfirmasi Import</Button></> : null}
              {step === "done" ? <Button onClick={() => closeDialog(false)}>Selesai</Button> : null}
            </>
          )}
        />
        <OcrImageViewerDialog
          open={imageViewerOpen}
          onOpenChange={setImageViewerOpen}
          imageUrl={activeImage?.previewUrl}
          imageName={activeImage?.name}
          page={activeImage?.page}
        />
        <OcrImageViewerDialog
          open={guideViewerOpen}
          onOpenChange={setGuideViewerOpen}
          imageUrl="/ocr-guide-example.webp"
          imageName="Panduan Format Foto Tabel"
          page={1}
        />
      </DialogContent>
    </Dialog>
  );
}
