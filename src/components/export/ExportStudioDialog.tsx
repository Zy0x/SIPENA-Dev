import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type ReactNode, type SetStateAction } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarIcon,
  Columns3,
  Download,
  Eye,
  GripVertical,
  Info,
  Lock,
  Maximize2,
  Move,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  ScanSearch,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRepeatPress } from "@/hooks/useRepeatPress";

type RepeatButtonProps = {
  onTrigger: () => void;
  children: React.ReactNode;
  "aria-label"?: string;
};

function RepeatButton({ onTrigger, children, ...rest }: RepeatButtonProps) {
  const press = useRepeatPress(onTrigger);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-8 w-8"
      {...press}
      {...rest}
    >
      {children}
    </Button>
  );
}
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SliderWithButtons } from "@/components/ui/slider-with-buttons";
import { cn } from "@/lib/utils";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { exportElementToPng } from "@/lib/exportEngine/pngEngine";
import { PX_PER_MM } from "@/lib/exportEngine/sharedMetrics";
import {
  type SignatureSettingsConfig,
  type SignatureSigner,
  createDefaultSignatureConfig,
  createEmptySignatureSigner,
  formatSignatureDisplayDate,
  hasValidSignatureConfig,
} from "@/hooks/useSignatureSettings";
import type { ReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import type { ReportPaperSize } from "@/lib/reportExportLayout";
import type { ExportPreviewHighlightTarget } from "@/components/export/SignaturePreviewCanvas";

const PREVIEW_COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  border: "#dbe4f0",
  panel: "#f8fafc",
  page: "#ffffff",
  safeZone: "rgba(37, 99, 235, 0.08)",
  safeZoneBorder: "rgba(37, 99, 235, 0.35)",
  signatureBg: "rgba(239, 246, 255, 0.94)",
  signatureBorder: "rgba(59, 130, 246, 0.55)",
};

export interface ExportStudioFormatOption {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
  previewMode?: "pdf" | "png" | null;
}

export interface ExportStudioExportArgs {
  formatId: string;
  includeSignature: boolean;
  signatureConfig: SignatureSettingsConfig;
  paperSize: ReportPaperSize;
  documentStyle?: ReportDocumentStyle;
  autoFitOnePage?: boolean;
  downloadPreviewPng: (quality: "hd" | "4k", fileName?: string) => Promise<void>;
}

export interface ExportColumnOption {
  key: string;
  label: string;
  description?: string;
  checked: boolean;
  children?: ExportColumnOption[];
}

export interface ExportColumnTypographyOption {
  key: string;
  label: string;
  description?: string;
  sampleValue?: string;
  type?: string;
  headerLength?: number;
  maxValueLength?: number;
  suggestedHeaderFontSize?: number;
  suggestedBodyFontSize?: number;
  suggestedWidthMm?: number;
  suggestedHeaderAlignment?: "left" | "center" | "right";
  suggestedBodyAlignment?: "left" | "center" | "right";
}

interface ExportStudioDialogProps {
  title?: string;
  description?: string;
  triggerLabel?: string;
  triggerIcon?: LucideIcon;
  triggerClassName?: string;
  triggerDisabled?: boolean;
  formats: ExportStudioFormatOption[];
  selectedFormat: string;
  onFormatChange: (value: string) => void;
  onExport: (args: ExportStudioExportArgs) => Promise<void>;
  includeSignature: boolean;
  onIncludeSignatureChange: (value: boolean) => void;
  signatureConfig: SignatureSettingsConfig | null;
  hasSignature: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onSaveSignature: (config: SignatureSettingsConfig) => Promise<unknown>;
  paperSize?: ReportPaperSize;
  onPaperSizeChange?: (value: ReportPaperSize) => void;
  documentStyle?: ReportDocumentStyle;
  onDocumentStyleChange?: Dispatch<SetStateAction<ReportDocumentStyle>>;
  autoFitOnePage?: boolean;
  onAutoFitOnePageChange?: (value: boolean) => void;
  showAutoFitPreset?: boolean;
  supportsSignature?: boolean;
  columnOptions?: ExportColumnOption[];
  onColumnOptionChange?: (key: string, checked: boolean) => void;
  columnCount?: number;
  columnTypographyOptions?: ExportColumnTypographyOption[];
  renderPreview?: (args: {
    previewFormat: "pdf" | "png";
    draft: SignatureSettingsConfig;
    setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
    previewDate: string;
    includeSignature: boolean;
    paperSize: ReportPaperSize;
    documentStyle?: ReportDocumentStyle;
    autoFitOnePage?: boolean;
    liveEditMode?: boolean;
    highlightTarget?: ExportPreviewHighlightTarget | null;
    onHighlightTargetChange?: (target: ExportPreviewHighlightTarget | null) => void;
  }) => ReactNode;
  noPreviewMessage?: string;
  formatPanelExtra?: ReactNode;
  previewFooter?: ReactNode;
}

const PAPER_SIZE_OPTIONS: Array<{
  id: ReportPaperSize;
  label: string;
  description: string;
}> = [
  { id: "a4", label: "A4", description: "Ukuran standar dokumen cetak." },
  { id: "f4", label: "F4", description: "8,5 x 13 in, lebih panjang untuk tabel lebar." },
  { id: "auto", label: "Auto", description: "Tetap memakai A4, lalu layout menyesuaikan isi secara otomatis." },
  { id: "full-page", label: "Full Page", description: "Ukuran halaman mengikuti seluruh isi dari header sampai footer." },
];

function getRecommendedPaperSize(formatId: string): ReportPaperSize | null {
  if (formatId === "pdf") return "a4";
  if (formatId === "png-hd" || formatId === "png-4k") return "full-page";
  return null;
}

function getRecommendedPaperCopy(formatId: string) {
  if (formatId === "pdf") {
    return "A4 paling stabil untuk PDF karena proporsi cetak dan pagination-nya paling konsisten.";
  }
  if (formatId === "png-hd" || formatId === "png-4k") {
    return "Full Page paling akurat untuk PNG karena seluruh header sampai footer diraster dari halaman final tanpa memaksa potongan kertas.";
  }
  return "Pilih ukuran kertas sesuai kebutuhan dokumen dan target hasil ekspor.";
}

function getFormatToneClasses(id: string) {
  if (id === "pdf") return "border-red-200 bg-red-50/70 text-red-700";
  if (id === "excel") return "border-emerald-200 bg-emerald-50/70 text-emerald-700";
  if (id === "csv") return "border-slate-200 bg-slate-50/70 text-slate-700";
  if (id === "png-4k") return "border-primary/30 bg-primary/10 text-primary";
  return "border-sky-200 bg-sky-50/70 text-sky-700";
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getVisibleSigners(signers: SignatureSigner[]) {
  const active = signers.filter((signer) => signer.name.trim() || signer.title.trim());
  return active.length > 0 ? active : signers.slice(0, 1);
}

function HintInfo({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">{label}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-[11px]">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function useLooseSignatureDrag(
  draft: SignatureSettingsConfig,
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>,
) {
  const dragging = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const startOffsets = useRef({ x: 0, y: 0 });

  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (draft.lockSignaturePosition) return;
    dragging.current = true;
    startPoint.current = { x: event.clientX, y: event.clientY };
    startOffsets.current = { x: draft.signatureOffsetX, y: draft.signatureOffsetY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [draft.lockSignaturePosition, draft.signatureOffsetX, draft.signatureOffsetY]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const nextX = startOffsets.current.x + (event.clientX - startPoint.current.x) / PX_PER_MM;
    const nextY = startOffsets.current.y + (event.clientY - startPoint.current.y) / PX_PER_MM;
    const grid = draft.snapToGrid ? Math.max(1, draft.gridSizeMm || 5) : 0;
    const normalizedX = grid > 0 ? Math.round(nextX / grid) * grid : nextX;
    const normalizedY = grid > 0 ? Math.round(nextY / grid) * grid : nextY;

    setDraft((prev) => ({
      ...prev,
      signatureOffsetX: clamp(normalizedX, -120, 120),
      signatureOffsetY: clamp(normalizedY, -90, 120),
    }));
  }, [draft.gridSizeMm, draft.snapToGrid, setDraft]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };
}

function GenericSignaturePreview({
  draft,
  setDraft,
  previewDate,
  includeSignature,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  previewDate: string;
  includeSignature: boolean;
}) {
  const signers = useMemo(() => getVisibleSigners(draft.signers), [draft.signers]);
  const drag = useLooseSignatureDrag(draft, setDraft);

  return (
    <div
      style={{
        width: 780,
        minHeight: 420,
        borderRadius: 18,
        border: `1px solid ${PREVIEW_COLORS.border}`,
        background: PREVIEW_COLORS.page,
        padding: 28,
        boxShadow: "0 18px 40px -30px rgba(15, 23, 42, 0.8)",
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800, color: PREVIEW_COLORS.ink, textAlign: "center" }}>
        PREVIEW DOKUMEN EKSPOR
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: PREVIEW_COLORS.muted, textAlign: "center" }}>
        Preview aktif untuk PDF dan PNG. Excel dan CSV belum memakai preview karena akan dirancang ulang.
      </div>
      <div
        style={{
          marginTop: 22,
          border: `1px solid ${PREVIEW_COLORS.border}`,
          borderRadius: 14,
          background: PREVIEW_COLORS.panel,
          padding: 16,
          color: PREVIEW_COLORS.muted,
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        <div>Dokumen ini memakai data, filter, dan pengaturan ekspor yang sedang aktif.</div>
        <div>Gunakan tab Format untuk memilih PDF, PNG HD, atau PNG 4K. Tab Style mengatur tipografi, sedangkan Posisi mengatur peletakan tanda tangan secara dinamis.</div>
      </div>
      {includeSignature ? (
        <div
          {...drag}
          style={{
            marginTop: 42,
            marginLeft: "auto",
            width: 270,
            borderRadius: 16,
            border: `1px dashed ${PREVIEW_COLORS.signatureBorder}`,
            background: PREVIEW_COLORS.signatureBg,
            padding: "14px 16px",
            boxShadow: "0 14px 28px -24px rgba(15, 23, 42, 0.75)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              background: "#2563eb",
              color: "#fff",
              padding: "3px 8px",
              fontSize: 10,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            <Move size={12} />
            Preview Tanda Tangan
          </div>
          <div style={{ textAlign: "right", color: PREVIEW_COLORS.ink, fontSize: draft.fontSize + 1, marginBottom: 8 }}>
            {draft.city || "[Kota]"}, {previewDate}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: Math.max(12, draft.signatureSpacing), flexWrap: "wrap" }}>
            {signers.map((signer, index) => (
              <div key={signer.id || `${signer.name}-${index}`} style={{ width: Math.max(110, draft.signatureLineWidth * 2), textAlign: "center", color: PREVIEW_COLORS.ink, fontSize: draft.fontSize }}>
                <div style={{ lineHeight: 1.3 }}>{signer.title || "Guru Mata Pelajaran"}</div>
                {index === 0 && signer.school_name ? (
                  <div style={{ fontSize: Math.max(9, draft.fontSize - 1), color: PREVIEW_COLORS.muted, marginTop: 2 }}>{signer.school_name}</div>
                ) : null}
                <div style={{ height: 54 }} />
                {draft.showSignatureLine ? (
                  <div style={{ width: draft.signatureLineWidth * 2, borderBottom: `1px solid ${PREVIEW_COLORS.ink}`, margin: "0 auto 6px" }} />
                ) : null}
                <div style={{ fontWeight: 700 }}>{signer.name || "[Nama Penanda Tangan]"}</div>
                {signer.nip ? (
                  <div style={{ fontSize: Math.max(9, draft.fontSize - 1), color: PREVIEW_COLORS.muted, marginTop: 2 }}>NIP. {signer.nip}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div
        style={{
          marginTop: 18,
          borderRadius: 14,
          border: `1px solid ${PREVIEW_COLORS.safeZoneBorder}`,
          background: PREVIEW_COLORS.safeZone,
          padding: "10px 12px",
          fontSize: 10,
          color: "#1d4ed8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
          <ScanSearch size={12} />
          Safe zone tanda tangan
        </div>
        <div style={{ marginTop: 4 }}>
          Offset, drag-and-drop, dan kontrol presisi akan langsung memengaruhi posisi preview dan hasil ekspor.
        </div>
      </div>
    </div>
  );
}

function SignerPanel({
  draft,
  setDraft,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
}) {
  const signerCount = draft.signers.filter((signer) => signer.name.trim()).length;

  const setSigner = (index: number, field: keyof SignatureSigner, value: string) => {
    setDraft((prev) => ({
      ...prev,
      signers: prev.signers.map((signer, signerIndex) => (
        signerIndex === index ? { ...signer, [field]: value } : signer
      )),
    }));
  };

  const addSigner = () => {
    if (draft.signers.length >= 4) return;
    setDraft((prev) => ({ ...prev, signers: [...prev.signers, createEmptySignatureSigner()] }));
  };

  const removeSigner = (index: number) => {
    setDraft((prev) => {
      const next = prev.signers.filter((_, signerIndex) => signerIndex !== index);
      return { ...prev, signers: next.length > 0 ? next : [createEmptySignatureSigner()] };
    });
  };

  const moveSigner = (index: number, direction: "up" | "down") => {
    setDraft((prev) => {
      const next = [...prev.signers];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return { ...prev, signers: next };
    });
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-background/50 p-3">
        <p className="text-[11px] font-semibold text-foreground">Identitas Tanda Tangan</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Isi kota dan penanda tangan utama. Anda bisa menambah sampai 4 penanda tangan.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Kota <span className="text-destructive">*</span></Label>
        <Input
          value={draft.city}
          onChange={(event) => setDraft((prev) => ({ ...prev, city: event.target.value }))}
          placeholder="Banjarmasin"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Label className="text-[11px]">Tanggal custom</Label>
          <p className="text-[9px] text-muted-foreground">Aktifkan bila tanggal dokumen tidak ingin mengikuti hari ini.</p>
        </div>
        <Switch
          checked={draft.useCustomDate}
          onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, useCustomDate: checked, customDate: checked ? prev.customDate : null }))}
        />
      </div>

      {draft.useCustomDate ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-8 text-xs", !draft.customDate && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-3 w-3" />
              {draft.customDate ? format(new Date(draft.customDate), "PPP", { locale: idLocale }) : "Pilih tanggal"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={draft.customDate ? new Date(draft.customDate) : undefined}
              onSelect={(date) => setDraft((prev) => ({ ...prev, customDate: date ? format(date, "yyyy-MM-dd") : null }))}
              className="p-3 pointer-events-auto"
              initialFocus
            />
          </PopoverContent>
        </Popover>
      ) : null}

      <Separator />

      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Penanda tangan ({signerCount})</Label>
        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={addSigner} disabled={draft.signers.length >= 4}>
          <Plus className="mr-1 h-3 w-3" />
          Tambah
        </Button>
      </div>

      <div className="space-y-2">
        {draft.signers.map((signer, index) => (
          <div key={signer.id} className="rounded-lg border border-border bg-background/50 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                <GripVertical className="h-3 w-3" />
                #{index + 1}
              </p>
              <div className="flex items-center gap-0.5">
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveSigner(index, "up")} disabled={index === 0}>
                  <ArrowUp className="h-2.5 w-2.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveSigner(index, "down")} disabled={index === draft.signers.length - 1}>
                  <ArrowDown className="h-2.5 w-2.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeSigner(index)} disabled={draft.signers.length <= 1}>
                  <Trash2 className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>
            <Input value={signer.title} onChange={(event) => setSigner(index, "title", event.target.value)} placeholder="Jabatan" className="h-7 text-[11px]" />
            <Input value={signer.name} onChange={(event) => setSigner(index, "name", event.target.value)} placeholder="Nama lengkap" className="h-7 text-[11px]" />
            <Input value={signer.nip} onChange={(event) => setSigner(index, "nip", event.target.value)} placeholder="NIP (opsional)" className="h-7 text-[11px]" />
            {index === 0 ? (
              <Input value={signer.school_name} onChange={(event) => setSigner(index, "school_name", event.target.value)} placeholder="Nama sekolah (opsional)" className="h-7 text-[11px]" />
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}

function ExperimentalTypographyWindow({
  open,
  onOpenChange,
  documentStyle,
  onDocumentStyleChange,
  columnTypographyOptions,
  isMobile,
  highlightTarget,
  onHighlightTargetChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  documentStyle?: ReportDocumentStyle;
  onDocumentStyleChange?: Dispatch<SetStateAction<ReportDocumentStyle>>;
  columnTypographyOptions?: ExportColumnTypographyOption[];
  isMobile: boolean;
  highlightTarget?: ExportPreviewHighlightTarget | null;
  onHighlightTargetChange?: (target: ExportPreviewHighlightTarget | null) => void;
}) {
  const [windowRect, setWindowRect] = useState({ x: 48, y: 48, width: 520, height: 620 });
  const [activeTab, setActiveTab] = useState<"typography" | "layout">("typography");
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollMemoryRef = useRef<Record<string, number>>({ typography: 0, layout: 0 });

  useEffect(() => {
    if (!open || isMobile) return;
    setWindowRect((prev) => ({
      ...prev,
      x: Math.min(prev.x, Math.max(16, window.innerWidth - prev.width - 16)),
      y: Math.min(prev.y, Math.max(16, window.innerHeight - prev.height - 16)),
      width: Math.min(prev.width, window.innerWidth - 32),
      height: Math.min(prev.height, window.innerHeight - 32),
    }));
  }, [isMobile, open]);

  useEffect(() => {
    if (!open || isMobile) return;

    const handleMove = (event: PointerEvent) => {
      if (!dragState.current) return;
      const nextX = clamp(dragState.current.originX + (event.clientX - dragState.current.startX), 16, Math.max(16, window.innerWidth - windowRect.width - 16));
      const nextY = clamp(dragState.current.originY + (event.clientY - dragState.current.startY), 16, Math.max(16, window.innerHeight - windowRect.height - 16));
      setWindowRect((prev) => ({ ...prev, x: nextX, y: nextY }));
    };

    const handleResize = () => {
      setWindowRect((prev) => ({
        ...prev,
        x: Math.min(prev.x, Math.max(16, window.innerWidth - prev.width - 16)),
        y: Math.min(prev.y, Math.max(16, window.innerHeight - prev.height - 16)),
        width: Math.min(prev.width, window.innerWidth - 32),
        height: Math.min(prev.height, window.innerHeight - 32),
      }));
    };

    const handleUp = () => {
      dragState.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("resize", handleResize);
    };
  }, [isMobile, open, windowRect.height, windowRect.width]);

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    requestAnimationFrame(() => {
      bodyRef.current?.scrollTo({ top: scrollMemoryRef.current[activeTab] ?? 0 });
    });
  }, [activeTab, open]);

  if (!open || !documentStyle || !onDocumentStyleChange || !columnTypographyOptions?.length) {
    return null;
  }

  const parseCustomNumber = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(Number(parsed.toFixed(2)), 1, 40);
  };

  const parseSizeNumber = (value: string, fallback: number, min = 3, max = 160) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(Number(parsed.toFixed(2)), min, max);
  };

  const updateColumnOverride = (key: string, patch: Record<string, unknown>) => {
    onDocumentStyleChange((prev) => ({
      ...prev,
      experimentalColumnTypographyEnabled: true,
      experimentalColumnLayoutEnabled: true,
      columnFontOverrides: {
        ...prev.columnFontOverrides,
        [key]: {
          ...prev.columnFontOverrides[key],
          ...patch,
        },
      },
    }));
  };

  const applySuggestions = () => {
    onDocumentStyleChange((prev) => ({
      ...prev,
      experimentalColumnTypographyEnabled: true,
      experimentalColumnLayoutEnabled: true,
      columnFontOverrides: Object.fromEntries(
        columnTypographyOptions.map((option) => [
          option.key,
          {
            headerFontSize: option.suggestedHeaderFontSize ?? prev.tableHeaderFontSize,
            bodyFontSize: option.suggestedBodyFontSize ?? prev.tableBodyFontSize,
            widthMm: option.suggestedWidthMm,
            headerAlignment: option.suggestedHeaderAlignment ?? "center",
            bodyAlignment: option.suggestedBodyAlignment ?? (option.type === "name" || option.type === "nisn" ? "left" : "center"),
          },
        ]),
      ),
    }));
  };

  const syncWithGlobal = () => {
    onDocumentStyleChange((prev) => ({
      ...prev,
      experimentalColumnTypographyEnabled: true,
      experimentalColumnLayoutEnabled: true,
      columnFontOverrides: Object.fromEntries(
        columnTypographyOptions.map((option) => [
          option.key,
          {
            headerFontSize: prev.tableHeaderFontSize,
            bodyFontSize: prev.tableBodyFontSize,
            widthMm: option.suggestedWidthMm,
            headerAlignment: "center",
            bodyAlignment: option.type === "name" || option.type === "nisn" ? "left" : "center",
          },
        ]),
      ),
    }));
  };

  const resetExperimental = () => {
    onDocumentStyleChange((prev) => ({
      ...prev,
      experimentalColumnTypographyEnabled: false,
      experimentalColumnLayoutEnabled: false,
      columnFontOverrides: {},
      tableSizing: {
        ...prev.tableSizing,
        mode: "autofit-window",
        tableWidthPercent: 100,
        headerRowHeightMm: undefined,
        bodyRowHeightMm: undefined,
      },
    }));
  };

  const windowStyle = isMobile
    ? undefined
    : {
        left: windowRect.x,
        top: windowRect.y,
        width: windowRect.width,
        height: windowRect.height,
      };
  const experimentalActive = documentStyle.experimentalColumnTypographyEnabled || documentStyle.experimentalColumnLayoutEnabled;
  const headerRowHeight = documentStyle.tableSizing.headerRowHeightMm ?? clamp(5.6 + (documentStyle.tableHeaderFontSize - 10) * 0.7, 3, 30);
  const bodyRowHeight = documentStyle.tableSizing.bodyRowHeightMm ?? clamp(5.2 + (documentStyle.tableBodyFontSize - 10) * 0.9, 3, 30);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-slate-950/5" onClick={() => onOpenChange(false)} />
      <div
        className={cn(
          "pointer-events-auto fixed flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl",
          isMobile ? "inset-2" : "min-w-[420px] min-h-[440px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] resize both",
        )}
        style={{ ...windowStyle, overscrollBehavior: "contain" }}
      >
        <div
          className={cn("flex items-center justify-between gap-3 border-b border-border bg-muted/60 px-3 py-2", !isMobile && "cursor-grab")}
          onPointerDown={isMobile ? undefined : (event) => {
            dragState.current = {
              startX: event.clientX,
              startY: event.clientY,
              originX: windowRect.x,
              originY: windowRect.y,
            };
          }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Studio Eksperimental</p>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Atur tipografi, alignment, dan ukuran tabel per kolom sambil tetap melihat preview. {isMobile ? "Di mobile tampil penuh agar tetap nyaman." : "Jendela ini bisa digeser, diperbesar, dan diletakkan lebih bebas."}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={applySuggestions}>
              Saran Cerdas
            </Button>
            <HintInfo label="Saran Cerdas" description="Mengisi ukuran font, alignment, dan lebar awal berdasarkan data kolom yang sedang aktif. Cocok sebagai dasar sebelum penyesuaian manual." />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[10px]"
              onClick={() => onDocumentStyleChange((prev) => ({
                ...prev,
                experimentalColumnTypographyEnabled: !experimentalActive,
                experimentalColumnLayoutEnabled: !experimentalActive,
              }))}
            >
              {experimentalActive ? "Nonaktifkan Mode" : "Aktifkan Mode"}
            </Button>
            <HintInfo label="Aktifkan Mode" description="Saat aktif, override eksperimen langsung dipakai oleh live preview dan ekspor. Saat dimatikan, preview kembali ke pengaturan global." />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={syncWithGlobal}>
            Samakan Global
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-[10px]" onClick={resetExperimental}>
            Reset Eksperimental
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          {([
            { key: "typography", label: "Tipografi & Alignment", icon: Sparkles },
            { key: "layout", label: "Ukuran & Layout", icon: Columns3 },
          ] as const).map(({ key, label, icon: Icon }) => (
            <Button
              key={key}
              type="button"
              variant={activeTab === key ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5 rounded-full px-3 text-[10px]"
              onClick={() => {
                scrollMemoryRef.current[activeTab] = bodyRef.current?.scrollTop ?? 0;
                setActiveTab(key);
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>

        <div ref={bodyRef} className="flex-1 overflow-y-auto px-3 py-3 pb-4">
          <div className="mb-3 rounded-xl border border-border bg-muted/30 p-3 text-[10px] text-muted-foreground">
            <div className="flex items-center justify-between gap-3">
              <div>
                Studio ini sinkron langsung dengan live preview. Saat Anda menyorot kolom tertentu di sini, preview akan menandai bagian yang terdampak.
              </div>
              {highlightTarget?.kind === "column" ? (
                <div className="rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[9px] font-semibold text-primary">
                  Target: {highlightTarget.label || highlightTarget.key}
                </div>
              ) : null}
            </div>
          </div>

          {activeTab === "layout" ? (
            <div className="mb-3 rounded-xl border border-border bg-background/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">General</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Atur mode tabel keseluruhan, tinggi header, tinggi baris data, dan skala lebar tabel sebelum fine-tuning per kolom.
                  </p>
                </div>
                <HintInfo label="General layout" description="Autofit konten mempertahankan ukuran natural kolom. Autofit window menyesuaikan tabel ke ruang halaman. Fixed membuat ukuran tabel lebih stabil untuk diatur manual." />
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Mode lebar tabel</Label>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      { key: "autofit-window", label: "Autofit Window" },
                      { key: "autofit-content", label: "Autofit Konten" },
                      { key: "fixed", label: "Fixed" },
                    ] as const).map((mode) => (
                      <Button
                        key={mode.key}
                        type="button"
                        variant={documentStyle.tableSizing.mode === mode.key ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-[10px]"
                        onClick={() => onDocumentStyleChange((prev) => ({
                          ...prev,
                          experimentalColumnLayoutEnabled: true,
                          tableSizing: {
                            ...prev.tableSizing,
                            mode: mode.key,
                          },
                        }))}
                      >
                        {mode.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px]">Ukuran tabel ({documentStyle.tableSizing.tableWidthPercent.toFixed(2)}%)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="40"
                      max="160"
                      value={documentStyle.tableSizing.tableWidthPercent.toFixed(2)}
                      onChange={(event) => onDocumentStyleChange((prev) => ({
                        ...prev,
                        experimentalColumnLayoutEnabled: true,
                        tableSizing: {
                          ...prev.tableSizing,
                          tableWidthPercent: parseSizeNumber(event.target.value, prev.tableSizing.tableWidthPercent, 40, 160),
                        },
                      }))}
                      className="h-8 w-24 text-[11px]"
                    />
                  </div>
                  <SliderWithButtons value={documentStyle.tableSizing.tableWidthPercent} min={40} max={160} step={0.25} buttonStep={1} onValueChange={(value) => onDocumentStyleChange((prev) => ({
                    ...prev,
                    experimentalColumnLayoutEnabled: true,
                    tableSizing: {
                      ...prev.tableSizing,
                      tableWidthPercent: Number(value.toFixed(2)),
                    },
                  }))} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px]">Tinggi header ({headerRowHeight.toFixed(2)}mm)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="3"
                      max="30"
                      value={headerRowHeight.toFixed(2)}
                      onChange={(event) => onDocumentStyleChange((prev) => ({
                        ...prev,
                        experimentalColumnLayoutEnabled: true,
                        tableSizing: {
                          ...prev.tableSizing,
                          headerRowHeightMm: parseSizeNumber(event.target.value, headerRowHeight, 3, 30),
                        },
                      }))}
                      className="h-8 w-24 text-[11px]"
                    />
                  </div>
                  <SliderWithButtons value={headerRowHeight} min={3} max={30} step={0.25} buttonStep={1} onValueChange={(value) => onDocumentStyleChange((prev) => ({
                    ...prev,
                    experimentalColumnLayoutEnabled: true,
                    tableSizing: {
                      ...prev.tableSizing,
                      headerRowHeightMm: Number(value.toFixed(2)),
                    },
                  }))} />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-[10px]">Tinggi baris data ({bodyRowHeight.toFixed(2)}mm)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="3"
                      max="30"
                      value={bodyRowHeight.toFixed(2)}
                      onChange={(event) => onDocumentStyleChange((prev) => ({
                        ...prev,
                        experimentalColumnLayoutEnabled: true,
                        tableSizing: {
                          ...prev.tableSizing,
                          bodyRowHeightMm: parseSizeNumber(event.target.value, bodyRowHeight, 3, 30),
                        },
                      }))}
                      className="h-8 w-24 text-[11px]"
                    />
                  </div>
                  <SliderWithButtons value={bodyRowHeight} min={3} max={30} step={0.25} buttonStep={1} onValueChange={(value) => onDocumentStyleChange((prev) => ({
                    ...prev,
                    experimentalColumnLayoutEnabled: true,
                    tableSizing: {
                      ...prev.tableSizing,
                      bodyRowHeightMm: Number(value.toFixed(2)),
                    },
                  }))} />
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            {columnTypographyOptions.map((option) => {
              const override = documentStyle.columnFontOverrides[option.key] || {};
              const headerValue = override.headerFontSize ?? documentStyle.tableHeaderFontSize;
              const bodyValue = override.bodyFontSize ?? documentStyle.tableBodyFontSize;
              const widthValue = override.widthMm ?? option.suggestedWidthMm ?? 18;
              const headerAlignment = override.headerAlignment ?? "center";
              const bodyAlignment = override.bodyAlignment ?? (option.type === "name" || option.type === "nisn" ? "left" : "center");
              const isHighlighted = highlightTarget?.kind === "column" && highlightTarget.key === option.key;
              return (
                <div
                  key={option.key}
                  className={cn("rounded-xl border bg-background/80 p-3 transition-colors", isHighlighted ? "border-primary shadow-sm" : "border-border")}
                  onMouseEnter={() => onHighlightTargetChange?.({ kind: "column", key: option.key, label: option.label })}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-foreground">{option.label}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[9px]"
                          onClick={() => onHighlightTargetChange?.({ kind: "column", key: option.key, label: option.label })}
                        >
                          Tampilkan
                        </Button>
                      </div>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {option.description || "Kolom aktif"}
                        {option.sampleValue ? ` • Contoh: ${option.sampleValue}` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => updateColumnOverride(option.key, {
                        headerFontSize: option.suggestedHeaderFontSize ?? documentStyle.tableHeaderFontSize,
                        bodyFontSize: option.suggestedBodyFontSize ?? documentStyle.tableBodyFontSize,
                        widthMm: option.suggestedWidthMm,
                        headerAlignment: option.suggestedHeaderAlignment ?? "center",
                        bodyAlignment: option.suggestedBodyAlignment ?? (option.type === "name" || option.type === "nisn" ? "left" : "center"),
                      })}
                    >
                      Auto
                    </Button>
                  </div>

                  {activeTab === "typography" ? (
                    <>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-[10px]">Header ({headerValue.toFixed(2)}pt)</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="1"
                              max="40"
                              value={headerValue.toFixed(2)}
                              onChange={(event) => updateColumnOverride(option.key, { headerFontSize: parseCustomNumber(event.target.value, headerValue) })}
                              className="h-8 w-24 text-[11px]"
                            />
                          </div>
                          <SliderWithButtons
                            value={headerValue}
                            min={1}
                            max={40}
                            step={0.25}
                            buttonStep={1}
                            onValueChange={(value) => updateColumnOverride(option.key, { headerFontSize: Number(value.toFixed(2)) })}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <Label className="text-[10px]">Isi ({bodyValue.toFixed(2)}pt)</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="1"
                              max="40"
                              value={bodyValue.toFixed(2)}
                              onChange={(event) => updateColumnOverride(option.key, { bodyFontSize: parseCustomNumber(event.target.value, bodyValue) })}
                              className="h-8 w-24 text-[11px]"
                            />
                          </div>
                          <SliderWithButtons
                            value={bodyValue}
                            min={1}
                            max={40}
                            step={0.25}
                            buttonStep={1}
                            onValueChange={(value) => updateColumnOverride(option.key, { bodyFontSize: Number(value.toFixed(2)) })}
                          />
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Alignment header</Label>
                          <div className="grid grid-cols-3 gap-1">
                            {([
                              { key: "left", label: "Kiri" },
                              { key: "center", label: "Tengah" },
                              { key: "right", label: "Kanan" },
                            ] as const).map((align) => (
                              <Button key={`header-${align.key}`} type="button" variant={headerAlignment === align.key ? "default" : "outline"} size="sm" className="h-8 text-[10px]" onClick={() => updateColumnOverride(option.key, { headerAlignment: align.key })}>
                                {align.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Alignment isi</Label>
                          <div className="grid grid-cols-3 gap-1">
                            {([
                              { key: "left", label: "Kiri" },
                              { key: "center", label: "Tengah" },
                              { key: "right", label: "Kanan" },
                            ] as const).map((align) => (
                              <Button key={`body-${align.key}`} type="button" variant={bodyAlignment === align.key ? "default" : "outline"} size="sm" className="h-8 text-[10px]" onClick={() => updateColumnOverride(option.key, { bodyAlignment: align.key })}>
                                {align.label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-[10px]">Lebar kolom ({widthValue.toFixed(2)}mm)</Label>
                          <Input type="number" inputMode="decimal" step="0.01" min="4" max="120" value={widthValue.toFixed(2)} onChange={(event) => updateColumnOverride(option.key, { widthMm: parseSizeNumber(event.target.value, widthValue, 4, 120) })} className="h-8 w-24 text-[11px]" />
                        </div>
                        <SliderWithButtons value={widthValue} min={4} max={120} step={0.25} buttonStep={1} onValueChange={(value) => updateColumnOverride(option.key, { widthMm: Number(value.toFixed(2)) })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px]">Mode kolom</Label>
                        <div
                          className="grid gap-1"
                          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8rem), 1fr))" }}
                        >
                          {([
                            { key: "inherit", label: "Ikuti Tabel" },
                            { key: "autofit-content", label: "Autofit Konten" },
                            { key: "autofit-window", label: "Autofit Window" },
                            { key: "fixed", label: "Fixed" },
                          ] as const).map((mode) => (
                            <Button key={mode.key} type="button" variant={(override.sizingMode ?? "inherit") === mode.key ? "default" : "outline"} size="sm" className="h-8 text-[10px]" onClick={() => updateColumnOverride(option.key, { sizingMode: mode.key })}>
                              {mode.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function LegacyStylePanel({
  draft,
  setDraft,
  documentStyle,
  onDocumentStyleChange,
  autoFitOnePage,
  onAutoFitOnePageChange,
  showAutoFitPreset,
  includeSignature,
  supportsSignature,
  columnTypographyOptions,
  onOpenExperimentalWindow,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  documentStyle?: ReportDocumentStyle;
  onDocumentStyleChange?: Dispatch<SetStateAction<ReportDocumentStyle>>;
  autoFitOnePage?: boolean;
  onAutoFitOnePageChange?: (value: boolean) => void;
  showAutoFitPreset?: boolean;
  includeSignature: boolean;
  supportsSignature: boolean;
  columnTypographyOptions?: ExportColumnTypographyOption[];
  onOpenExperimentalWindow: () => void;
}) {
  const parseCustomNumber = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(Number(parsed.toFixed(2)), 1, 40);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-background/50 p-3">
        <p className="text-[11px] font-semibold text-foreground">Style Dokumen</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Kelompok ini mengatur preset, tipografi dokumen, dan tampilan blok tanda tangan agar lebih mudah dipahami seperti panel desain modern.</p>
      </div>

      {documentStyle && onDocumentStyleChange ? (
        <>
          <div className="space-y-2 rounded-lg border border-border p-2.5">
            <div>
              <Label className="text-[11px] font-semibold">Preset</Label>
              <p className="text-[9px] text-muted-foreground">Pilih titik awal yang paling nyaman, lalu sesuaikan lagi bila perlu.</p>
            </div>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8rem), 1fr))" }}
            >
              {([
                { label: "1 Halaman", title: 14, meta: 9, header: 10, body: 10, desc: "Utamakan 1 halaman tabel", autoFit: true },
                { label: "1 Kolom Penuh", title: 12, meta: 8, header: 8, body: 7, desc: "Titik awal agar semua kolom muat", autoFit: false },
                { label: "Kompak", title: 14, meta: 9, header: 9, body: 8, desc: "Ringkas", autoFit: false },
                { label: "Standar", title: 16, meta: 10, header: 12, body: 11, desc: "Seimbang", autoFit: false },
                { label: "Besar", title: 20, meta: 12, header: 14, body: 13, desc: "Paling mudah dibaca", autoFit: false },
              ] as const).map((preset) => (
                <Button
                  key={preset.label}
                  variant={
                    documentStyle.titleFontSize === preset.title &&
                    documentStyle.tableBodyFontSize === preset.body &&
                    (!!autoFitOnePage === preset.autoFit)
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="h-auto flex-col items-start py-1.5 text-[10px]"
                  onClick={() => {
                    onDocumentStyleChange((prev) => ({
                      ...prev,
                      titleFontSize: preset.title,
                      metaFontSize: preset.meta,
                      tableHeaderFontSize: preset.header,
                      tableBodyFontSize: preset.body,
                    }));
                    onAutoFitOnePageChange?.(preset.autoFit);
                  }}
                >
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-[8px] opacity-70">{preset.desc}</span>
                </Button>
              ))}
            </div>
          </div>

          {showAutoFitPreset ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-[11px]">Optimalkan 1 halaman</Label>
                <p className="text-[9px] text-muted-foreground">Sistem akan berusaha menjaga tabel tetap padat tanpa mengorbankan keterbacaan terlalu jauh.</p>
              </div>
              <Switch checked={!!autoFitOnePage} onCheckedChange={(checked) => onAutoFitOnePageChange?.(checked)} />
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-border p-2.5">
            <div>
              <Label className="text-[11px] font-semibold">Tipografi</Label>
              <p className="text-[9px] text-muted-foreground">Ukuran judul, info dokumen, header tabel, dan isi tabel akan langsung tercermin pada preview.</p>
            </div>
            {([
              { key: "titleFontSize", label: "Judul dokumen" },
              { key: "metaFontSize", label: "Info dokumen" },
              { key: "tableHeaderFontSize", label: "Header tabel" },
              { key: "tableBodyFontSize", label: "Isi tabel" },
            ] as const).map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[11px]">{item.label} ({documentStyle[item.key].toFixed(2)}pt)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    max="40"
                    value={documentStyle[item.key].toFixed(2)}
                    onChange={(event) => {
                      const nextValue = parseCustomNumber(event.target.value, documentStyle[item.key]);
                      onDocumentStyleChange((prev) => ({ ...prev, [item.key]: nextValue }));
                    }}
                    className="h-8 w-24 text-[11px]"
                  />
                </div>
                <SliderWithButtons
                  value={documentStyle[item.key]}
                  min={1}
                  max={40}
                  step={0.25}
                  buttonStep={1}
                  onValueChange={(value) => onDocumentStyleChange((prev) => ({ ...prev, [item.key]: Number(value.toFixed(2)) }))}
                />
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground">Semua ukuran menerima input manual seperti di word processor, termasuk desimal hingga 2 angka di belakang koma.</p>
          </div>

          {columnTypographyOptions && columnTypographyOptions.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border p-2.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="text-[11px] font-semibold">Eksperimental: Font Per Kolom</Label>
                  <p className="text-[9px] text-muted-foreground">Atur header dan isi per kolom. Studio membaca kolom aktif saat ini lalu memberi saran otomatis berdasarkan panjang header dan data.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-[10px]"
                  onClick={() => onDocumentStyleChange((prev) => ({
                    ...prev,
                    experimentalColumnTypographyEnabled: true,
                    columnFontOverrides: Object.fromEntries(
                      columnTypographyOptions.map((option) => [
                        option.key,
                        {
                          headerFontSize: option.suggestedHeaderFontSize ?? prev.tableHeaderFontSize,
                          bodyFontSize: option.suggestedBodyFontSize ?? prev.tableBodyFontSize,
                        },
                      ]),
                    ),
                  }))}
                >
                  Saran Cerdas
                </Button>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label className="text-[11px]">Aktifkan mode eksperimen</Label>
                  <p className="text-[9px] text-muted-foreground">Saat aktif, font tiap kolom bisa disetel sendiri. Saat nonaktif, semua kolom kembali mengikuti tipografi global.</p>
                </div>
                <Switch
                  checked={documentStyle.experimentalColumnTypographyEnabled}
                  onCheckedChange={(checked) => onDocumentStyleChange((prev) => ({ ...prev, experimentalColumnTypographyEnabled: checked }))}
                />
              </div>

              {documentStyle.experimentalColumnTypographyEnabled ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => onDocumentStyleChange((prev) => ({ ...prev, columnFontOverrides: {} }))}
                    >
                      Reset Per Kolom
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px]"
                      onClick={() => onDocumentStyleChange((prev) => ({
                        ...prev,
                        columnFontOverrides: Object.fromEntries(
                          columnTypographyOptions.map((option) => [
                            option.key,
                            {
                              headerFontSize: prev.tableHeaderFontSize,
                              bodyFontSize: prev.tableBodyFontSize,
                            },
                          ]),
                        ),
                      }))}
                    >
                      Samakan dengan Global
                    </Button>
                  </div>

                  <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                    {columnTypographyOptions.map((option) => {
                      const override = documentStyle.columnFontOverrides[option.key] || {};
                      const headerValue = override.headerFontSize ?? documentStyle.tableHeaderFontSize;
                      const bodyValue = override.bodyFontSize ?? documentStyle.tableBodyFontSize;
                      return (
                        <div key={option.key} className="rounded-lg border border-border bg-background/60 p-2.5 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-foreground truncate">{option.label}</p>
                              <p className="text-[9px] text-muted-foreground">
                                {option.description || "Kolom aktif"}
                                {option.sampleValue ? ` • Contoh: ${option.sampleValue}` : ""}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => onDocumentStyleChange((prev) => ({
                                ...prev,
                                columnFontOverrides: {
                                  ...prev.columnFontOverrides,
                                  [option.key]: {
                                    headerFontSize: option.suggestedHeaderFontSize ?? prev.tableHeaderFontSize,
                                    bodyFontSize: option.suggestedBodyFontSize ?? prev.tableBodyFontSize,
                                  },
                                },
                              }))}
                            >
                              Auto
                            </Button>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-[10px]">Header ({headerValue.toFixed(2)}pt)</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="1"
                                max="40"
                                value={headerValue.toFixed(2)}
                                onChange={(event) => {
                                  const nextValue = parseCustomNumber(event.target.value, headerValue);
                                  onDocumentStyleChange((prev) => ({
                                    ...prev,
                                    columnFontOverrides: {
                                      ...prev.columnFontOverrides,
                                      [option.key]: {
                                        ...prev.columnFontOverrides[option.key],
                                        headerFontSize: nextValue,
                                      },
                                    },
                                  }));
                                }}
                                className="h-7 w-24 text-[10px]"
                              />
                            </div>
                            <SliderWithButtons
                              value={headerValue}
                              min={1}
                              max={40}
                              step={0.25}
                              buttonStep={1}
                              onValueChange={(value) => onDocumentStyleChange((prev) => ({
                                ...prev,
                                columnFontOverrides: {
                                  ...prev.columnFontOverrides,
                                  [option.key]: {
                                    ...prev.columnFontOverrides[option.key],
                                    headerFontSize: Number(value.toFixed(2)),
                                  },
                                },
                              }))}
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="text-[10px]">Isi ({bodyValue.toFixed(2)}pt)</Label>
                              <Input
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="1"
                                max="40"
                                value={bodyValue.toFixed(2)}
                                onChange={(event) => {
                                  const nextValue = parseCustomNumber(event.target.value, bodyValue);
                                  onDocumentStyleChange((prev) => ({
                                    ...prev,
                                    columnFontOverrides: {
                                      ...prev.columnFontOverrides,
                                      [option.key]: {
                                        ...prev.columnFontOverrides[option.key],
                                        bodyFontSize: nextValue,
                                      },
                                    },
                                  }));
                                }}
                                className="h-7 w-24 text-[10px]"
                              />
                            </div>
                            <SliderWithButtons
                              value={bodyValue}
                              min={1}
                              max={40}
                              step={0.25}
                              buttonStep={1}
                              onValueChange={(value) => onDocumentStyleChange((prev) => ({
                                ...prev,
                                columnFontOverrides: {
                                  ...prev.columnFontOverrides,
                                  [option.key]: {
                                    ...prev.columnFontOverrides[option.key],
                                    bodyFontSize: Number(value.toFixed(2)),
                                  },
                                },
                              }))}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-[10px] text-muted-foreground">
                  Alternatif cerdas: aktifkan mode ini bila Anda ingin mengecilkan kolom tugas yang padat, membesarkan kolom nama, atau mengatur kolom tertentu tanpa memengaruhi tabel lainnya.
                </div>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      <Separator />

      <div className={cn("space-y-2 rounded-lg border border-border p-2.5 transition-opacity", supportsSignature && !includeSignature && "opacity-45")}>
        <div>
          <Label className="text-[11px] font-semibold">Style Tanda Tangan</Label>
          <p className="text-[9px] text-muted-foreground">
            {supportsSignature && !includeSignature
              ? "Aktifkan penanda tangan terlebih dahulu untuk mengubah style tanda tangan."
              : "Atur ukuran teks, garis tanda tangan, dan jarak antar penanda tangan."}
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[11px]">Ukuran font ({draft.fontSize.toFixed(2)}pt)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="1"
              max="40"
              value={draft.fontSize.toFixed(2)}
              onChange={(event) => setDraft((prev) => ({ ...prev, fontSize: parseCustomNumber(event.target.value, prev.fontSize) }))}
              className="h-8 w-24 text-[11px]"
              disabled={supportsSignature && !includeSignature}
            />
          </div>
          <SliderWithButtons value={draft.fontSize} min={1} max={40} step={0.25} buttonStep={1} disabled={supportsSignature && !includeSignature} onValueChange={(value) => setDraft((prev) => ({ ...prev, fontSize: Number(value.toFixed(2)) }))} />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label className="text-[11px]">Garis tanda tangan</Label>
            <p className="text-[9px] text-muted-foreground">Nonaktifkan bila ingin nama penanda tangan tampil tanpa garis.</p>
          </div>
          <Switch checked={draft.showSignatureLine} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showSignatureLine: checked }))} disabled={supportsSignature && !includeSignature} />
        </div>
        {draft.showSignatureLine ? (
          <div className="space-y-1.5">
            <Label className="text-[11px]">Lebar garis ({draft.signatureLineWidth}mm)</Label>
            <SliderWithButtons value={draft.signatureLineWidth} min={20} max={100} step={5} disabled={supportsSignature && !includeSignature} onValueChange={(value) => setDraft((prev) => ({ ...prev, signatureLineWidth: value }))} />
          </div>
        ) : null}
        {draft.signers.length > 1 ? (
          <div className="space-y-1.5">
            <Label className="text-[11px]">Jarak antar penanda tangan ({draft.signatureSpacing}mm)</Label>
            <SliderWithButtons value={draft.signatureSpacing} min={5} max={80} step={5} disabled={supportsSignature && !includeSignature} onValueChange={(value) => setDraft((prev) => ({ ...prev, signatureSpacing: value }))} />
          </div>
        ) : null}
      </div>
    </>
  );
}

function PositionPanel({
  draft,
  setDraft,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
}) {
  const nudgePosition = (axis: "x" | "y", delta: number) => {
    setDraft((prev) => ({
      ...prev,
      ...(axis === "x"
        ? { signatureOffsetX: clamp(prev.signatureOffsetX + delta, -120, 120) }
        : { signatureOffsetY: clamp(prev.signatureOffsetY + delta, -90, 120) }),
    }));
  };

  const resetPosition = () => {
    setDraft((prev) => ({
      ...prev,
      signatureAlignment: "right",
      signaturePreset: "bottom-right",
      signatureOffsetX: 0,
      signatureOffsetY: 0,
      manualXPercent: null,
      manualYPercent: null,
      snapToGrid: true,
      gridSizeMm: 5,
      lockSignaturePosition: false,
      showDebugGuides: false,
    }));
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-background/50 p-3">
        <p className="text-[11px] font-semibold text-foreground">Posisi Tanda Tangan</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Seret tanda tangan langsung di preview, lalu rapikan lagi memakai offset dan kontrol presisi di bawah ini.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold">Posisi awal</Label>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8rem), 1fr))" }}
        >
          {([
            { key: "bottom-left", label: "Bawah kiri" },
            { key: "bottom-center", label: "Bawah tengah" },
            { key: "bottom-right", label: "Bawah kanan" },
            { key: "follow-content", label: "Ikut konten" },
          ] as const).map((preset) => (
            <Button
              key={preset.key}
              variant={draft.signaturePreset === preset.key ? "default" : "outline"}
              size="sm"
              className="h-8 text-[10px]"
              onClick={() => setDraft((prev) => ({ ...prev, signaturePreset: preset.key }))}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold">Perataan blok</Label>
        <div className="flex gap-1">
          {([
            { key: "left", icon: AlignLeft, label: "Kiri" },
            { key: "center", icon: AlignCenter, label: "Tengah" },
            { key: "right", icon: AlignRight, label: "Kanan" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <Button
              key={key}
              variant={draft.signatureAlignment === key ? "default" : "outline"}
              size="sm"
              className="flex-1 h-8 gap-1 text-[10px]"
              onClick={() => setDraft((prev) => ({ ...prev, signatureAlignment: key }))}
            >
              <Icon className="h-3 w-3" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border p-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-[11px]">Kunci tata letak tanda tangan</Label>
            <p className="text-[9px] text-muted-foreground">Cegah blok tanda tangan bergeser saat preview disentuh atau diseret.</p>
          </div>
          <Switch checked={draft.lockSignaturePosition} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, lockSignaturePosition: checked }))} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-[11px]">Snap ke grid</Label>
            <p className="text-[9px] text-muted-foreground">Membantu posisi tetap rapi pada perpindahan kecil.</p>
          </div>
          <Switch checked={draft.snapToGrid} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, snapToGrid: checked }))} />
        </div>
        {draft.snapToGrid ? (
          <div className="space-y-1.5">
            <Label className="text-[11px]">Ukuran grid ({draft.gridSizeMm}mm)</Label>
            <SliderWithButtons value={draft.gridSizeMm} min={1} max={20} step={1} onValueChange={(value) => setDraft((prev) => ({ ...prev, gridSizeMm: value }))} />
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px]">Offset horizontal ({draft.signatureOffsetX}mm)</Label>
        <SliderWithButtons value={draft.signatureOffsetX} min={-120} max={120} step={1} onValueChange={(value) => setDraft((prev) => ({ ...prev, signatureOffsetX: value }))} />
        <p className="text-[9px] text-muted-foreground">Angka negatif menggeser ke kiri, angka positif menggeser ke kanan.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px]">Offset vertikal ({draft.signatureOffsetY}mm)</Label>
        <SliderWithButtons value={draft.signatureOffsetY} min={-90} max={120} step={1} onValueChange={(value) => setDraft((prev) => ({ ...prev, signatureOffsetY: value }))} />
        <p className="text-[9px] text-muted-foreground">Angka negatif mengangkat posisi, angka positif menurunkannya.</p>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold">Kontrol presisi</Label>
        <div className="flex flex-col items-center gap-1">
          <RepeatButton onTrigger={() => nudgePosition("y", -1)} aria-label="Geser ke atas">
            <ArrowUp className="h-3.5 w-3.5" />
          </RepeatButton>
          <div className="flex items-center gap-1">
            <RepeatButton onTrigger={() => nudgePosition("x", -1)} aria-label="Geser ke kiri">
              <ArrowLeft className="h-3.5 w-3.5" />
            </RepeatButton>
            <div className="flex h-8 w-10 items-center justify-center rounded-md border border-border">
              <Move className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <RepeatButton onTrigger={() => nudgePosition("x", 1)} aria-label="Geser ke kanan">
              <ArrowRight className="h-3.5 w-3.5" />
            </RepeatButton>
          </div>
          <RepeatButton onTrigger={() => nudgePosition("y", 1)} aria-label="Geser ke bawah">
            <ArrowDown className="h-3.5 w-3.5" />
          </RepeatButton>
          <p className="text-[9px] text-muted-foreground">Tekan & tahan untuk menggeser cepat — gerakan otomatis dipercepat setelah 1 detik.</p>
        </div>
      </div>

      <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={resetPosition}>
        <RotateCcw className="h-3 w-3" />
        Reset posisi
      </Button>
    </>
  );
}

function ColumnPanel({
  columnOptions,
  onColumnOptionChange,
}: {
  columnOptions: ExportColumnOption[];
  onColumnOptionChange: (key: string, checked: boolean) => void;
}) {
  const checkedCount = columnOptions.filter((c) => c.checked).length;
  const allChecked = checkedCount === columnOptions.length;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleAll = (checked: boolean) => {
    columnOptions.forEach((col) => onColumnOptionChange(col.key, checked));
  };
  const toggleChildren = (children: ExportColumnOption[] | undefined, checked: boolean) => {
    children?.forEach((child) => onColumnOptionChange(child.key, checked));
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-background/50 p-3">
        <p className="text-[11px] font-semibold text-foreground">Kolom Ekspor</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Pilih kolom data yang akan ditampilkan di file ekspor dan live preview. Perubahan langsung terlihat di preview.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-semibold">{checkedCount}/{columnOptions.length} kolom aktif</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 text-[10px]"
          onClick={() => toggleAll(!allChecked)}
        >
          {allChecked ? "Hapus Semua" : "Pilih Semua"}
        </Button>
      </div>

      <div className="space-y-1">
        {columnOptions.map((col) => {
          const hasChildren = !!col.children?.length;
          const isExpanded = !!expandedGroups[col.key];
          const activeChildren = col.children?.filter((child) => child.checked).length ?? 0;

          return (
          <div key={col.key} className="rounded-xl border border-border/70 bg-background/70 p-2.5 space-y-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`col-${col.key}`}
                checked={col.checked}
                onCheckedChange={(checked) => onColumnOptionChange(col.key, !!checked)}
                className="mt-0.5"
              />
              <div className="min-w-0 flex-1">
                <label
                  htmlFor={`col-${col.key}`}
                  className="text-[11px] font-medium leading-none cursor-pointer"
                >
                  {col.label}
                </label>
                {col.description ? (
                  <p className="text-[9px] text-muted-foreground mt-0.5">{col.description}</p>
                ) : null}
              </div>
              {hasChildren ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1 px-2 text-[9px]"
                  onClick={() => setExpandedGroups((prev) => ({ ...prev, [col.key]: !isExpanded }))}
                >
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {isExpanded ? "Tutup" : "Detail"}
                </Button>
              ) : null}
            </div>

            {hasChildren ? (
              <div className="ml-6 rounded-lg border border-dashed border-border bg-muted/20 p-2 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-medium text-foreground">Nilai per tugas</p>
                    <p className="text-[9px] text-muted-foreground">{activeChildren}/{col.children?.length ?? 0} tugas aktif</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[9px]"
                      onClick={() => toggleChildren(col.children, true)}
                    >
                      Pilih Semua
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[9px]"
                      onClick={() => toggleChildren(col.children, false)}
                    >
                      Kosongkan
                    </Button>
                  </div>
                </div>
                {isExpanded ? (
                  <div className="space-y-1">
                    {col.children?.map((child) => (
                      <div key={child.key} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-background/60">
                        <Checkbox
                          id={`col-${child.key}`}
                          checked={child.checked}
                          onCheckedChange={(checked) => onColumnOptionChange(child.key, !!checked)}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <label htmlFor={`col-${child.key}`} className="cursor-pointer text-[10px] font-medium leading-none text-foreground">
                            {child.label}
                          </label>
                          {child.description ? (
                            <p className="mt-0.5 text-[9px] text-muted-foreground">{child.description}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg bg-background/70 px-2.5 py-2 text-[9px] text-muted-foreground">
                    Daftar tugas disembunyikan agar panel tetap ringkas. Tekan <span className="font-medium text-foreground">Detail</span> untuk membuka pengaturan per tugas.
                  </div>
                )}
              </div>
            ) : null}
          </div>
          );
        })}
      </div>
    </>
  );
}

function StylePanel({
  draft,
  setDraft,
  documentStyle,
  onDocumentStyleChange,
  autoFitOnePage,
  onAutoFitOnePageChange,
  showAutoFitPreset,
  includeSignature,
  supportsSignature,
  columnTypographyOptions,
  onOpenExperimentalWindow,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  documentStyle?: ReportDocumentStyle;
  onDocumentStyleChange?: Dispatch<SetStateAction<ReportDocumentStyle>>;
  autoFitOnePage?: boolean;
  onAutoFitOnePageChange?: (value: boolean) => void;
  showAutoFitPreset?: boolean;
  includeSignature: boolean;
  supportsSignature: boolean;
  columnTypographyOptions?: ExportColumnTypographyOption[];
  onOpenExperimentalWindow: () => void;
}) {
  const parseCustomNumber = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(Number(parsed.toFixed(2)), 1, 40);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-background/50 p-3">
        <p className="text-[11px] font-semibold text-foreground">Style Dokumen</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Kelompok ini mengatur preset, tipografi dokumen, dan tampilan blok tanda tangan agar lebih mudah dipahami seperti panel desain modern.</p>
      </div>

      {documentStyle && onDocumentStyleChange ? (
        <>
          <div className="space-y-2 rounded-lg border border-border p-2.5">
            <div>
              <Label className="text-[11px] font-semibold">Preset</Label>
              <p className="text-[9px] text-muted-foreground">Pilih titik awal yang paling nyaman, lalu sesuaikan lagi bila perlu.</p>
            </div>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8rem), 1fr))" }}
            >
              {([
                { label: "1 Halaman", title: 14, meta: 9, header: 10, body: 10, desc: "Utamakan 1 halaman tabel", autoFit: true },
                { label: "1 Kolom Penuh", title: 12, meta: 8, header: 8, body: 7, desc: "Titik awal agar semua kolom muat", autoFit: false },
                { label: "Kompak", title: 14, meta: 9, header: 9, body: 8, desc: "Ringkas", autoFit: false },
                { label: "Standar", title: 16, meta: 10, header: 12, body: 11, desc: "Seimbang", autoFit: false },
                { label: "Besar", title: 20, meta: 12, header: 14, body: 13, desc: "Paling mudah dibaca", autoFit: false },
              ] as const).map((preset) => (
                <Button
                  key={preset.label}
                  variant={
                    documentStyle.titleFontSize === preset.title &&
                    documentStyle.tableBodyFontSize === preset.body &&
                    (!!autoFitOnePage === preset.autoFit)
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  className="h-auto flex-col items-start py-1.5 text-[10px]"
                  onClick={() => {
                    onDocumentStyleChange((prev) => ({
                      ...prev,
                      titleFontSize: preset.title,
                      metaFontSize: preset.meta,
                      tableHeaderFontSize: preset.header,
                      tableBodyFontSize: preset.body,
                      layoutPreset:
                        preset.label === "1 Halaman"
                          ? "one-page"
                          : preset.label === "1 Kolom Penuh"
                            ? "single-column-full"
                            : preset.label === "Kompak"
                              ? "compact"
                              : preset.label === "Besar"
                                ? "large"
                                : "standard",
                    }));
                    onAutoFitOnePageChange?.(preset.autoFit);
                  }}
                >
                  <span className="font-medium">{preset.label}</span>
                  <span className="text-[8px] opacity-70">{preset.desc}</span>
                </Button>
              ))}
            </div>
          </div>

          {showAutoFitPreset ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Label className="text-[11px]">Optimalkan 1 halaman</Label>
                <p className="text-[9px] text-muted-foreground">Sistem akan berusaha menjaga tabel tetap padat tanpa mengorbankan keterbacaan terlalu jauh.</p>
              </div>
              <Switch checked={!!autoFitOnePage} onCheckedChange={(checked) => onAutoFitOnePageChange?.(checked)} />
            </div>
          ) : null}

          <div className="space-y-2 rounded-lg border border-border p-2.5">
            <div>
              <Label className="text-[11px] font-semibold">Tipografi</Label>
              <p className="text-[9px] text-muted-foreground">Ukuran judul, info dokumen, header tabel, dan isi tabel akan langsung tercermin pada preview.</p>
            </div>
            {([
              { key: "titleFontSize", label: "Judul dokumen" },
              { key: "metaFontSize", label: "Info dokumen" },
              { key: "tableHeaderFontSize", label: "Header tabel" },
              { key: "tableBodyFontSize", label: "Isi tabel" },
            ] as const).map((item) => (
              <div key={item.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-[11px]">{item.label} ({documentStyle[item.key].toFixed(2)}pt)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="1"
                    max="40"
                    value={documentStyle[item.key].toFixed(2)}
                    onChange={(event) => {
                      const nextValue = parseCustomNumber(event.target.value, documentStyle[item.key]);
                      onDocumentStyleChange((prev) => ({ ...prev, [item.key]: nextValue }));
                    }}
                    className="h-8 w-24 text-[11px]"
                  />
                </div>
                <SliderWithButtons
                  value={documentStyle[item.key]}
                  min={1}
                  max={40}
                  step={0.25}
                  buttonStep={1}
                  onValueChange={(value) => onDocumentStyleChange((prev) => ({ ...prev, [item.key]: Number(value.toFixed(2)) }))}
                />
              </div>
            ))}
            <p className="text-[9px] text-muted-foreground">Semua ukuran menerima input manual seperti di word processor, termasuk desimal hingga 2 angka di belakang koma.</p>
          </div>

          {columnTypographyOptions && columnTypographyOptions.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-border p-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Label className="text-[11px] font-semibold">Eksperimental: Font Per Kolom</Label>
                  <p className="text-[9px] text-muted-foreground">
                    Pengaturan detail dipindahkan ke jendela khusus agar panel utama tetap rapi dan preview tetap mudah diamati.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-[10px]"
                  onClick={onOpenExperimentalWindow}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Buka Studio Eksperimen
                </Button>
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Label className="text-[11px]">Aktifkan mode eksperimen</Label>
                  <p className="text-[9px] text-muted-foreground">
                    Saat aktif, font tiap kolom bisa disetel sendiri. Saat nonaktif, semua kolom kembali mengikuti tipografi global.
                  </p>
                </div>
                <Switch
                  checked={documentStyle.experimentalColumnTypographyEnabled}
                  onCheckedChange={(checked) => onDocumentStyleChange((prev) => ({ ...prev, experimentalColumnTypographyEnabled: checked }))}
                />
              </div>

              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))" }}
              >
                <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-[10px] text-muted-foreground">
                  {documentStyle.experimentalColumnTypographyEnabled
                    ? `Mode aktif untuk ${Object.keys(documentStyle.columnFontOverrides || {}).length || columnTypographyOptions.length} kolom.`
                    : "Mode belum aktif. Nyalakan mode lalu buka studio eksperimen untuk mengatur kolom satu per satu."}
                </div>
                <div className="rounded-lg border border-dashed border-border bg-background/50 p-3 text-[10px] text-muted-foreground">
                  Alternatif cerdas: kecilkan kolom tugas yang padat, besarkan kolom nama, lalu pantau perubahan langsung di live preview tanpa menutup studio.
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <Separator />

      <div className={cn("space-y-2 rounded-lg border border-border p-2.5 transition-opacity", supportsSignature && !includeSignature && "opacity-45")}>
        <div>
          <Label className="text-[11px] font-semibold">Style Tanda Tangan</Label>
          <p className="text-[9px] text-muted-foreground">
            {supportsSignature && !includeSignature
              ? "Aktifkan penanda tangan terlebih dahulu untuk mengubah style tanda tangan."
              : "Atur ukuran teks, garis tanda tangan, dan jarak antar penanda tangan."}
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[11px]">Ukuran font ({draft.fontSize.toFixed(2)}pt)</Label>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="1"
              max="40"
              value={draft.fontSize.toFixed(2)}
              onChange={(event) => setDraft((prev) => ({ ...prev, fontSize: parseCustomNumber(event.target.value, prev.fontSize) }))}
              className="h-8 w-24 text-[11px]"
              disabled={supportsSignature && !includeSignature}
            />
          </div>
          <SliderWithButtons value={draft.fontSize} min={1} max={40} step={0.25} buttonStep={1} disabled={supportsSignature && !includeSignature} onValueChange={(value) => setDraft((prev) => ({ ...prev, fontSize: Number(value.toFixed(2)) }))} />
        </div>
        <div className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label className="text-[11px]">Garis tanda tangan</Label>
            <p className="text-[9px] text-muted-foreground">Nonaktifkan bila ingin nama penanda tangan tampil tanpa garis.</p>
          </div>
          <Switch checked={draft.showSignatureLine} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showSignatureLine: checked }))} disabled={supportsSignature && !includeSignature} />
        </div>
        {draft.showSignatureLine ? (
          <div className="space-y-1.5">
            <Label className="text-[11px]">Lebar garis ({draft.signatureLineWidth}mm)</Label>
            <SliderWithButtons value={draft.signatureLineWidth} min={20} max={100} step={5} disabled={supportsSignature && !includeSignature} onValueChange={(value) => setDraft((prev) => ({ ...prev, signatureLineWidth: value }))} />
          </div>
        ) : null}
        {draft.signers.length > 1 ? (
          <div className="space-y-1.5">
            <Label className="text-[11px]">Jarak antar penanda tangan ({draft.signatureSpacing}mm)</Label>
            <SliderWithButtons value={draft.signatureSpacing} min={5} max={80} step={5} disabled={supportsSignature && !includeSignature} onValueChange={(value) => setDraft((prev) => ({ ...prev, signatureSpacing: value }))} />
          </div>
        ) : null}
      </div>
    </>
  );
}

export function ExportStudioDialog({
  title = "Pusat Ekspor Dokumen",
  description = "Pilih format, atur tanda tangan, dan lihat preview sebelum file diekspor.",
  triggerLabel = "Ekspor",
  triggerIcon: TriggerIcon = Download,
  triggerClassName,
  triggerDisabled,
  formats,
  selectedFormat,
  onFormatChange,
  onExport,
  includeSignature,
  onIncludeSignatureChange,
  signatureConfig,
  hasSignature,
  isLoading,
  isSaving,
  onSaveSignature,
  paperSize = "a4",
  onPaperSizeChange,
  documentStyle,
  onDocumentStyleChange,
  autoFitOnePage,
  onAutoFitOnePageChange,
  showAutoFitPreset = false,
  supportsSignature = true,
  columnOptions,
  onColumnOptionChange,
  columnCount,
  columnTypographyOptions,
  renderPreview,
  noPreviewMessage = "Preview untuk format spreadsheet belum ditampilkan di studio ini. Data aktif dan filter tetap dipakai saat ekspor.",
  formatPanelExtra,
  previewFooter,
}: ExportStudioDialogProps) {
  const { success, error: showError } = useEnhancedToast();
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"format" | "columns" | "signers" | "style" | "position">("format");
  const [previewZoom, setPreviewZoom] = useState(100);
  const [draft, setDraft] = useState<SignatureSettingsConfig>(createDefaultSignatureConfig());
  const [experimentalWindowOpen, setExperimentalWindowOpen] = useState(false);
  const [layoutWidth, setLayoutWidth] = useState<number>(typeof window === "undefined" ? 1280 : window.innerWidth);
  const [liveEditMode, setLiveEditMode] = useState(false);
  const [highlightTarget, setHighlightTarget] = useState<ExportPreviewHighlightTarget | null>(null);
  const layoutViewportRef = useRef<HTMLDivElement>(null);
  const previewCaptureRef = useRef<HTMLDivElement>(null);
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const panelScrollMemoryRef = useRef<Record<string, number>>({});
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    const node = layoutViewportRef.current;
    const updateWidth = () => {
      const nextWidth = node?.clientWidth || window.innerWidth;
      setLayoutWidth(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined" || !node) {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [open]);

  const isMobileLayout = layoutWidth < 1024;
  const isCompactLayout = layoutWidth < 880;
  const isNarrowLayout = layoutWidth < 640;

  useEffect(() => {
    if (!open && signatureConfig) {
      setDraft({ ...createDefaultSignatureConfig(), ...signatureConfig });
    }
  }, [open, signatureConfig]);

  useEffect(() => {
    if (open && !hasOpenedRef.current) {
      setDraft(signatureConfig ? { ...createDefaultSignatureConfig(), ...signatureConfig } : createDefaultSignatureConfig());
      setActivePanel("format");
      setLiveEditMode(false);
      setHighlightTarget(null);
      hasOpenedRef.current = true;
    }

    if (!open) {
      hasOpenedRef.current = false;
      setExperimentalWindowOpen(false);
    }
  }, [open, signatureConfig]);

  useEffect(() => {
    if (!supportsSignature) return;
    if (!includeSignature && (activePanel === "signers" || activePanel === "position")) {
      setActivePanel("format");
    }
  }, [activePanel, includeSignature, supportsSignature]);

  useEffect(() => {
    if (liveEditMode && highlightTarget?.kind === "column" && columnTypographyOptions?.length) {
      setExperimentalWindowOpen(true);
      setActivePanel("style");
    }
  }, [columnTypographyOptions?.length, highlightTarget, liveEditMode]);

  useEffect(() => {
    if (!open) return;
    setPreviewZoom((prev) => {
      if (layoutWidth < 480) return Math.min(prev, 65);
      if (layoutWidth < 640) return Math.min(prev, 75);
      if (layoutWidth < 880) return Math.min(prev, 85);
      return prev;
    });
  }, [layoutWidth, open]);

  useEffect(() => {
    if (!open || !panelScrollRef.current) return;
    requestAnimationFrame(() => {
      panelScrollRef.current?.scrollTo({ top: panelScrollMemoryRef.current[activePanel] ?? 0 });
    });
  }, [activePanel, open]);

  const switchPanel = useCallback((nextPanel: typeof activePanel) => {
    panelScrollMemoryRef.current[activePanel] = panelScrollRef.current?.scrollTop ?? 0;
    setActivePanel(nextPanel);
  }, [activePanel]);

  const activeFormat = useMemo(
    () => formats.find((formatOption) => formatOption.id === selectedFormat) ?? formats[0],
    [formats, selectedFormat],
  );

  const previewFormat = activeFormat?.previewMode === "png" ? "png" : "pdf";
  const canPreview = !!activeFormat?.previewMode;
  const currentPaperSize = paperSize;
  const recommendedPaperSize = useMemo(
    () => getRecommendedPaperSize(activeFormat?.id ?? ""),
    [activeFormat?.id],
  );
  const recommendedPaperOption = useMemo(
    () => PAPER_SIZE_OPTIONS.find((option) => option.id === recommendedPaperSize) ?? null,
    [recommendedPaperSize],
  );
  const recommendedPaperCopy = useMemo(
    () => getRecommendedPaperCopy(activeFormat?.id ?? ""),
    [activeFormat?.id],
  );
  const previewDate = draft.useCustomDate && draft.customDate
    ? formatSignatureDisplayDate(draft.customDate)
    : formatSignatureDisplayDate();

  const saveCurrentSignature = useCallback(async () => {
    if (!supportsSignature) return;
    if (!hasValidSignatureConfig(draft)) {
      throw new Error("Isi kota dan minimal 1 nama penanda tangan.");
    }
    await onSaveSignature(draft);
  }, [draft, onSaveSignature, supportsSignature]);

  const downloadPreviewPng = useCallback(async (quality: "hd" | "4k", fileName = `export-${quality}.png`) => {
    if (!previewCaptureRef.current) {
      throw new Error("Preview belum siap untuk diubah menjadi PNG.");
    }
    await exportElementToPng(previewCaptureRef.current, quality, fileName);
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await saveCurrentSignature();
      success("Pengaturan tanda tangan disimpan");
    } catch (error: any) {
      showError("Gagal menyimpan", error?.message || "Terjadi kesalahan saat menyimpan tanda tangan.");
    }
  }, [saveCurrentSignature, showError, success]);

  const handleExport = useCallback(async () => {
    try {
      if (supportsSignature && includeSignature) {
        await saveCurrentSignature();
      }
      await onExport({
        formatId: selectedFormat,
        includeSignature: supportsSignature ? includeSignature : false,
        signatureConfig: draft,
        paperSize: currentPaperSize,
        documentStyle,
        autoFitOnePage,
        downloadPreviewPng,
      });
      setOpen(false);
    } catch (error: any) {
      showError("Ekspor gagal", error?.message || "Terjadi kesalahan saat mengekspor file.");
    }
  }, [autoFitOnePage, currentPaperSize, documentStyle, downloadPreviewPng, draft, includeSignature, onExport, saveCurrentSignature, selectedFormat, showError, supportsSignature]);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className={cn("gap-1.5", triggerClassName)} disabled={triggerDisabled}>
        <TriggerIcon className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-0.5rem)] sm:w-[calc(100vw-0.75rem)] max-w-[96rem] h-[calc(100dvh-0.5rem)] sm:h-[min(94dvh,58rem)] overflow-hidden rounded-[22px] sm:rounded-[28px] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Download className="h-4 w-4 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div
            ref={layoutViewportRef}
            className={cn(
            "relative flex-1 min-h-0",
            isMobileLayout ? "flex flex-col overflow-hidden" : "flex flex-col lg:grid lg:grid-cols-[minmax(320px,360px)_minmax(0,1fr)]",
          )}
          >
            <ExperimentalTypographyWindow
              open={experimentalWindowOpen}
              onOpenChange={setExperimentalWindowOpen}
              documentStyle={documentStyle}
              onDocumentStyleChange={onDocumentStyleChange}
              columnTypographyOptions={columnTypographyOptions}
              isMobile={isMobileLayout}
              highlightTarget={highlightTarget}
              onHighlightTargetChange={setHighlightTarget}
            />

            <div className={cn(
              "border-border bg-muted/20 min-h-0 flex flex-col",
              isMobileLayout ? "order-2 border-t flex-1 overflow-hidden" : "order-2 border-t lg:order-1 lg:border-t-0 lg:border-r",
            )}>
              <div className={cn("px-3 sm:px-4 border-b border-border/70", isMobileLayout ? "pt-2.5 pb-2.5 space-y-2" : "pt-3 sm:pt-4 pb-3 space-y-3")}>
                <div className={cn("rounded-xl border border-border bg-background", isMobileLayout ? "p-2.5" : "p-3")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">Tujuan ekspor</p>
                      <p className="text-[10px] text-muted-foreground">
                        Pilih format hasil akhir, lalu sesuaikan style dan penanda tangan dalam satu studio.
                      </p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-64 text-[11px]">
                        Preview PDF dan PNG memakai sumber state yang sama dengan proses ekspor. Excel dan CSV belum memakai preview visual.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {supportsSignature ? (
                  <div className={cn("flex items-center justify-between rounded-xl border border-border bg-background", isMobileLayout ? "p-2.5" : "p-3")}>
                    <div>
                      <Label className="text-xs font-semibold text-foreground">Penanda tangan</Label>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Aktifkan bila file ekspor perlu blok tanda tangan otomatis.
                      </p>
                    </div>
                    <Switch checked={includeSignature} onCheckedChange={onIncludeSignatureChange} />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-foreground">Alat studio</p>
                    <p className="text-[10px] text-muted-foreground">Buka panel yang ingin Anda atur.</p>
                  </div>
                  <div className={cn("-mx-1 px-1 pb-1", isMobileLayout ? "overflow-hidden" : "overflow-x-auto")}>
                    <div
                      className={cn(
                        isMobileLayout ? "grid gap-2" : "grid min-w-max auto-cols-max grid-flow-col gap-2 lg:flex lg:min-w-0 lg:flex-wrap",
                      )}
                      style={isMobileLayout ? { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 8.5rem), 1fr))" } : undefined}
                    >
                      {([
                        { key: "format", label: "Format", icon: Download, enabled: true },
                        ...(columnOptions ? [{ key: "columns" as const, label: "Kolom", icon: Columns3, enabled: true }] : []),
                        { key: "signers", label: "Penanda", icon: PenTool, enabled: supportsSignature && includeSignature },
                        { key: "style", label: "Style", icon: Sparkles, enabled: true },
                        { key: "position", label: "Posisi", icon: Move, enabled: supportsSignature && includeSignature },
                      ] as const).map(({ key, label, icon: Icon, enabled }) => (
                        <Button
                          key={key}
                          type="button"
                          variant={activePanel === key ? "default" : "outline"}
                          size="sm"
                          className={cn(
                            "h-9 min-w-fit shrink-0 rounded-full px-3 justify-start gap-1.5 text-[10px] sm:text-xs",
                            isMobileLayout && "w-full min-w-0 px-3 justify-center",
                            !enabled && "opacity-50",
                          )}
                          onClick={() => enabled && switchPanel(key as typeof activePanel)}
                          disabled={!enabled}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div ref={panelScrollRef} className={cn("flex-1 overflow-y-auto px-3 sm:px-4 space-y-3", isMobileLayout ? "py-3 pb-24" : "py-3 sm:py-4")}>
                {activePanel === "format" ? (
                  <>
                    <div className="rounded-xl border border-border bg-background/80 p-3">
                      <p className="text-[11px] font-semibold text-foreground">Format ekspor</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Semua format memakai data aktif saat ini. PDF dan PNG menampilkan preview langsung di sisi kanan.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      {formats.map((formatOption) => {
                        const Icon = formatOption.icon;
                        const active = selectedFormat === formatOption.id;
                        return (
                          <button
                            key={formatOption.id}
                            type="button"
                            className={cn(
                              "rounded-xl border p-3 text-left transition-all",
                              active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40",
                            )}
                            onClick={() => onFormatChange(formatOption.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0">
                                <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", getFormatToneClasses(formatOption.id))}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-semibold text-foreground">{formatOption.label}</p>
                                    {formatOption.badge ? (
                                      <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold", getFormatToneClasses(formatOption.id))}>
                                        {formatOption.badge}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                                    {formatOption.description}
                                  </p>
                                </div>
                              </div>
                              <div className={cn("mt-0.5 rounded-full border px-2 py-1 text-[9px] font-semibold", active ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground")}>
                                {formatOption.previewMode ? "Preview" : "Tanpa preview"}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-border bg-background/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">Ukuran kertas</p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Berlaku untuk preview dan hasil ekspor PDF/PNG. Auto memakai basis A4 yang menyesuaikan layout, sedangkan Full Page membuat ukuran halaman mengikuti isi dokumen.
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            {recommendedPaperOption ? (
                              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-semibold text-primary">
                                Rekomendasi: {recommendedPaperOption.label}
                              </span>
                            ) : null}
                            <span className="text-[10px] text-muted-foreground">
                              {recommendedPaperCopy}
                            </span>
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-64 text-[11px]">
                            A4 cocok untuk dokumen umum, F4 memakai ukuran 8,5 x 13 in, Auto menjaga basis A4, dan Full Page membiarkan ukuran halaman mengikuti konten.
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <div
                        className="mt-3 grid gap-2"
                        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10.75rem), 1fr))" }}
                      >
                        {PAPER_SIZE_OPTIONS.map((option) => {
                          const active = currentPaperSize === option.id;
                          const recommended = recommendedPaperSize === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => onPaperSizeChange?.(option.id)}
                              className={cn(
                                "min-w-0 rounded-xl border p-3 text-left transition-all",
                                active
                                  ? "border-primary bg-primary/5 shadow-sm"
                                  : recommended
                                    ? "border-primary/30 bg-primary/[0.03] hover:border-primary/50"
                                    : "border-border bg-background hover:border-primary/40",
                              )}
                            >
                              <div className="flex flex-col items-start gap-2">
                                <p className="text-xs font-semibold leading-tight text-foreground">{option.label}</p>
                                {recommended || active ? (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {recommended ? (
                                      <span className={cn(
                                        "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[8px] font-semibold sm:text-[9px]",
                                        active
                                          ? "border-primary/35 bg-primary/[0.12] text-primary"
                                          : "border-primary/25 bg-primary/[0.08] text-primary",
                                      )}>
                                        Rekomendasi
                                      </span>
                                    ) : null}
                                    {active ? (
                                      <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[8px] font-semibold text-primary sm:text-[9px]">
                                        Aktif
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{option.description}</p>
                              {recommended ? (
                                <p className="mt-2 text-[10px] font-medium text-primary/90">
                                  {activeFormat?.id === "pdf"
                                    ? "Paling disarankan untuk ekspor PDF."
                                    : "Paling disarankan untuk ekspor PNG."}
                                </p>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-border bg-background/60 p-3">
                      <p className="text-[11px] font-semibold text-foreground">Hint studio</p>
                      <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
                        <div>PDF cocok untuk cetak dan dokumen resmi.</div>
                        <div>PNG HD cocok untuk dibagikan cepat, sedangkan PNG 4K cocok untuk kualitas tinggi.</div>
                        <div>Excel dan CSV tetap tersedia, namun preview visualnya belum dipakai agar struktur tabel spreadsheet bisa didesain ulang nanti.</div>
                      </div>
                    </div>

                    {formatPanelExtra ? formatPanelExtra : null}
                  </>
                ) : null}

                {activePanel === "columns" && columnOptions && onColumnOptionChange ? (
                  <ColumnPanel columnOptions={columnOptions} onColumnOptionChange={onColumnOptionChange} />
                ) : null}

                {activePanel === "signers" ? (
                  supportsSignature && includeSignature ? (
                    <SignerPanel draft={draft} setDraft={setDraft} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-center text-[11px] text-muted-foreground">
                      Aktifkan penanda tangan terlebih dahulu agar panel ini bisa dipakai.
                    </div>
                  )
                ) : null}

                {activePanel === "style" ? (
                  <StylePanel
                    draft={draft}
                    setDraft={setDraft}
                    documentStyle={documentStyle}
                    onDocumentStyleChange={onDocumentStyleChange}
                    autoFitOnePage={autoFitOnePage}
                    onAutoFitOnePageChange={onAutoFitOnePageChange}
                    showAutoFitPreset={showAutoFitPreset}
                    includeSignature={includeSignature}
                    supportsSignature={supportsSignature}
                    columnTypographyOptions={columnTypographyOptions}
                    onOpenExperimentalWindow={() => setExperimentalWindowOpen(true)}
                  />
                ) : null}

                {activePanel === "position" ? (
                  supportsSignature && includeSignature ? (
                    <PositionPanel draft={draft} setDraft={setDraft} />
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-center text-[11px] text-muted-foreground">
                      Posisi hanya bisa diatur saat penanda tangan aktif.
                    </div>
                  )
                ) : null}
              </div>
            </div>

            <div className={cn(
              "flex flex-col bg-background min-h-0",
              isMobileLayout ? "order-1 border-b shrink-0" : "order-1 min-h-[18rem] lg:order-2",
            )}>
              <div className={cn(
                "flex flex-col gap-3 border-b border-border px-3 sm:px-4",
                isMobileLayout ? "py-2.5" : "py-3 xl:flex-row xl:items-center xl:justify-between",
              )}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Eye className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">Live Preview</p>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold", getFormatToneClasses(activeFormat?.id || "pdf"))}>
                      {activeFormat?.label || "Format"}
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Preview di bawah ini selalu mengikuti state aktif. Gunakan zoom untuk memeriksa detail sebelum ekspor.
                  </p>
                </div>

                <div className={cn(
                  "flex w-full gap-2",
                  isCompactLayout ? "flex-col" : "flex-wrap items-center sm:w-auto sm:justify-end",
                )}>
                  {canPreview ? (
                    <Button
                      type="button"
                      variant={liveEditMode ? "default" : "outline"}
                      size="sm"
                      className={cn("h-8 rounded-full px-3 text-[10px]", isCompactLayout ? "w-full" : "order-3 sm:order-1")}
                      onClick={() => setLiveEditMode((prev) => !prev)}
                    >
                      {liveEditMode ? "Edit Langsung Aktif" : "Edit di Preview"}
                    </Button>
                  ) : null}
                  {highlightTarget ? (
                    <div className={cn(
                      "rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary",
                      isCompactLayout ? "w-full text-center" : "order-3 sm:order-1",
                    )}>
                      {highlightTarget.label || (highlightTarget.kind === "column" ? highlightTarget.key : highlightTarget.kind)}
                    </div>
                  ) : null}
                  {!isNarrowLayout ? (
                    <div className={cn(
                      "rounded-full border border-border bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground",
                      isCompactLayout ? "w-full text-center" : "order-2 sm:order-1",
                    )}>
                      Zoom tetap stabil saat panel diubah
                    </div>
                  ) : null}
                  <div className={cn(
                    "flex items-center gap-1 rounded-full border border-border bg-background p-1",
                    isCompactLayout ? "w-full justify-between" : "order-1 sm:order-2",
                  )}>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom((prev) => clamp(prev - 10, 25, 200))}>
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                    <div className={cn(
                      "flex h-8 items-center justify-center rounded-full border border-border px-2 text-[11px] font-medium text-foreground",
                      isCompactLayout ? "flex-1 min-w-0" : "min-w-16",
                    )}>
                      {previewZoom}%
                    </div>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom(100)}>
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom((prev) => clamp(prev + 10, 25, 200))}>
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className={cn(
                "flex-1 overflow-auto bg-muted/30",
                isMobileLayout ? "max-h-[min(46dvh,28rem)] px-2 py-2" : "px-2 sm:px-4 py-2 sm:py-4",
              )}>
                {canPreview ? (
                  <div className="flex min-h-full flex-col items-center gap-3">
                    <div className="flex w-full items-start justify-center">
                      <div
                        ref={previewCaptureRef}
                        className="origin-top"
                        style={{
                          transform: `scale(${previewZoom / 100})`,
                          transformOrigin: "top center",
                          width: "fit-content",
                        }}
                      >
                        {renderPreview ? renderPreview({
                          previewFormat,
                          draft,
                          setDraft,
                          previewDate,
                          includeSignature: supportsSignature ? includeSignature : false,
                          paperSize: currentPaperSize,
                          documentStyle,
                          autoFitOnePage,
                          liveEditMode,
                          highlightTarget,
                          onHighlightTargetChange: setHighlightTarget,
                        }) : (
                          <GenericSignaturePreview
                            draft={draft}
                            setDraft={setDraft}
                            previewDate={previewDate}
                            includeSignature={supportsSignature ? includeSignature : false}
                          />
                        )}
                      </div>
                    </div>
                    {previewFooter ? <div className="w-full max-w-5xl">{previewFooter}</div> : null}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[420px] items-center justify-center">
                    <div className="max-w-md rounded-2xl border border-dashed border-border bg-background p-6 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/50">
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-foreground">Preview belum ditampilkan</p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{noPreviewMessage}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className={cn("border-t border-border px-3 sm:px-4 py-3", isMobileLayout && "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85")}>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[10px] text-muted-foreground">
              {supportsSignature && includeSignature
                ? "Simpan pengaturan bila ingin menjadikannya default untuk ekspor berikutnya."
                : "Anda tetap bisa mengekspor tanpa penanda tangan."}
            </div>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-9 text-xs w-full sm:w-auto">
                Tutup
              </Button>
              {supportsSignature ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving || isLoading || !includeSignature}
                  className="h-9 gap-1.5 text-xs w-full sm:w-auto"
                >
                  <Save className="h-3.5 w-3.5" />
                  Simpan Tanda Tangan
                </Button>
              ) : null}
              <Button type="button" onClick={handleExport} disabled={!activeFormat || isLoading || isSaving} className="h-9 gap-1.5 text-xs w-full sm:w-auto">
                <Download className="h-3.5 w-3.5" />
                Ekspor {activeFormat?.label || ""}
              </Button>
            </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
