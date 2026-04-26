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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { SliderWithButtons } from "@/components/ui/slider-with-buttons";
import { cn } from "@/lib/utils";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { exportElementToPng } from "@/lib/exportEngine/pngEngine";
import { PX_PER_MM } from "@/lib/exportEngine/sharedMetrics";
import { resolveFixedSignaturePositionState } from "@/lib/attendancePdfPreview";
import { useStudioViewportProfile } from "@/hooks/useStudioViewportProfile";
import {
  StudioActionFooter,
  StudioPreviewToggle,
  StudioSectionTabs,
  StudioStepHeader,
  type StudioSectionDescriptor,
} from "@/components/studio/ResponsiveStudio";
import {
  type SignatureSettingsConfig,
  type SignatureLinePosition,
  type SignatureSigner,
  createDefaultSignatureConfig,
  createEmptySignatureSigner,
  formatSignatureDisplayDate,
  hasValidSignatureConfig,
} from "@/hooks/useSignatureSettings";
import { createDefaultReportDocumentStyle, type ReportDocumentStyle, type SignaturePlacement } from "@/lib/reportExportLayoutV2";
import type { ReportPaperSize } from "@/lib/reportExportLayout";
import type { ExportPreviewHighlightTarget } from "@/components/export/SignaturePreviewCanvas";
import { isCoarsePointerDevice } from "@/lib/inputModality";
import {
  getSignatureLineSpacing,
  resolveSignatureLinePositionLike,
  resolveSignatureLineWidthMm,
  resolveSignatureSignerBlockWidthMm,
} from "@/lib/signatureLayout";

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
  groupMeta?: {
    detailTitle?: string;
    activeSummaryLabel?: string;
    collapsedHint?: string;
  };
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
    onHighlightTargetHoverChange?: (target: ExportPreviewHighlightTarget | null) => void;
    onHighlightTargetSelect?: (target: ExportPreviewHighlightTarget | null) => void;
    onSignaturePlacementChange?: (placement: SignaturePlacement | null) => void;
  }) => ReactNode;
  noPreviewMessage?: string;
  formatPanelExtra?: ReactNode;
  stylePanelExtra?: ReactNode;
  previewFooter?: ReactNode;
  onRestoreDefaultMode?: () => void;
  defaultModeLabel?: string;
  defaultModeDescription?: string;
  stylePresetMode?: "generic" | "attendance";
  stylePresetBaseline?: {
    documentStyle: ReportDocumentStyle;
    autoFitOnePage?: boolean;
  };
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

const MOBILE_OVERLAY_DEFAULT_FRAME = {
  left: 12,
  top: 120,
  width: 312,
  height: 252,
};

const EXPERIMENTAL_WINDOW_DEFAULT_RECT = {
  x: 32,
  y: 32,
  width: 460,
  height: 560,
};
const DESKTOP_STUDIO_PANEL_MIN_WIDTH = 380;
const DESKTOP_STUDIO_PANEL_MAX_WIDTH = 640;
const DESKTOP_STUDIO_PREVIEW_MIN_WIDTH = 440;
const STUDIO_TOP_TRAY_AUTO_COLLAPSE_DELAY_MS = 3000;

type MobileOverlayFrame = typeof MOBILE_OVERLAY_DEFAULT_FRAME;

function getDefaultSignaturePositionState() {
  return {
    signatureAlignment: "right" as const,
    signaturePreset: "bottom-right" as const,
    signatureOffsetX: 0,
    signatureOffsetY: 0,
    manualXPercent: null,
    manualYPercent: null,
    snapToGrid: true,
    gridSizeMm: 5,
    lockSignaturePosition: false,
    showDebugGuides: false,
  };
}

function createDefaultModeSignatureDraft(source?: SignatureSettingsConfig | null) {
  const base = createDefaultSignatureConfig();
  const preservedSigners = source?.signers?.length
    ? source.signers.map((signer) => ({
        ...createEmptySignatureSigner(),
        ...signer,
      }))
    : base.signers;

  return {
    ...base,
    city: source?.city ?? base.city,
    signers: preservedSigners,
  } satisfies SignatureSettingsConfig;
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
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Info className="h-3.5 w-3.5" />
          <span className="sr-only">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={8} className="max-w-72 p-3 text-[11px] leading-relaxed">
        {description}
      </PopoverContent>
    </Popover>
  );
}

function getSignatureLinePosition(draft: SignatureSettingsConfig): SignatureLinePosition {
  return resolveSignatureLinePositionLike(draft.signatureLinePosition);
}

function getSignatureLineWidth(draft: SignatureSettingsConfig, signer: SignatureSigner) {
  return resolveSignatureLineWidthMm({
    lineLengthMode: draft.signatureLineLengthMode,
    fixedWidthMm: draft.signatureLineWidth,
    name: signer.name,
    nip: signer.nip,
    fontSizePt: draft.fontSize,
  });
}

function getSignatureSignerBlockWidth(draft: SignatureSettingsConfig, signer: SignatureSigner) {
  return resolveSignatureSignerBlockWidthMm({
    lineLengthMode: draft.signatureLineLengthMode,
    fixedWidthMm: draft.signatureLineWidth,
    name: signer.name,
    nip: signer.nip,
    fontSizePt: draft.fontSize,
  });
}

function getColumnLeafOptions(columnOptions: ExportColumnOption[]) {
  return columnOptions.flatMap((option) => option.children?.length ? option.children : [option]);
}

function StudioSubsection({
  title,
  description,
  tone = "slate",
  badge,
  action,
  children,
}: {
  title: string;
  description?: string;
  tone?: "slate" | "sky" | "emerald" | "amber" | "rose" | "indigo";
  badge?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const toneClasses = {
    slate: "border-slate-200/80 bg-slate-50/70",
    sky: "border-sky-200/80 bg-sky-50/70",
    emerald: "border-emerald-200/80 bg-emerald-50/70",
    amber: "border-amber-200/80 bg-amber-50/70",
    rose: "border-rose-200/80 bg-rose-50/70",
    indigo: "border-indigo-200/80 bg-indigo-50/70",
  } as const;

  const badgeClasses = {
    slate: "border-slate-200/80 bg-white/90 text-slate-700",
    sky: "border-sky-200/80 bg-white/90 text-sky-700",
    emerald: "border-emerald-200/80 bg-white/90 text-emerald-700",
    amber: "border-amber-200/80 bg-white/90 text-amber-700",
    rose: "border-rose-200/80 bg-white/90 text-rose-700",
    indigo: "border-indigo-200/80 bg-white/90 text-indigo-700",
  } as const;

  return (
    <section className={cn("rounded-2xl border p-3 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.7)]", toneClasses[tone])}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold text-foreground">{title}</p>
            {badge ? (
              <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold", badgeClasses[tone])}>
                {badge}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
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
  highlightTarget?: ExportPreviewHighlightTarget | null;
  onHighlightTargetHoverChange?: (target: ExportPreviewHighlightTarget | null) => void;
  onHighlightTargetSelect?: (target: ExportPreviewHighlightTarget | null) => void;
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
        <div>Gunakan tab Format untuk memilih PDF, PNG HD, atau PNG 4K. Tab Style mengatur tipografi, sedangkan Style Signature mengatur visual dan peletakan signature secara dinamis.</div>
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
            Preview Signature
          </div>
          <div style={{ textAlign: "right", color: PREVIEW_COLORS.ink, fontSize: draft.fontSize + 1, marginBottom: 8 }}>
            {draft.city || "[Kota]"}, {previewDate}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: Math.max(12, draft.signatureSpacing), flexWrap: "wrap" }}>
            {signers.map((signer, index) => {
              const lineSpacing = getSignatureLineSpacing(getSignatureLinePosition(draft));
              const betweenNameAndNipPx = Math.max(1, Math.round(lineSpacing.nameToNipGapMm * 3.35));
              const aboveNameLinePx = Math.max(2, Math.round(lineSpacing.aboveNameLineGapMm * 3.78));
              const signerLineWidthPx = Math.max(22, Math.round(getSignatureLineWidth(draft, signer) * 3.78));
              const signerBlockWidthPx = Math.max(96, Math.round(getSignatureSignerBlockWidth(draft, signer) * 3.78));

              return (
                <div key={signer.id || `${signer.name}-${index}`} style={{ width: signerBlockWidthPx, textAlign: "center", color: PREVIEW_COLORS.ink, fontSize: draft.fontSize }}>
                  <div style={{ lineHeight: 1.3 }}>{signer.title || "Guru Mata Pelajaran"}</div>
                  {index === 0 && signer.school_name ? (
                    <div style={{ fontSize: Math.max(9, draft.fontSize - 1), color: PREVIEW_COLORS.muted, marginTop: 2 }}>{signer.school_name}</div>
                  ) : null}
                  <div style={{ height: 54 }} />
                  {draft.showSignatureLine && getSignatureLinePosition(draft) === "above-name" ? (
                    <div style={{ width: signerLineWidthPx, borderBottom: `1px solid ${PREVIEW_COLORS.ink}`, margin: `0 auto ${aboveNameLinePx}px` }} />
                  ) : null}
                  <div style={{ fontWeight: 700, lineHeight: 1.05 }}>{signer.name || "[Nama Signer]"}</div>
                  {draft.showSignatureLine && getSignatureLinePosition(draft) === "between-name-and-nip" && signer.nip ? (
                    <div style={{ position: "relative", width: signerLineWidthPx, height: Math.max(6, Math.round((lineSpacing.nameToLineGapMm + lineSpacing.lineToNipGapMm) * 3.78)), margin: "0 auto" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: Math.max(2, Math.round(lineSpacing.nameToLineGapMm * 3.78)),
                          borderBottom: `1px solid ${PREVIEW_COLORS.ink}`,
                        }}
                      />
                    </div>
                  ) : null}
                  {draft.showSignatureLine && getSignatureLinePosition(draft) === "between-name-and-nip" && !signer.nip ? (
                    <div
                      style={{
                        width: signerLineWidthPx,
                        borderBottom: `1px solid ${PREVIEW_COLORS.ink}`,
                        margin: `${aboveNameLinePx}px auto 0`,
                      }}
                    />
                  ) : null}
                  {signer.nip ? (
                    <div
                      style={{
                        fontSize: Math.max(9, draft.fontSize - 1),
                        color: PREVIEW_COLORS.muted,
                        lineHeight: 1.05,
                        marginTop: draft.showSignatureLine && getSignatureLinePosition(draft) === "between-name-and-nip"
                          ? 0
                          : betweenNameAndNipPx,
                      }}
                    >
                      NIP. {signer.nip}
                    </div>
                  ) : null}
                </div>
              );
            })}
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
          Safe zone signature
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
  includeSignature,
  onOpenSignatureStyle,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  includeSignature: boolean;
  onOpenSignatureStyle: () => void;
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
      <StudioSubsection
        title="Tanggal & Lokasi"
        description="Tab Signature dipakai untuk identitas signature. Pengaturan visual, garis, dan posisi dipindahkan ke Style Signature."
        tone="amber"
        badge={includeSignature ? "Dipakai saat ekspor" : "Disiapkan"}
        action={(
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-[10px]" onClick={onOpenSignatureStyle} title="Buka panel Style Signature agar garis, alignment, font, dan posisi signature bisa diatur dari satu tempat.">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Buka Style Signature
          </Button>
        )}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">Kota <span className="text-destructive">*</span></Label>
          <Input
            value={draft.city}
            onChange={(event) => setDraft((prev) => ({ ...prev, city: event.target.value }))}
            placeholder="Banjarmasin"
            className="h-8 text-xs"
          />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-amber-200/70 bg-white/75 p-3 sm:flex-row sm:items-center sm:justify-between">
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
      </StudioSubsection>

      <StudioSubsection
        title="Identitas Signature"
        description="Isi identitas signer yang akan dipakai di blok signature. Anda bisa menambah sampai 4 signer."
        tone="indigo"
        badge={`${signerCount} aktif`}
        action={(
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-[10px]" onClick={addSigner} disabled={draft.signers.length >= 4} title="Tambah satu identitas signature baru. Maksimal 4 signer.">
            <Plus className="mr-1 h-3 w-3" />
            Tambah
          </Button>
        )}
      >
        <div className="space-y-2">
          {draft.signers.map((signer, index) => (
            <div key={signer.id} className="rounded-xl border border-indigo-200/70 bg-white/80 p-3 space-y-2 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                  <GripVertical className="h-3 w-3" />
                  Signature #{index + 1}
                </p>
                <div className="flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSigner(index, "up")} disabled={index === 0} title={`Geser Signature #${index + 1} ke atas.`}>
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveSigner(index, "down")} disabled={index === draft.signers.length - 1} title={`Geser Signature #${index + 1} ke bawah.`}>
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeSigner(index)} disabled={draft.signers.length <= 1} title={`Hapus Signature #${index + 1} dari daftar identitas.`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={signer.title} onChange={(event) => setSigner(index, "title", event.target.value)} placeholder="Jabatan" className="h-8 text-[11px]" />
                <Input value={signer.name} onChange={(event) => setSigner(index, "name", event.target.value)} placeholder="Nama lengkap" className="h-8 text-[11px]" />
                <Input value={signer.nip} onChange={(event) => setSigner(index, "nip", event.target.value)} placeholder="NIP (opsional)" className="h-8 text-[11px]" />
                {index === 0 ? (
                  <Input value={signer.school_name} onChange={(event) => setSigner(index, "school_name", event.target.value)} placeholder="Nama sekolah (opsional)" className="h-8 text-[11px]" />
                ) : (
                  <div className="hidden sm:block" />
                )}
              </div>
            </div>
          ))}
        </div>
      </StudioSubsection>
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
  selectedHighlightTarget,
  onHighlightTargetHoverChange,
  onHighlightTargetSelect,
  layoutResetToken = 0,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  documentStyle?: ReportDocumentStyle;
  onDocumentStyleChange?: Dispatch<SetStateAction<ReportDocumentStyle>>;
  columnTypographyOptions?: ExportColumnTypographyOption[];
  isMobile: boolean;
  highlightTarget?: ExportPreviewHighlightTarget | null;
  selectedHighlightTarget?: ExportPreviewHighlightTarget | null;
  onHighlightTargetHoverChange?: (target: ExportPreviewHighlightTarget | null) => void;
  onHighlightTargetSelect?: (target: ExportPreviewHighlightTarget | null) => void;
  layoutResetToken?: number;
}) {
  const [windowRect, setWindowRect] = useState(EXPERIMENTAL_WINDOW_DEFAULT_RECT);
  const [activeTab, setActiveTab] = useState<"typography" | "layout">("typography");
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollMemoryRef = useRef<Record<string, number>>({ typography: 0, layout: 0 });
  const layoutSectionRef = useRef<HTMLDivElement>(null);
  const columnCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    dragState.current = null;
    setWindowRect(EXPERIMENTAL_WINDOW_DEFAULT_RECT);
    setActiveTab("typography");
    scrollMemoryRef.current = { typography: 0, layout: 0 };
    bodyRef.current?.scrollTo({ top: 0 });
  }, [layoutResetToken]);

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

  useEffect(() => {
    if (!open || !selectedHighlightTarget) return;
    const nextTab = selectedHighlightTarget.kind === "column" ? "typography" : "layout";
    setActiveTab(nextTab);
    requestAnimationFrame(() => {
      if (selectedHighlightTarget.kind === "column") {
        columnCardRefs.current[selectedHighlightTarget.key]?.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      layoutSectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [open, selectedHighlightTarget]);

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
          isMobile ? "inset-2" : "min-w-[320px] min-h-[420px] max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] resize both",
        )}
        style={{ ...windowStyle, overscrollBehavior: "contain" }}
      >
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-2 border-b border-border px-3 py-2.5",
            isMobile ? "bg-gradient-to-r from-slate-950 to-slate-900 text-white" : "bg-muted/60",
            !isMobile && "cursor-grab",
          )}
          onPointerDown={isMobile ? undefined : (event) => {
            dragState.current = {
              startX: event.clientX,
              startY: event.clientY,
              originX: windowRect.x,
              originY: windowRect.y,
            };
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className={cn("h-4 w-4", isMobile ? "text-sky-200" : "text-primary")} />
              <p className={cn("text-sm font-semibold sm:text-[15px]", isMobile ? "text-white" : "text-foreground")}>Studio Eksperimental</p>
            </div>
            <p className={cn("mt-1 max-w-[34rem] text-[11px] leading-relaxed sm:text-xs", isMobile ? "text-slate-200" : "text-muted-foreground")}>
              Atur tipografi, alignment, dan ukuran tabel per kolom sambil tetap melihat preview. {isMobile ? "Di mobile tampil penuh agar tetap nyaman." : "Jendela ini bisa digeser, diperbesar, dan diletakkan lebih bebas."}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 shrink-0 rounded-full", isMobile && "text-white hover:bg-white/10 hover:text-white")}
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className={cn("flex flex-wrap items-center gap-2 border-b border-border px-3 py-2", isMobile && "bg-slate-50/90")}>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] sm:text-xs" onClick={applySuggestions}>
              Saran Cerdas
            </Button>
            <HintInfo label="Saran Cerdas" description="Mengisi ukuran font, alignment, dan lebar awal berdasarkan data kolom yang sedang aktif. Cocok sebagai dasar sebelum penyesuaian manual." />
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-[11px] sm:text-xs"
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
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] sm:text-xs" onClick={syncWithGlobal}>
            Samakan Global
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-full px-3 text-[11px] sm:text-xs" onClick={resetExperimental}>
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
              className="h-9 min-w-0 flex-1 gap-1.5 rounded-full px-3 text-[11px] sm:h-8 sm:flex-none sm:text-xs"
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
          <div className="mb-3 rounded-xl border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground sm:text-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 leading-relaxed">
                Studio ini sinkron langsung dengan live preview. Saat Anda menyorot kolom tertentu di sini, preview akan menandai bagian yang terdampak.
              </div>
              {highlightTarget?.kind === "column" ? (
                <div className="max-w-full rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold leading-relaxed text-primary sm:text-[11px]">
                  Target: {highlightTarget.label || highlightTarget.key}
                </div>
              ) : null}
            </div>
          </div>

          {activeTab === "layout" ? (
            <div ref={layoutSectionRef} className="mb-3 rounded-xl border border-border bg-background/80 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">General</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Atur mode tabel keseluruhan, tinggi header, tinggi baris data, dan skala lebar tabel sebelum fine-tuning per kolom.
                  </p>
                </div>
                <HintInfo label="General layout" description="Autofit konten mempertahankan ukuran natural kolom. Autofit window menyesuaikan tabel ke ruang halaman. Fixed membuat ukuran tabel lebih stabil untuk diatur manual." />
              </div>

              <div
                className="mt-3 grid gap-3"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))" }}
              >
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Mode lebar tabel</Label>
                  <div
                    className="grid gap-1"
                    style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 6.75rem), 1fr))" }}
                  >
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
                  ref={(element) => {
                    columnCardRefs.current[option.key] = element;
                  }}
                  className={cn("rounded-xl border bg-background/80 p-3 transition-colors", isHighlighted ? "border-primary shadow-sm" : "border-border")}
                  onMouseEnter={() => onHighlightTargetHoverChange?.({ kind: "column", key: option.key, label: option.label })}
                  onMouseLeave={() => onHighlightTargetHoverChange?.(null)}
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
                          onClick={() => onHighlightTargetSelect?.({ kind: "column", key: option.key, label: option.label })}
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
                      <div
                        className="mt-3 grid gap-3"
                        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))" }}
                      >
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
                      <div
                        className="mt-3 grid gap-3"
                        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))" }}
                      >
                        <div className="space-y-1.5">
                          <Label className="text-[10px]">Alignment header</Label>
                          <div
                            className="grid gap-1"
                            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 5rem), 1fr))" }}
                          >
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
                          <div
                            className="grid gap-1"
                            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 5rem), 1fr))" }}
                          >
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
                    <div
                      className="mt-3 grid gap-3"
                      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))" }}
                    >
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
        <p className="mt-1 text-[10px] text-muted-foreground">Kelompok ini mengatur preset, tipografi dokumen, dan tampilan blok signature agar lebih mudah dipahami seperti panel desain modern.</p>
      </div>

      {documentStyle && onDocumentStyleChange ? (
        <>
          <div className="space-y-2 rounded-lg border border-border p-2.5">
            <div>
              <Label className="text-[11px] font-semibold">Preset</Label>
              <p className="text-[9px] text-muted-foreground">Pilih titik awal yang paling nyaman, lalu sesuaikan lagi bila perlu.</p>
            </div>
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))" }}
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
                  className="flex h-auto min-h-[3rem] min-w-0 flex-col items-start justify-start gap-0.5 whitespace-normal break-words px-2.5 py-1.5 text-left leading-tight"
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
                  <span className="block w-full whitespace-normal break-words text-[11px] font-semibold leading-tight">{preset.label}</span>
                  <span className="block w-full whitespace-normal break-words text-[9px] leading-snug opacity-70">{preset.desc}</span>
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

    </>
  );
}

function PositionPanel({
  draft,
  setDraft,
  resolvedPlacement,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  resolvedPlacement?: SignaturePlacement | null;
}) {
  const movementBounds = resolvedPlacement?.movementBounds ?? null;
  const maxHorizontalTravelMm = resolvedPlacement && movementBounds
    ? Math.max(0, movementBounds.safeWidthMm - resolvedPlacement.widthMm)
    : 0;
  const maxVerticalTravelMm = resolvedPlacement && movementBounds
    ? Math.max(0, movementBounds.safeHeightMm - resolvedPlacement.heightMm)
    : 0;
  const currentHorizontalMm = resolvedPlacement && movementBounds
    ? Number((resolvedPlacement.xMm - movementBounds.safeXMm).toFixed(2))
    : 0;
  const currentVerticalMm = resolvedPlacement && movementBounds
    ? Number((resolvedPlacement.yMm - movementBounds.safeYMm).toFixed(2))
    : 0;

  const applyPrecisionPosition = (nextXMm: number, nextYMm: number) => {
    if (!resolvedPlacement) return;
    setDraft((prev) => {
      const fixed = resolveFixedSignaturePositionState({
        placement: resolvedPlacement,
        xMm: nextXMm,
        yMm: nextYMm,
        snapToGrid: prev.snapToGrid,
        gridSizeMm: prev.gridSizeMm,
      });
      return {
        ...prev,
        ...fixed,
      };
    });
  };

  const setAxisPosition = (axis: "x" | "y", axisValueMm: number) => {
    if (!resolvedPlacement) return;
    applyPrecisionPosition(
      axis === "x" ? movementBounds!.safeXMm + axisValueMm : resolvedPlacement.xMm,
      axis === "y" ? movementBounds!.safeYMm + axisValueMm : resolvedPlacement.yMm,
    );
  };

  const nudgePosition = (axis: "x" | "y", delta: number) => {
    if (!resolvedPlacement) return;
    applyPrecisionPosition(
      axis === "x" ? resolvedPlacement.xMm + delta : resolvedPlacement.xMm,
      axis === "y" ? resolvedPlacement.yMm + delta : resolvedPlacement.yMm,
    );
  };

  const resetPosition = () => {
    setDraft((prev) => ({
      ...prev,
      ...getDefaultSignaturePositionState(),
    }));
  };

  const parseCustomNumber = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(Number(parsed.toFixed(2)), 1, 40);
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-background/50 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold text-foreground">Style Signature</p>
            <p className="mt-1 text-[10px] text-muted-foreground">Semua pengaturan visual, garis, dan posisi signature dipusatkan di panel ini. Seret langsung di live preview bila perlu.</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 shrink-0 gap-1.5 text-[10px]" onClick={resetPosition}>
            <RotateCcw className="h-3 w-3" />
            Default
          </Button>
        </div>
      </div>

      <StudioSubsection
        title="Garis & Spasi"
        description="Atur ukuran teks signature, posisi garis, lebar garis, dan jarak antar signer."
        tone="amber"
        badge={draft.showSignatureLine ? "Garis aktif" : "Tanpa garis"}
      >
        <div className="rounded-xl border border-amber-200/70 bg-white/80 p-3 space-y-3">
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
              />
            </div>
            <SliderWithButtons value={draft.fontSize} min={1} max={40} step={0.25} buttonStep={1} onValueChange={(value) => setDraft((prev) => ({ ...prev, fontSize: Number(value.toFixed(2)) }))} />
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label className="text-[11px]">Garis signature</Label>
              <p className="text-[9px] text-muted-foreground">Nonaktifkan bila ingin nama signer tampil tanpa garis signature.</p>
            </div>
            <Switch checked={draft.showSignatureLine} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showSignatureLine: checked }))} />
          </div>

          {draft.showSignatureLine ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Posisi garis</Label>
                <div className="grid gap-1 sm:grid-cols-2">
                  {([
                    { value: "above-name", label: "Atas Nama", description: "Garis berada di atas nama signer." },
                    { value: "between-name-and-nip", label: "Di antara Nama & NIP", description: "Bila NIP kosong, garis tetap tampil di bawah nama." },
                  ] as const).map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={getSignatureLinePosition(draft) === option.value ? "default" : "outline"}
                      className="h-auto min-h-0 w-full flex-col items-start gap-1 whitespace-normal rounded-xl px-3 py-2 text-left text-[10px] leading-tight"
                      onClick={() => setDraft((prev) => ({ ...prev, signatureLinePosition: option.value }))}
                    >
                      <span className="block w-full font-medium leading-tight">{option.label}</span>
                      <span className="block w-full text-[9px] leading-snug opacity-75">{option.description}</span>
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Panjang garis</Label>
                <div className="grid gap-1 sm:grid-cols-3">
                  {([
                    { value: "fixed", label: "Manual", description: "Panjang garis diatur dari slider mm." },
                    { value: "name", label: "Sepanjang Nama", description: "Garis mengikuti lebar teks nama signer." },
                    { value: "nip", label: "Sepanjang NIP", description: "Garis mengikuti panjang baris NIP bila tersedia." },
                  ] as const).map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={(draft.signatureLineLengthMode ?? "fixed") === option.value ? "default" : "outline"}
                      className="h-auto min-h-0 w-full flex-col items-start gap-1 whitespace-normal rounded-xl px-3 py-2 text-left text-[10px] leading-tight"
                      onClick={() => setDraft((prev) => ({ ...prev, signatureLineLengthMode: option.value }))}
                    >
                      <span className="block w-full font-medium leading-tight">{option.label}</span>
                      <span className="block w-full text-[9px] leading-snug opacity-75">{option.description}</span>
                    </Button>
                  ))}
                </div>
              </div>
              {(draft.signatureLineLengthMode ?? "fixed") === "fixed" ? (
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Lebar garis ({draft.signatureLineWidth}mm)</Label>
                  <SliderWithButtons value={draft.signatureLineWidth} min={20} max={100} step={5} onValueChange={(value) => setDraft((prev) => ({ ...prev, signatureLineWidth: value }))} />
                </div>
              ) : (
                <p className="rounded-xl border border-amber-200/70 bg-amber-50/60 px-3 py-2 text-[9px] leading-snug text-muted-foreground">
                  Panjang garis sekarang mengikuti {(draft.signatureLineLengthMode ?? "fixed") === "name" ? "teks nama" : "baris NIP"} secara otomatis. Slider mm disimpan sebagai fallback saat data signer belum lengkap.
                </p>
              )}
            </>
          ) : null}

          {draft.signers.length > 1 ? (
            <div className="space-y-1.5">
              <Label className="text-[11px]">Jarak antar signer ({draft.signatureSpacing}mm)</Label>
              <SliderWithButtons value={draft.signatureSpacing} min={5} max={80} step={5} onValueChange={(value) => setDraft((prev) => ({ ...prev, signatureSpacing: value }))} />
            </div>
          ) : null}
        </div>
      </StudioSubsection>

      <StudioSubsection
        title="Preset & Anchor"
        description="Tentukan titik awal penempatan signature dan arah perataan blok sebelum Anda menggeser secara presisi."
        tone="sky"
        badge={
          (draft.signaturePreset || "bottom-right")
            .replace("bottom-left", "Bawah kiri")
            .replace("bottom-center", "Bawah tengah")
            .replace("bottom-right", "Bawah kanan")
            .replace("follow-content", "Ikut konten")
        }
      >
        <div className="rounded-xl border border-sky-200/70 bg-white/80 p-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold">Posisi awal</Label>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))" }}
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
                  title={`Tempatkan anchor awal signature ke area ${preset.label.toLowerCase()}.`}
                  onClick={() => setDraft((prev) => ({
                    ...prev,
                    placementMode: "adaptive",
                    signaturePreset: preset.key,
                    signaturePageIndex: null,
                    manualXPercent: null,
                    manualYPercent: null,
                    signatureOffsetX: 0,
                    signatureOffsetY: 0,
                  }))}
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
                  title={`Atur perataan blok signature ke sisi ${label.toLowerCase()}.`}
                  onClick={() => setDraft((prev) => ({
                    ...prev,
                    placementMode: "adaptive",
                    signatureAlignment: key,
                    signaturePageIndex: null,
                    manualXPercent: null,
                    manualYPercent: null,
                    signatureOffsetX: 0,
                    signatureOffsetY: 0,
                  }))}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </StudioSubsection>

      <StudioSubsection
        title="Presisi Posisi"
        description="Semua kontrol di bagian ini memakai posisi render aktual yang sama dengan live preview dan hasil ekspor."
        tone="indigo"
        badge={draft.lockSignaturePosition ? "Terkunci" : "Bebas"}
        action={(
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[10px]" onClick={resetPosition}>
            <RotateCcw className="h-3 w-3" />
            Reset posisi
          </Button>
        )}
      >
        <div className="rounded-xl border border-indigo-200/70 bg-white/80 p-3 space-y-3">
          <div className="rounded-xl border border-indigo-200/70 bg-indigo-50/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label className="text-[11px]">Kunci tata letak signature</Label>
                <p className="text-[9px] text-muted-foreground">Cegah blok signature bergeser saat preview disentuh atau diseret.</p>
              </div>
              <Switch checked={draft.lockSignaturePosition} onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, lockSignaturePosition: checked }))} />
            </div>
            <div className="flex items-center justify-between gap-3">
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

          <div className="rounded-xl border border-indigo-200/70 bg-white/90 p-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px]">Posisi horizontal ({currentHorizontalMm.toFixed(1)}mm)</Label>
              <SliderWithButtons
                value={currentHorizontalMm}
                min={0}
                max={Math.max(1, Number(maxHorizontalTravelMm.toFixed(2)))}
                step={0.5}
                buttonStep={1}
                onValueChange={(value) => setAxisPosition("x", value)}
                disabled={!resolvedPlacement}
              />
              <p className="text-[9px] text-muted-foreground">Diukur dari batas kiri area gerak aman signature. Saat posisi fixed aktif, offset lama tidak lagi dipakai.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px]">Posisi vertikal ({currentVerticalMm.toFixed(1)}mm)</Label>
              <SliderWithButtons
                value={currentVerticalMm}
                min={0}
                max={Math.max(1, Number(maxVerticalTravelMm.toFixed(2)))}
                step={0.5}
                buttonStep={1}
                onValueChange={(value) => setAxisPosition("y", value)}
                disabled={!resolvedPlacement}
              />
              <p className="text-[9px] text-muted-foreground">Diukur dari batas atas area gerak aman. Nilai ini sama dengan posisi yang dipakai engine ekspor.</p>
            </div>

            {resolvedPlacement ? (
              <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/50 px-3 py-2 text-[9px] leading-snug text-muted-foreground">
                Area gerak aman: horizontal 0-{maxHorizontalTravelMm.toFixed(1)}mm, vertikal 0-{maxVerticalTravelMm.toFixed(1)}mm.
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-indigo-200/70 bg-indigo-50/40 px-3 py-2 text-[9px] leading-snug text-muted-foreground">
                Preview belum memberikan koordinat signature. Buka live preview agar kontrol presisi terkunci ke posisi nyata.
              </div>
            )}
          </div>

          <Separator />

          <div className="rounded-xl border border-dashed border-indigo-200/80 bg-white/70 p-3">
            <Label className="text-[11px] font-semibold">Kontrol presisi</Label>
            <div className="mt-3 flex flex-col items-center gap-1">
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
        </div>
      </StudioSubsection>
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
  const leafOptions = getColumnLeafOptions(columnOptions);
  const checkedCount = leafOptions.filter((c) => c.checked).length;
  const allChecked = leafOptions.length > 0 && checkedCount === leafOptions.length;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const toggleAll = (checked: boolean) => {
    columnOptions.forEach((col) => onColumnOptionChange(col.key, checked));
  };
  const toggleChildren = (children: ExportColumnOption[] | undefined, checked: boolean) => {
    children?.forEach((child) => onColumnOptionChange(child.key, checked));
  };

  return (
    <>
      <StudioSubsection
        title="Ringkasan Data"
        description="Pilih kolom data yang akan tampil di file ekspor dan live preview. Copy grup mengikuti konteks halaman yang membuka studio."
        tone="emerald"
        badge={`${checkedCount}/${leafOptions.length} kolom aktif`}
        action={(
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-[10px]"
            onClick={() => toggleAll(!allChecked)}
          >
            {allChecked ? "Hapus Semua" : "Pilih Semua"}
          </Button>
        )}
      >
        <div className="rounded-xl border border-emerald-200/70 bg-white/80 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
          Grup parent dipakai untuk memilih cepat. Buka detail bila ingin mengatur kolom anak satu per satu.
        </div>
      </StudioSubsection>

      <div className="space-y-3">
        {columnOptions.map((col) => {
          const hasChildren = !!col.children?.length;
          const isExpanded = !!expandedGroups[col.key];
          const activeChildren = col.children?.filter((child) => child.checked).length ?? 0;
          const detailTitle = col.groupMeta?.detailTitle ?? col.label;
          const activeSummaryLabel = col.groupMeta?.activeSummaryLabel ?? "item aktif";
          const collapsedHint = col.groupMeta?.collapsedHint ?? "Daftar detail disembunyikan agar panel tetap ringkas. Tekan Detail untuk membuka pengaturan per item.";

          return (
          <StudioSubsection
            key={col.key}
            title={col.label}
            description={col.description}
            tone={hasChildren ? "emerald" : "slate"}
            badge={hasChildren ? `${activeChildren}/${col.children?.length ?? 0} ${activeSummaryLabel}` : col.checked ? "Aktif" : "Nonaktif"}
          >
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
              <div className="ml-6 rounded-xl border border-emerald-200/70 bg-white/75 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-medium text-foreground">{detailTitle}</p>
                    <p className="text-[9px] text-muted-foreground">{activeChildren}/{col.children?.length ?? 0} {activeSummaryLabel}</p>
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
                    {collapsedHint}
                  </div>
                )}
              </div>
            ) : null}
          </StudioSubsection>
          );
        })}
      </div>
    </>
  );
}

function StylePanel({
  documentStyle,
  onDocumentStyleChange,
  autoFitOnePage,
  onAutoFitOnePageChange,
  showAutoFitPreset,
  columnTypographyOptions,
  onOpenExperimentalWindow,
  stylePresetExtra,
  presetMode = "generic",
  presetBaseline,
}: {
  documentStyle?: ReportDocumentStyle;
  onDocumentStyleChange?: Dispatch<SetStateAction<ReportDocumentStyle>>;
  autoFitOnePage?: boolean;
  onAutoFitOnePageChange?: (value: boolean) => void;
  showAutoFitPreset?: boolean;
  columnTypographyOptions?: ExportColumnTypographyOption[];
  onOpenExperimentalWindow: () => void;
  stylePresetExtra?: ReactNode;
  presetMode?: "generic" | "attendance";
  presetBaseline?: {
    documentStyle: ReportDocumentStyle;
    autoFitOnePage?: boolean;
  };
}) {
  const parseCustomNumber = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return fallback;
    return clamp(Number(parsed.toFixed(2)), 1, 40);
  };

  const baseline = useMemo(
    () => presetBaseline ?? {
      documentStyle: createDefaultReportDocumentStyle(),
      autoFitOnePage: false,
    },
    [presetBaseline],
  );

  const buildAttendancePreset = useCallback((presetId: "default" | "one-page" | "single-column-full" | "compact" | "large") => {
    const next = structuredClone(baseline.documentStyle);
    if (presetId === "default") {
      next.layoutPreset = "standard";
      return { documentStyle: next, autoFitOnePage: !!baseline.autoFitOnePage };
    }
    if (presetId === "one-page") {
      next.layoutPreset = "one-page";
      next.titleFontSize = clamp(baseline.documentStyle.titleFontSize - 1, 7, 40);
      next.metaFontSize = clamp(baseline.documentStyle.metaFontSize - 0.8, 7, 40);
      next.tableHeaderFontSize = clamp(baseline.documentStyle.tableHeaderFontSize - 1.3, 7, 40);
      next.tableBodyFontSize = clamp(baseline.documentStyle.tableBodyFontSize - 1.1, 7, 40);
      next.tableSizing = {
        ...next.tableSizing,
        mode: "autofit-window",
        tableWidthPercent: 100,
        headerRowHeightMm: 8.4,
        bodyRowHeightMm: 6.1,
      };
      next.attendanceLayout = {
        ...next.attendanceLayout,
        contentPaddingYMm: Math.max(2, baseline.documentStyle.attendanceLayout.contentPaddingYMm - 0.8),
        summaryGapMm: Math.max(1.5, baseline.documentStyle.attendanceLayout.summaryGapMm - 0.9),
        infoBlockGapMm: Math.max(1, baseline.documentStyle.attendanceLayout.infoBlockGapMm - 0.5),
        signatureGapMm: Math.max(1.8, baseline.documentStyle.attendanceLayout.signatureGapMm - 0.8),
        footerClearanceMm: Math.max(2, baseline.documentStyle.attendanceLayout.footerClearanceMm - 0.6),
      };
      return { documentStyle: next, autoFitOnePage: true };
    }
    if (presetId === "single-column-full") {
      next.layoutPreset = "single-column-full";
      next.titleFontSize = clamp(baseline.documentStyle.titleFontSize - 1.4, 7, 40);
      next.metaFontSize = clamp(baseline.documentStyle.metaFontSize - 1, 7, 40);
      next.tableHeaderFontSize = clamp(baseline.documentStyle.tableHeaderFontSize - 2, 7, 40);
      next.tableBodyFontSize = clamp(baseline.documentStyle.tableBodyFontSize - 1.8, 7, 40);
      next.tableSizing = {
        ...next.tableSizing,
        mode: "autofit-window",
        tableWidthPercent: 100,
        headerRowHeightMm: 8.1,
        bodyRowHeightMm: 5.7,
      };
      next.attendanceLayout = {
        ...next.attendanceLayout,
        summaryGapMm: Math.max(1.5, baseline.documentStyle.attendanceLayout.summaryGapMm - 0.6),
        infoBlockGapMm: Math.max(1, baseline.documentStyle.attendanceLayout.infoBlockGapMm - 0.35),
      };
      return { documentStyle: next, autoFitOnePage: false };
    }
    if (presetId === "compact") {
      next.layoutPreset = "compact";
      next.titleFontSize = clamp(baseline.documentStyle.titleFontSize - 1.8, 7, 40);
      next.metaFontSize = clamp(baseline.documentStyle.metaFontSize - 1.2, 7, 40);
      next.tableHeaderFontSize = clamp(baseline.documentStyle.tableHeaderFontSize - 1.8, 7, 40);
      next.tableBodyFontSize = clamp(baseline.documentStyle.tableBodyFontSize - 1.6, 7, 40);
      next.tableSizing = {
        ...next.tableSizing,
        mode: "autofit-content",
        tableWidthPercent: 98,
        headerRowHeightMm: 8,
        bodyRowHeightMm: 5.6,
      };
      next.attendanceLayout = {
        ...next.attendanceLayout,
        contentPaddingYMm: Math.max(2, baseline.documentStyle.attendanceLayout.contentPaddingYMm - 0.7),
        summaryGapMm: Math.max(1.5, baseline.documentStyle.attendanceLayout.summaryGapMm - 1),
        infoBlockGapMm: Math.max(1, baseline.documentStyle.attendanceLayout.infoBlockGapMm - 0.55),
        signatureGapMm: Math.max(1.6, baseline.documentStyle.attendanceLayout.signatureGapMm - 1),
        footerClearanceMm: Math.max(2, baseline.documentStyle.attendanceLayout.footerClearanceMm - 0.8),
      };
      return { documentStyle: next, autoFitOnePage: false };
    }
    next.layoutPreset = "large";
    next.titleFontSize = clamp(baseline.documentStyle.titleFontSize + 1.5, 7, 40);
    next.metaFontSize = clamp(baseline.documentStyle.metaFontSize + 0.8, 7, 40);
    next.tableHeaderFontSize = clamp(baseline.documentStyle.tableHeaderFontSize + 1, 7, 40);
    next.tableBodyFontSize = clamp(baseline.documentStyle.tableBodyFontSize + 0.8, 7, 40);
    next.tableSizing = {
      ...next.tableSizing,
      mode: "autofit-content",
      tableWidthPercent: 100,
      headerRowHeightMm: 9.4,
      bodyRowHeightMm: 6.7,
    };
    next.attendanceLayout = {
      ...next.attendanceLayout,
      summaryGapMm: baseline.documentStyle.attendanceLayout.summaryGapMm + 0.4,
      infoBlockGapMm: baseline.documentStyle.attendanceLayout.infoBlockGapMm + 0.2,
      signatureGapMm: baseline.documentStyle.attendanceLayout.signatureGapMm + 0.5,
      footerClearanceMm: baseline.documentStyle.attendanceLayout.footerClearanceMm + 0.3,
    };
    return { documentStyle: next, autoFitOnePage: !!baseline.autoFitOnePage };
  }, [baseline]);

  const presets = useMemo(() => (
    presetMode === "attendance"
      ? [
          { id: "default", label: "Default", desc: "Kondisi awal saat studio pertama dibuka." },
          { id: "one-page", label: "1 Halaman", desc: "Padat wajar agar header sampai footer tetap muat." },
          { id: "single-column-full", label: "1 Kolom Penuh", desc: "Prioritaskan semua kolom muat dalam satu halaman." },
          { id: "compact", label: "Kompak", desc: "Lebih rapat, tetapi tetap menjaga keterbacaan." },
          { id: "large", label: "Besar", desc: "Lebih lega untuk dibaca tanpa merusak layout." },
        ] as const
      : [
          { id: "default", label: "Default", desc: "Baseline style bawaan studio." },
          { id: "one-page", label: "1 Halaman", desc: "Utamakan satu halaman." },
          { id: "single-column-full", label: "1 Kolom Penuh", desc: "Fokus agar semua kolom muat." },
          { id: "compact", label: "Kompak", desc: "Layout lebih ringkas." },
          { id: "large", label: "Besar", desc: "Tampilan lebih besar dan nyaman dibaca." },
        ] as const
  ), [presetMode]);

  const isPresetActive = useCallback((presetId: (typeof presets)[number]["id"]) => {
    if (!documentStyle) return false;
    const applied = presetMode === "attendance"
      ? buildAttendancePreset(presetId)
      : {
          documentStyle: {
            ...baseline.documentStyle,
            layoutPreset: presetId === "default"
              ? "standard"
              : presetId === "one-page"
                ? "one-page"
                : presetId === "single-column-full"
                  ? "single-column-full"
                  : presetId === "compact"
                    ? "compact"
                    : "large",
          },
          autoFitOnePage: presetId === "one-page",
        };

    return JSON.stringify(documentStyle) === JSON.stringify(applied.documentStyle)
      && !!autoFitOnePage === !!applied.autoFitOnePage;
  }, [autoFitOnePage, baseline.documentStyle, buildAttendancePreset, documentStyle, presetMode]);

  const applyPreset = useCallback((presetId: (typeof presets)[number]["id"]) => {
    const applied = presetMode === "attendance"
      ? buildAttendancePreset(presetId)
      : {
          documentStyle: {
            ...baseline.documentStyle,
            titleFontSize: presetId === "default" ? baseline.documentStyle.titleFontSize : presetId === "one-page" ? 14 : presetId === "single-column-full" ? 12 : presetId === "compact" ? 14 : 20,
            metaFontSize: presetId === "default" ? baseline.documentStyle.metaFontSize : presetId === "one-page" ? 9 : presetId === "single-column-full" ? 8 : presetId === "compact" ? 9 : 12,
            tableHeaderFontSize: presetId === "default" ? baseline.documentStyle.tableHeaderFontSize : presetId === "one-page" ? 10 : presetId === "single-column-full" ? 8 : presetId === "compact" ? 9 : 14,
            tableBodyFontSize: presetId === "default" ? baseline.documentStyle.tableBodyFontSize : presetId === "one-page" ? 10 : presetId === "single-column-full" ? 7 : presetId === "compact" ? 8 : 13,
            layoutPreset: (presetId === "default" ? "standard" : presetId === "one-page" ? "one-page" : presetId === "single-column-full" ? "single-column-full" : presetId === "compact" ? "compact" : "large") as ReportDocumentStyle["layoutPreset"],
          },
          autoFitOnePage: presetId === "one-page",
        };
    onDocumentStyleChange?.(applied.documentStyle);
    onAutoFitOnePageChange?.(applied.autoFitOnePage);
  }, [baseline.documentStyle, buildAttendancePreset, onAutoFitOnePageChange, onDocumentStyleChange, presetMode]);

  return (
    <>
      {documentStyle && onDocumentStyleChange ? (
        <>
          <StudioSubsection
            title="Preset Dokumen"
            description={presetMode === "attendance"
              ? "Semua preset Presensi diturunkan dari Default. Preset Default selalu mengikuti kondisi awal saat studio pertama dibuka."
              : "Pilih titik awal style dokumen. Preset Default selalu mengikuti baseline style bawaan studio."}
            tone="rose"
            badge={presets.find((preset) => isPresetActive(preset.id))?.label ?? "Kustom"}
          >
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 11rem), 1fr))" }}
            >
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant={isPresetActive(preset.id) ? "default" : "outline"}
                  size="sm"
                  className="flex h-auto min-h-[4.5rem] min-w-0 flex-col items-start justify-start gap-1 whitespace-normal break-words rounded-xl px-3 py-2.5 text-left leading-tight"
                  title={`Gunakan preset style ${preset.label}. ${preset.desc}`}
                  onClick={() => applyPreset(preset.id)}
                >
                  <span className="block w-full whitespace-normal break-words text-[12px] font-semibold leading-tight">{preset.label}</span>
                  <span className="block w-full whitespace-normal break-words text-[10px] leading-snug opacity-75">{preset.desc}</span>
                </Button>
              ))}
            </div>
          </StudioSubsection>

          {stylePresetExtra ? stylePresetExtra : null}

          {showAutoFitPreset ? (
            <StudioSubsection
              title="Layout Otomatis"
              description="Kontrol ini terpisah dari preset agar Anda bisa mengunci style pilihan sambil tetap menyesuaikan fit halaman."
              tone="sky"
              badge={autoFitOnePage ? "1 halaman" : "Manual"}
            >
              <div className="flex flex-col gap-2 rounded-xl border border-sky-200/70 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label className="text-[11px]">Optimalkan 1 halaman</Label>
                  <p className="text-[9px] text-muted-foreground">Sistem akan berusaha menjaga tabel tetap padat tanpa mengorbankan keterbacaan terlalu jauh.</p>
                </div>
                <Switch checked={!!autoFitOnePage} onCheckedChange={(checked) => onAutoFitOnePageChange?.(checked)} />
              </div>
            </StudioSubsection>
          ) : null}

          <StudioSubsection
            title="Tipografi Dokumen"
            description="Ukuran judul, meta, header tabel, dan isi tabel akan langsung tercermin pada live preview."
            tone="indigo"
          >
            {([
              { key: "titleFontSize", label: "Judul dokumen" },
              { key: "metaFontSize", label: "Info dokumen" },
              { key: "tableHeaderFontSize", label: "Header tabel" },
              { key: "tableBodyFontSize", label: "Isi tabel" },
            ] as const).map((item) => (
              <div key={item.key} className="rounded-xl border border-indigo-200/70 bg-white/80 p-3 space-y-1.5">
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
          </StudioSubsection>

          {columnTypographyOptions && columnTypographyOptions.length > 0 ? (
            <StudioSubsection
              title="Eksperimen Kolom"
              description="Mode eksperimen dipisah agar panel utama tetap bersih, tetapi live preview tetap aktif saat studio eksperimen dibuka."
              tone="amber"
              badge={documentStyle.experimentalColumnTypographyEnabled ? "Aktif" : "Standar"}
              action={(
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
              )}
            >
              <div className="flex flex-col gap-2 rounded-xl border border-amber-200/70 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
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
                <div className="rounded-xl border border-amber-200/70 bg-white/80 p-3 text-[10px] text-muted-foreground">
                  {documentStyle.experimentalColumnTypographyEnabled
                    ? `Mode aktif untuk ${Object.keys(documentStyle.columnFontOverrides || {}).length || columnTypographyOptions.length} kolom.`
                    : "Mode belum aktif. Nyalakan mode lalu buka studio eksperimen untuk mengatur kolom satu per satu."}
                </div>
                <div className="rounded-xl border border-amber-200/70 bg-white/80 p-3 text-[10px] text-muted-foreground">
                  Gunakan studio eksperimen untuk menyesuaikan kolom yang padat tanpa mengorbankan keterbacaan tabel utama.
                </div>
              </div>
            </StudioSubsection>
          ) : null}
        </>
      ) : null}
    </>
  );
}

export function ExportStudioDialog({
  title = "Pusat Ekspor Dokumen",
  description = "Pilih format, atur signature, dan lihat preview sebelum file diekspor.",
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
  stylePanelExtra,
  previewFooter,
  onRestoreDefaultMode,
  defaultModeLabel = "Mode Default",
  defaultModeDescription = "Kembalikan studio ke baseline awal tanpa mengubah ukuran kertas dan identitas signature.",
  stylePresetMode = "generic",
  stylePresetBaseline,
}: ExportStudioDialogProps) {
  type ActivePanel = "format" | "columns" | "signature" | "style" | "signatureStyle";
  type MobileWizardStep = "format" | "setup" | "preview";
  type MobileSetupSection = "document" | "data" | "signature" | "signatureStyle";
  type MobileOverlayInteraction = {
    mode: "drag" | "resize";
    originX: number;
    originY: number;
    startFrame: MobileOverlayFrame;
  };
  type DesktopPanelResizeState = {
    startX: number;
    startWidth: number;
  };

  const { success, error: showError } = useEnhancedToast();
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("format");
  const [previewZoom, setPreviewZoom] = useState(100);
  const [draft, setDraft] = useState<SignatureSettingsConfig>(createDefaultSignatureConfig());
  const [experimentalWindowOpen, setExperimentalWindowOpen] = useState(false);
  const [liveEditMode, setLiveEditMode] = useState(false);
  const [hoverHighlightTarget, setHoverHighlightTarget] = useState<ExportPreviewHighlightTarget | null>(null);
  const [selectedHighlightTarget, setSelectedHighlightTarget] = useState<ExportPreviewHighlightTarget | null>(null);
  const [resolvedSignaturePlacement, setResolvedSignaturePlacement] = useState<SignaturePlacement | null>(null);
  const [activeMobileSection, setActiveMobileSection] = useState<"panel" | "preview">("panel");
  const [mobileStep, setMobileStep] = useState<MobileWizardStep>("format");
  const [mobileSetupSection, setMobileSetupSection] = useState<MobileSetupSection | null>("document");
  const [mobileOverlayState, setMobileOverlayState] = useState<"expanded" | "minimized" | "hidden-temporary">("hidden-temporary");
  const [mobileOverlayZoom, setMobileOverlayZoom] = useState(30);
  const [mobileOverlayFrame, setMobileOverlayFrame] = useState<MobileOverlayFrame>(MOBILE_OVERLAY_DEFAULT_FRAME);
  const [desktopPanelWidth, setDesktopPanelWidth] = useState(440);
  const [studioTopTrayExpanded, setStudioTopTrayExpanded] = useState(true);
  const [resetLayoutConfirmOpen, setResetLayoutConfirmOpen] = useState(false);
  const [experimentalLayoutResetToken, setExperimentalLayoutResetToken] = useState(0);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const layoutViewportRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const previewCaptureRef = useRef<HTMLDivElement>(null);
  const mobileOverlayViewportRef = useRef<HTMLDivElement>(null);
  const mobileOverlayCaptureRef = useRef<HTMLDivElement>(null);
  const mobileOverlayCardRef = useRef<HTMLDivElement>(null);
  const mobileOverlayInteractionRef = useRef<MobileOverlayInteraction | null>(null);
  const desktopPanelResizeRef = useRef<DesktopPanelResizeState | null>(null);
  const mobileSetupSectionRefs = useRef<Partial<Record<MobileSetupSection, HTMLDivElement | null>>>({});
  const previousExperimentalOpenRef = useRef(false);
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const highlightTarget = hoverHighlightTarget ?? selectedHighlightTarget;
  const panelScrollMemoryRef = useRef<Record<string, number>>({});
  const hasOpenedRef = useRef(false);
  const studioTopTrayAutoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewViewportWidth, setPreviewViewportWidth] = useState(0);
  const [previewContentWidth, setPreviewContentWidth] = useState(0);
  const viewport = useStudioViewportProfile(layoutViewportRef, open);
  const layoutWidth = viewport.layoutWidth;
  const isMobileLayout = layoutWidth < 1024;
  const isPhoneWizard = viewport.isPhone;
  const usesTabbedMobileStudio = isMobileLayout && !isPhoneWizard;
  const isCompactLayout = layoutWidth < 880 || viewport.isPhone;
  const isNarrowLayout = layoutWidth < 640 || viewport.isCompactPhone;
  const clearStudioTopTrayAutoCollapseTimer = useCallback(() => {
    if (!studioTopTrayAutoCollapseTimerRef.current) return;
    clearTimeout(studioTopTrayAutoCollapseTimerRef.current);
    studioTopTrayAutoCollapseTimerRef.current = null;
  }, []);
  const handleStudioTopTrayExpandedChange = useCallback((next: boolean) => {
    clearStudioTopTrayAutoCollapseTimer();
    setStudioTopTrayExpanded(next);
  }, [clearStudioTopTrayAutoCollapseTimer]);
  const getMobileOverlayBounds = useCallback(() => {
    const boundsNode = layoutViewportRef.current ?? dialogContentRef.current;
    const rect = boundsNode?.getBoundingClientRect();

    return {
      width: rect?.width ?? 360,
      height: rect?.height ?? 640,
    };
  }, []);
  const getDesktopPanelBounds = useCallback(() => {
    const boundsNode = layoutViewportRef.current ?? dialogContentRef.current;
    const rect = boundsNode?.getBoundingClientRect();
    const width = rect?.width ?? 1280;
    const min = clamp(Math.round(width * 0.32), DESKTOP_STUDIO_PANEL_MIN_WIDTH, 460);
    const max = clamp(width - DESKTOP_STUDIO_PREVIEW_MIN_WIDTH, min + 40, DESKTOP_STUDIO_PANEL_MAX_WIDTH);

    return { width, min, max };
  }, []);
  const getDefaultDesktopPanelWidth = useCallback(() => {
    const bounds = getDesktopPanelBounds();
    return clamp(Math.round(bounds.width * 0.38), bounds.min, bounds.max);
  }, [getDesktopPanelBounds]);
  useEffect(() => {
    if (!open) return;
    clearStudioTopTrayAutoCollapseTimer();
    setStudioTopTrayExpanded(true);
    studioTopTrayAutoCollapseTimerRef.current = setTimeout(() => {
      setStudioTopTrayExpanded(false);
      studioTopTrayAutoCollapseTimerRef.current = null;
    }, STUDIO_TOP_TRAY_AUTO_COLLAPSE_DELAY_MS);
    return () => clearStudioTopTrayAutoCollapseTimer();
  }, [clearStudioTopTrayAutoCollapseTimer, open]);
  const clampMobileOverlayFrame = useCallback((frame: MobileOverlayFrame) => {
    const bounds = getMobileOverlayBounds();
    const maxWidth = Math.max(240, Math.min(360, Math.floor(bounds.width - 16)));
    const maxHeight = Math.max(184, Math.floor(bounds.height - 16));
    const width = clamp(frame.width, 240, maxWidth);
    const height = clamp(frame.height, 184, maxHeight);
    const left = clamp(frame.left, 8, Math.max(8, Math.floor(bounds.width - width - 8)));
    const top = clamp(frame.top, 8, Math.max(8, Math.floor(bounds.height - height - 8)));

    return { left, top, width, height };
  }, [getMobileOverlayBounds]);
  const getDefaultMobileOverlayFrame = useCallback(() => {
    const bounds = getMobileOverlayBounds();
    const width = clamp(Math.round(bounds.width * 0.78), 240, Math.max(240, Math.min(336, Math.floor(bounds.width - 16))));
    const height = clamp(Math.round(bounds.height * 0.34), 184, Math.max(184, Math.min(276, Math.floor(bounds.height - 16))));
    const top = clamp(bounds.height - height - 92, 72, Math.max(72, bounds.height - height - 8));
    const left = clamp(bounds.width - width - 8, 8, Math.max(8, bounds.width - width - 8));

    return clampMobileOverlayFrame({ left, top, width, height });
  }, [clampMobileOverlayFrame, getMobileOverlayBounds]);
  const resetStudioLayoutState = useCallback(() => {
    panelScrollMemoryRef.current = {};
    setActivePanel("format");
    setActiveMobileSection("panel");
    setMobileStep("format");
    setMobileSetupSection("document");
    setPreviewZoom(100);
    setLiveEditMode(false);
    setHoverHighlightTarget(null);
    setSelectedHighlightTarget(null);
    setResolvedSignaturePlacement(null);
    setExperimentalWindowOpen(false);
    setExperimentalLayoutResetToken((prev) => prev + 1);
    setDesktopPanelWidth(getDefaultDesktopPanelWidth());
    requestAnimationFrame(() => {
      setMobileOverlayState("expanded");
      setMobileOverlayZoom(34);
      setMobileOverlayFrame(getDefaultMobileOverlayFrame());
    });
  }, [getDefaultDesktopPanelWidth, getDefaultMobileOverlayFrame]);
  const handleResetLayoutOnly = useCallback(() => {
    resetStudioLayoutState();
    setResetLayoutConfirmOpen(false);
  }, [resetStudioLayoutState]);
  const handleRestoreDefaultMode = useCallback(() => {
    onRestoreDefaultMode?.();
    setDraft((prev) => createDefaultModeSignatureDraft(prev));
    resetStudioLayoutState();
  }, [onRestoreDefaultMode, resetStudioLayoutState]);
  const openExperimentalWorkspace = useCallback(() => {
    setLiveEditMode(true);
    setExperimentalWindowOpen(true);
  }, []);

  useEffect(() => {
    if (!open && signatureConfig) {
      setDraft({ ...createDefaultSignatureConfig(), ...signatureConfig });
    }
  }, [open, signatureConfig]);

  useEffect(() => {
    if (open && !hasOpenedRef.current) {
      setDraft(signatureConfig ? { ...createDefaultSignatureConfig(), ...signatureConfig } : createDefaultSignatureConfig());
      resetStudioLayoutState();
      hasOpenedRef.current = true;
    }

    if (!open) {
      hasOpenedRef.current = false;
      clearStudioTopTrayAutoCollapseTimer();
      setExperimentalWindowOpen(false);
      mobileOverlayInteractionRef.current = null;
      setResetLayoutConfirmOpen(false);
    }
  }, [clearStudioTopTrayAutoCollapseTimer, open, resetStudioLayoutState, signatureConfig]);

  useEffect(() => {
    if (supportsSignature) return;
    if (activePanel === "signature" || activePanel === "signatureStyle") {
      setActivePanel("format");
    }
  }, [activePanel, includeSignature, supportsSignature]);
  useEffect(() => {
    if (!open) {
      previousExperimentalOpenRef.current = experimentalWindowOpen;
      return;
    }
    if (experimentalWindowOpen) {
      if (!liveEditMode) {
        setLiveEditMode(true);
      }
      previousExperimentalOpenRef.current = true;
      return;
    }
    if (previousExperimentalOpenRef.current) {
      setHoverHighlightTarget(null);
      setSelectedHighlightTarget(null);
    }
    if (liveEditMode) {
      setLiveEditMode(false);
    }
    previousExperimentalOpenRef.current = experimentalWindowOpen;
  }, [experimentalWindowOpen, liveEditMode, open]);
  useEffect(() => {
    if (!open || isMobileLayout) return;

    const bounds = getDesktopPanelBounds();
    setDesktopPanelWidth((prev) => clamp(prev, bounds.min, bounds.max));
  }, [getDesktopPanelBounds, isMobileLayout, layoutWidth, open]);

  useEffect(() => {
    if (!open || isMobileLayout) return;

    const handlePointerMove = (event: PointerEvent) => {
      const interaction = desktopPanelResizeRef.current;
      if (!interaction) return;

      const bounds = getDesktopPanelBounds();
      const nextWidth = clamp(interaction.startWidth + (event.clientX - interaction.startX), bounds.min, bounds.max);
      setDesktopPanelWidth(nextWidth);
    };
    const handlePointerUp = () => {
      desktopPanelResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    window.addEventListener("resize", handlePointerUp);
    return () => {
      handlePointerUp();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      window.removeEventListener("resize", handlePointerUp);
    };
  }, [getDesktopPanelBounds, isMobileLayout, open]);

  useEffect(() => {
    if (!open || !liveEditMode || !selectedHighlightTarget) return;
    setExperimentalWindowOpen(true);
    setActivePanel("style");
    setActiveMobileSection("panel");
    if (isPhoneWizard) {
      setMobileStep("setup");
      setMobileSetupSection("document");
    }
  }, [isPhoneWizard, liveEditMode, open, selectedHighlightTarget]);

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
    if (!open || !isPhoneWizard) return;

    if (mobileStep === "preview") {
      setMobileOverlayState("hidden-temporary");
      return;
    }

    setMobileOverlayState(mobileStep === "format" ? "expanded" : "minimized");
  }, [isPhoneWizard, mobileStep, open]);

  useEffect(() => {
    if (!open || !isPhoneWizard) return;
    setMobileOverlayFrame((prev) => clampMobileOverlayFrame(prev));
  }, [clampMobileOverlayFrame, isPhoneWizard, layoutWidth, open, viewport.isCompactPhone]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = mobileOverlayInteractionRef.current;
      if (!interaction) return;

      const deltaX = event.clientX - interaction.originX;
      const deltaY = event.clientY - interaction.originY;

      setMobileOverlayFrame(() => {
        if (interaction.mode === "drag") {
          return clampMobileOverlayFrame({
            ...interaction.startFrame,
            left: interaction.startFrame.left + deltaX,
            top: interaction.startFrame.top + deltaY,
          });
        }

        return clampMobileOverlayFrame({
          ...interaction.startFrame,
          width: interaction.startFrame.width + deltaX,
          height: interaction.startFrame.height + deltaY,
        });
      });
    };

    const handlePointerUp = () => {
      mobileOverlayInteractionRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [clampMobileOverlayFrame]);

  const activeFormat = useMemo(
    () => formats.find((formatOption) => formatOption.id === selectedFormat) ?? formats[0],
    [formats, selectedFormat],
  );

  const previewFormat = activeFormat?.previewMode === "png" ? "png" : "pdf";
  const canPreview = !!activeFormat?.previewMode;
  const currentPaperSize = paperSize;
  const experimentalModeActive = !!(documentStyle?.experimentalColumnTypographyEnabled || documentStyle?.experimentalColumnLayoutEnabled);

  useEffect(() => {
    if (!open) return;

    const updatePreviewMetrics = () => {
      const viewportWidth = previewViewportRef.current?.clientWidth ?? 0;
      const contentWidth = previewCaptureRef.current?.scrollWidth ?? 0;
      setPreviewViewportWidth(viewportWidth);
      setPreviewContentWidth(contentWidth);
    };

    updatePreviewMetrics();

    const viewportNode = previewViewportRef.current;
    const contentNode = previewCaptureRef.current;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updatePreviewMetrics);
      return () => window.removeEventListener("resize", updatePreviewMetrics);
    }

    const observer = new ResizeObserver(() => updatePreviewMetrics());
    if (viewportNode) observer.observe(viewportNode);
    if (contentNode) observer.observe(contentNode);
    window.addEventListener("resize", updatePreviewMetrics);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePreviewMetrics);
    };
  }, [activeMobileSection, activePanel, canPreview, currentPaperSize, mobileStep, open, previewFormat]);

  useEffect(() => {
    if (!open || isPhoneWizard || !panelScrollRef.current) return;
    requestAnimationFrame(() => {
      panelScrollRef.current?.scrollTo({ top: panelScrollMemoryRef.current[activePanel] ?? 0 });
    });
  }, [activePanel, isPhoneWizard, open]);

  useEffect(() => {
    if (!open || mobileStep !== "setup" || !mobileSetupSection) return;
    const sectionNode = mobileSetupSectionRefs.current[mobileSetupSection];
    if (!sectionNode) return;
    requestAnimationFrame(() => {
      sectionNode.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [mobileSetupSection, mobileStep, open]);

  const switchPanel = useCallback((nextPanel: typeof activePanel) => {
    panelScrollMemoryRef.current[activePanel] = panelScrollRef.current?.scrollTop ?? 0;
    setActivePanel(nextPanel);
  }, [activePanel]);
  const openSignatureStyleWorkspace = useCallback(() => {
    switchPanel("signatureStyle");
    setActiveMobileSection("panel");
    setMobileStep("setup");
    setMobileSetupSection("signatureStyle");
  }, [switchPanel]);
  const handleMobilePointerUpCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isCoarsePointerDevice()) return;
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button");
    if (button instanceof HTMLButtonElement) {
      requestAnimationFrame(() => button.blur());
    }
  }, []);
  const autoPreviewZoom = useMemo(() => {
    if (!isCompactLayout || previewViewportWidth <= 0 || previewContentWidth <= 0) return 100;
    const paddedViewportWidth = Math.max(previewViewportWidth - 24, 120);
    return clamp(Math.floor((paddedViewportWidth / previewContentWidth) * 100), 38, 100);
  }, [isCompactLayout, previewContentWidth, previewViewportWidth]);
  const effectivePreviewZoom = isCompactLayout
    ? Math.min(previewZoom, autoPreviewZoom)
    : previewZoom;
  const previewZoomMax = isCompactLayout ? autoPreviewZoom : 200;
  const recommendedPaperSize = useMemo(
    () => getRecommendedPaperSize(activeFormat?.id ?? ""),
    [activeFormat?.id],
  );
  const recommendedPaperOption = useMemo(
    () => PAPER_SIZE_OPTIONS.find((option) => option.id === recommendedPaperSize) ?? null,
    [recommendedPaperSize],
  );
  const currentPaperOption = useMemo(
    () => PAPER_SIZE_OPTIONS.find((option) => option.id === currentPaperSize) ?? null,
    [currentPaperSize],
  );
  const recommendedPaperCopy = useMemo(
    () => getRecommendedPaperCopy(activeFormat?.id ?? ""),
    [activeFormat?.id],
  );
  const panelSections = useMemo<StudioSectionDescriptor<typeof activePanel>[]>(
    () => ([
      { id: "format", label: "Format", icon: Download, priority: "primary" as const, mobileVisibility: "visible" as const, desktopVisibility: "visible" as const },
      ...(columnOptions ? [{ id: "columns" as const, label: "Kolom", icon: Columns3, priority: "secondary" as const, mobileVisibility: "visible" as const, desktopVisibility: "visible" as const }] : []),
      { id: "signature", label: "Signature", icon: PenTool, priority: "secondary" as const, mobileVisibility: "visible" as const, desktopVisibility: "visible" as const },
      { id: "style", label: "Style", icon: Sparkles, priority: "primary" as const, mobileVisibility: "visible" as const, desktopVisibility: "visible" as const },
      { id: "signatureStyle", label: "Style Signature", icon: Move, priority: "secondary" as const, mobileVisibility: "visible" as const, desktopVisibility: "visible" as const },
    ]),
    [columnOptions],
  );
  const desktopPanelToneMap = {
    format: {
      shell: "border-sky-200/80 bg-sky-50/30",
      card: "border-sky-200/80 bg-sky-50/45",
      activeTab: "border-sky-300 bg-sky-600 text-white hover:bg-sky-600 hover:text-white dark:bg-sky-500 dark:hover:bg-sky-500 dark:text-slate-950 dark:hover:text-slate-950",
      idleTab: "border-sky-200/80 text-sky-700 hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-800 dark:border-sky-900/70 dark:text-sky-200 dark:hover:border-sky-700 dark:hover:bg-sky-950/40 dark:hover:text-sky-100",
      badge: "border-sky-200/80 bg-sky-100/80 text-sky-700",
    },
    columns: {
      shell: "border-emerald-200/80 bg-emerald-50/30",
      card: "border-emerald-200/80 bg-emerald-50/45",
      activeTab: "border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-600 hover:text-white dark:bg-emerald-500 dark:hover:bg-emerald-500 dark:text-slate-950 dark:hover:text-slate-950",
      idleTab: "border-emerald-200/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-800 dark:border-emerald-900/70 dark:text-emerald-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-100",
      badge: "border-emerald-200/80 bg-emerald-100/80 text-emerald-700",
    },
    signature: {
      shell: "border-amber-200/80 bg-amber-50/30",
      card: "border-amber-200/80 bg-amber-50/45",
      activeTab: "border-amber-300 bg-amber-500 text-white hover:bg-amber-500 hover:text-white dark:bg-amber-400 dark:hover:bg-amber-400 dark:text-slate-950 dark:hover:text-slate-950",
      idleTab: "border-amber-200/80 text-amber-700 hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-800 dark:border-amber-900/70 dark:text-amber-200 dark:hover:border-amber-700 dark:hover:bg-amber-950/40 dark:hover:text-amber-100",
      badge: "border-amber-200/80 bg-amber-100/80 text-amber-700",
    },
    style: {
      shell: "border-rose-200/80 bg-rose-50/30",
      card: "border-rose-200/80 bg-rose-50/45",
      activeTab: "border-rose-300 bg-rose-600 text-white hover:bg-rose-600 hover:text-white dark:bg-rose-500 dark:hover:bg-rose-500 dark:text-slate-950 dark:hover:text-slate-950",
      idleTab: "border-rose-200/80 text-rose-700 hover:border-rose-300 hover:bg-rose-50/60 hover:text-rose-800 dark:border-rose-900/70 dark:text-rose-200 dark:hover:border-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-100",
      badge: "border-rose-200/80 bg-rose-100/80 text-rose-700",
    },
    signatureStyle: {
      shell: "border-indigo-200/80 bg-indigo-50/30",
      card: "border-indigo-200/80 bg-indigo-50/45",
      activeTab: "border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white dark:bg-indigo-500 dark:hover:bg-indigo-500 dark:text-slate-950 dark:hover:text-slate-950",
      idleTab: "border-indigo-200/80 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-800 dark:border-indigo-900/70 dark:text-indigo-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-100",
      badge: "border-indigo-200/80 bg-indigo-100/80 text-indigo-700",
    },
  } satisfies Record<ActivePanel, {
    shell: string;
    card: string;
    activeTab: string;
    idleTab: string;
    badge: string;
  }>;
  const activeDesktopPanelTone = desktopPanelToneMap[activePanel];
  const activePanelMeta = panelSections.find((section) => section.id === activePanel) ?? panelSections[0];
  const previewDate = draft.useCustomDate && draft.customDate
    ? formatSignatureDisplayDate(draft.customDate)
    : formatSignatureDisplayDate();
  const renderPreviewContent = useCallback(
    (captureRef?: React.RefObject<HTMLDivElement>) => (
      <div
        ref={captureRef}
        className="origin-top"
        style={{
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
          onHighlightTargetHoverChange: setHoverHighlightTarget,
          onHighlightTargetSelect: (target) => {
            setHoverHighlightTarget(null);
            setSelectedHighlightTarget(target);
          },
          onSignaturePlacementChange: setResolvedSignaturePlacement,
        }) : (
          <GenericSignaturePreview
            draft={draft}
            setDraft={setDraft}
            previewDate={previewDate}
            includeSignature={supportsSignature ? includeSignature : false}
            highlightTarget={highlightTarget}
            onHighlightTargetHoverChange={setHoverHighlightTarget}
            onHighlightTargetSelect={(target) => {
              setHoverHighlightTarget(null);
              setSelectedHighlightTarget(target);
            }}
          />
        )}
      </div>
    ),
    [
      autoFitOnePage,
      currentPaperSize,
      documentStyle,
      draft,
      highlightTarget,
      includeSignature,
      liveEditMode,
      previewDate,
      previewFormat,
      renderPreview,
      supportsSignature,
    ],
  );
  const handleResetSignaturePosition = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      ...getDefaultSignaturePositionState(),
    }));
  }, []);

  const saveCurrentSignature = useCallback(async () => {
    if (!supportsSignature) return;
    if (!hasValidSignatureConfig(draft)) {
      throw new Error("Isi kota dan minimal 1 nama signature.");
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
      success("Pengaturan signature disimpan");
    } catch (error: unknown) {
      showError("Gagal menyimpan", error instanceof Error ? error.message : "Terjadi kesalahan saat menyimpan signature.");
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
    } catch (error: unknown) {
      showError("Ekspor gagal", error instanceof Error ? error.message : "Terjadi kesalahan saat mengekspor file.");
    }
  }, [autoFitOnePage, currentPaperSize, documentStyle, downloadPreviewPng, draft, includeSignature, onExport, saveCurrentSignature, selectedFormat, showError, supportsSignature]);
  const mobileWizardSteps = useMemo(
    () => [
      { id: "format" as const, label: "Format" },
      { id: "setup" as const, label: "Pengaturan" },
      { id: "preview" as const, label: "Preview" },
    ],
    [],
  );
  const mobileStepDescription = useMemo(() => {
    if (mobileStep === "format") {
      return "Pilih format hasil akhir, ukuran kertas, dan kebutuhan signature sebelum lanjut mengatur detail.";
    }
    if (mobileStep === "setup") {
      return "Rapikan tampilan dokumen, kolom data, dan blok signature dari panel yang lebih fokus.";
    }
    return "Periksa hasil akhir pada layar penuh sebelum file diekspor.";
  }, [mobileStep]);
  const currentPaperLabel = currentPaperOption?.label ?? currentPaperSize;
  const canConfigureColumns = !!(columnOptions && onColumnOptionChange);
  const canConfigureSignature = supportsSignature;
  const activeColumnCount = columnCount ?? columnOptions?.reduce((total, option) => {
    if (!option.children?.length) return total + (option.checked ? 1 : 0);
    return total + option.children.filter((child) => child.checked).length;
  }, 0) ?? 0;
  const studioSummaryChips = [
    {
      text: activeFormat?.label || "Format",
      tone: getFormatToneClasses(activeFormat?.id || "pdf"),
    },
    {
      text: currentPaperLabel,
      tone: "border-slate-200 bg-slate-50/80 text-slate-700",
    },
    {
      text: canConfigureColumns ? `${activeColumnCount} kolom` : "Kolom tetap",
      tone: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    },
    {
      text: experimentalModeActive ? "Eksperimen aktif" : "Eksperimen standar",
      tone: experimentalModeActive
        ? "border-amber-200 bg-amber-50/80 text-amber-700"
        : "border-slate-200 bg-slate-50/80 text-slate-700",
    },
  ] as const;
  const renderStudioUtilityActions = (compact = false) => (
    <div className={cn("flex flex-wrap gap-2", compact && "w-full")}>
      {onRestoreDefaultMode ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 rounded-lg px-3 text-[10px] sm:text-xs", compact && "flex-1")}
          onClick={handleRestoreDefaultMode}
          title="Kembalikan seluruh studio ke mode default bawaan web, tanpa mengubah ukuran kertas dan identitas signature."
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {defaultModeLabel}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("h-8 rounded-lg px-3 text-[10px] sm:text-xs", compact && "flex-1")}
        onClick={() => setResetLayoutConfirmOpen(true)}
        title="Rapikan ulang layout studio ke susunan awal panel, preview, overlay, dan ukuran panel."
      >
        <ScanSearch className="mr-1.5 h-3.5 w-3.5" />
        Reset Tata Letak
      </Button>
    </div>
  );

  const goToPreviousMobileStep = useCallback(() => {
    setMobileStep((prev) => (prev === "preview" ? "setup" : "format"));
  }, []);
  const goToNextMobileStep = useCallback(() => {
    setMobileStep((prev) => (prev === "format" ? "setup" : "preview"));
  }, []);

  const formatPanelContent = (
    <>
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
              title={`Pilih format ${formatOption.label}. ${formatOption.description}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", getFormatToneClasses(formatOption.id))}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
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
            <p className="mt-2 text-[10px] text-muted-foreground">{recommendedPaperCopy}</p>
          </div>
            <HintInfo
              label="Ukuran kertas"
              description="A4 cocok untuk dokumen umum, F4 memakai ukuran 8,5 x 13 in, Auto menjaga basis A4, dan Full Page membiarkan ukuran halaman mengikuti konten."
            />
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
                title={`Pilih ukuran ${option.label}. ${option.description}${recommended ? " Rekomendasi untuk format aktif." : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold leading-tight text-foreground">{option.label}</p>
                  {active || recommended ? (
                    <span className={cn(
                      "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[8px] font-semibold sm:text-[9px]",
                      active
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-primary/20 bg-primary/[0.06] text-primary/90",
                    )}>
                      {active ? "Aktif" : "Disarankan"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{option.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {formatPanelExtra ? formatPanelExtra : null}
    </>
  );

  const columnsPanelContent = canConfigureColumns ? (
    <ColumnPanel columnOptions={columnOptions} onColumnOptionChange={onColumnOptionChange} />
  ) : (
    <div className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-center text-[11px] text-muted-foreground">
      Pengaturan kolom tidak tersedia untuk format ini.
    </div>
  );

  const signersPanelContent = canConfigureSignature ? (
    <SignerPanel
      draft={draft}
      setDraft={setDraft}
      includeSignature={includeSignature}
      onOpenSignatureStyle={openSignatureStyleWorkspace}
    />
  ) : (
    <div className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-center text-[11px] text-muted-foreground">
      Template ini tidak memakai pengaturan signature.
    </div>
  );

  const stylePanelContent = (
    <StylePanel
      documentStyle={documentStyle}
      onDocumentStyleChange={onDocumentStyleChange}
      autoFitOnePage={autoFitOnePage}
      onAutoFitOnePageChange={onAutoFitOnePageChange}
      showAutoFitPreset={showAutoFitPreset}
      columnTypographyOptions={columnTypographyOptions}
      onOpenExperimentalWindow={openExperimentalWorkspace}
      stylePresetExtra={stylePanelExtra}
      presetMode={stylePresetMode}
      presetBaseline={stylePresetBaseline}
    />
  );

  const positionPanelContent = canConfigureSignature ? (
    <PositionPanel draft={draft} setDraft={setDraft} resolvedPlacement={resolvedSignaturePlacement} />
  ) : (
    <div className="rounded-xl border border-dashed border-border bg-background/70 p-4 text-center text-[11px] text-muted-foreground">
      Template ini tidak memakai pengaturan signature.
    </div>
  );
  const mobileSetupSectionTone = {
    document: {
      icon: Sparkles,
      card: "border-sky-200/70 bg-sky-50/55 dark:border-sky-900/55 dark:bg-sky-950/18",
      header: "bg-sky-50/80 hover:bg-sky-100/70 dark:bg-sky-950/30 dark:hover:bg-sky-950/40",
      iconWrap: "border-sky-200/80 bg-white/90 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/70 dark:text-sky-200",
      badge: "border-sky-200/80 bg-white/90 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/70 dark:text-sky-200",
      content: "border-sky-100/80 bg-white/82 dark:border-sky-900/50 dark:bg-slate-950/32",
      subCards: "[&_.rounded-lg.border]:border-sky-200/60 [&_.rounded-xl.border]:border-sky-200/60 [&_.border-dashed]:border-sky-200/60 dark:[&_.rounded-lg.border]:border-sky-900/45 dark:[&_.rounded-xl.border]:border-sky-900/45 dark:[&_.border-dashed]:border-sky-900/45",
      chevron: "text-sky-600 dark:text-sky-300",
    },
    data: {
      icon: Columns3,
      card: "border-emerald-200/70 bg-emerald-50/55 dark:border-emerald-900/55 dark:bg-emerald-950/18",
      header: "bg-emerald-50/80 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/40",
      iconWrap: "border-emerald-200/80 bg-white/90 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/70 dark:text-emerald-200",
      badge: "border-emerald-200/80 bg-white/90 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/70 dark:text-emerald-200",
      content: "border-emerald-100/80 bg-white/82 dark:border-emerald-900/50 dark:bg-slate-950/32",
      subCards: "[&_.rounded-lg.border]:border-emerald-200/60 [&_.rounded-xl.border]:border-emerald-200/60 [&_.border-dashed]:border-emerald-200/60 dark:[&_.rounded-lg.border]:border-emerald-900/45 dark:[&_.rounded-xl.border]:border-emerald-900/45 dark:[&_.border-dashed]:border-emerald-900/45",
      chevron: "text-emerald-600 dark:text-emerald-300",
    },
    signature: {
      icon: PenTool,
      card: "border-amber-200/70 bg-amber-50/55 dark:border-amber-900/55 dark:bg-amber-950/18",
      header: "bg-amber-50/80 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/40",
      iconWrap: "border-amber-200/80 bg-white/90 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/70 dark:text-amber-200",
      badge: "border-amber-200/80 bg-white/90 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/70 dark:text-amber-200",
      content: "border-amber-100/80 bg-white/82 dark:border-amber-900/50 dark:bg-slate-950/32",
      subCards: "[&_.rounded-lg.border]:border-amber-200/60 [&_.rounded-xl.border]:border-amber-200/60 [&_.border-dashed]:border-amber-200/60 dark:[&_.rounded-lg.border]:border-amber-900/45 dark:[&_.rounded-xl.border]:border-amber-900/45 dark:[&_.border-dashed]:border-amber-900/45",
      chevron: "text-amber-600 dark:text-amber-300",
    },
    signatureStyle: {
      icon: Move,
      card: "border-indigo-200/70 bg-indigo-50/55 dark:border-indigo-900/55 dark:bg-indigo-950/18",
      header: "bg-indigo-50/80 hover:bg-indigo-100/70 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/40",
      iconWrap: "border-indigo-200/80 bg-white/90 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/70 dark:text-indigo-200",
      badge: "border-indigo-200/80 bg-white/90 text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/70 dark:text-indigo-200",
      content: "border-indigo-100/80 bg-white/82 dark:border-indigo-900/50 dark:bg-slate-950/32",
      subCards: "[&_.rounded-lg.border]:border-indigo-200/60 [&_.rounded-xl.border]:border-indigo-200/60 [&_.border-dashed]:border-indigo-200/60 dark:[&_.rounded-lg.border]:border-indigo-900/45 dark:[&_.rounded-xl.border]:border-indigo-900/45 dark:[&_.border-dashed]:border-indigo-900/45",
      chevron: "text-indigo-600 dark:text-indigo-300",
    },
  } satisfies Record<MobileSetupSection, {
    icon: LucideIcon;
    card: string;
    header: string;
    iconWrap: string;
    badge: string;
    content: string;
    subCards: string;
    chevron: string;
  }>;

  const renderPhoneSetupSection = ({
    id,
    title,
    description,
    children,
    disabled = false,
    status,
  }: {
    id: MobileSetupSection;
    title: string;
    description: string;
    children: ReactNode;
    disabled?: boolean;
    status?: string;
  }) => {
    const openSection = mobileSetupSection === id && !disabled;
    const tone = mobileSetupSectionTone[id];
    const SectionIcon = tone.icon;

    return (
      <div
        ref={(node) => {
          mobileSetupSectionRefs.current[id] = node;
        }}
        className={cn("overflow-hidden rounded-2xl border shadow-sm transition-colors", tone.card, disabled && "opacity-80 saturate-75")}
      >
        <button
          type="button"
          className={cn(
            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors",
            tone.header,
            openSection && "shadow-[inset_0_-1px_0_rgba(255,255,255,0.35)]",
          )}
          onClick={() => !disabled && setMobileSetupSection((prev) => (prev === id ? null : id))}
          title={disabled ? `${title} tidak tersedia untuk template ini.` : `${openSection ? "Tutup" : "Buka"} kategori ${title}. ${description}`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-sm", tone.iconWrap)}>
              <SectionIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                {status ? (
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", tone.badge)}>
                    {status}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", tone.chevron, openSection && "rotate-180")} />
        </button>
        {openSection ? (
          <div className={cn("border-t px-3 py-3", tone.content, tone.subCards)}>
            <div className="space-y-3">
              {children}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderPreviewWorkspace = (phoneWizard = false) => (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className={cn(
        "flex flex-col gap-3 border-b border-border px-3 sm:px-4",
        phoneWizard ? "py-3" : isMobileLayout ? "py-2.5" : "py-3 xl:flex-row xl:items-center xl:justify-between",
      )}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Eye className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-foreground">Live Preview</p>
            {!phoneWizard ? (
              <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-semibold", getFormatToneClasses(activeFormat?.id || "pdf"))}>
                {activeFormat?.label || "Format"}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {phoneWizard
              ? "Preview ini memakai state akhir yang sama dengan proses ekspor. Pastikan komposisi dokumen sudah terasa pas."
              : "Preview di bawah ini selalu mengikuti state aktif. Gunakan zoom untuk memeriksa detail sebelum ekspor."}
          </p>
          {phoneWizard ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-semibold", getFormatToneClasses(activeFormat?.id || "pdf"))}>
                {activeFormat?.label || "Format"}
              </span>
              <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] font-medium text-foreground">
                {currentPaperLabel}
              </span>
              {supportsSignature ? (
                <span className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-medium",
                  includeSignature
                    ? "border-primary/20 bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground",
                )}>
                  {includeSignature ? "Signature aktif" : "Tanpa signature"}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={cn(
          "flex w-full gap-2",
          phoneWizard
            ? "flex-wrap items-center"
            : isCompactLayout ? "flex-col" : "flex-wrap items-center sm:w-auto sm:justify-end",
        )}>
          {supportsSignature && includeSignature ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 rounded-full px-3 text-[10px]",
                phoneWizard ? "order-2" : isCompactLayout ? "w-full" : "order-3 sm:order-1",
              )}
              onClick={handleResetSignaturePosition}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset Posisi Signature
            </Button>
          ) : null}
          {canPreview ? (
            <Button
              type="button"
              variant={liveEditMode ? "default" : "outline"}
              size="sm"
              className={cn(
                "h-8 rounded-full px-3 text-[10px]",
                phoneWizard ? "order-3" : isCompactLayout ? "w-full" : "order-3 sm:order-2",
              )}
              onClick={() => {
                if (liveEditMode) {
                  setLiveEditMode(false);
                  setExperimentalWindowOpen(false);
                } else {
                  openExperimentalWorkspace();
                }
              }}
            >
              {liveEditMode ? "Edit Langsung Aktif" : "Edit di Preview"}
            </Button>
          ) : null}
          {experimentalModeActive ? (
            <div className={cn(
              "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-semibold text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200",
              phoneWizard ? "order-4" : isCompactLayout ? "w-full text-center" : "order-2 sm:order-1",
            )}>
              Eksperimental Aktif
            </div>
          ) : null}
          {highlightTarget ? (
            <div className={cn(
              "rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-medium text-primary",
              phoneWizard ? "order-5" : isCompactLayout ? "w-full text-center" : "order-3 sm:order-1",
            )}>
              {highlightTarget.label || (highlightTarget.kind === "column" ? highlightTarget.key : highlightTarget.kind)}
            </div>
          ) : null}
          {!phoneWizard && !isNarrowLayout ? (
            <div className={cn(
              "rounded-full border border-border bg-muted/30 px-3 py-1 text-[10px] text-muted-foreground",
              isCompactLayout ? "w-full text-center" : "order-2 sm:order-1",
            )}>
              Zoom tetap stabil saat panel diubah
            </div>
          ) : null}
          <div className={cn(
            "flex items-center gap-1 rounded-full border border-border bg-background p-1",
            phoneWizard ? "order-1" : isCompactLayout ? "w-full justify-between" : "order-1 sm:order-2",
          )}>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom((prev) => clamp(prev - 10, 25, previewZoomMax))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <div className={cn(
              "flex h-8 items-center justify-center rounded-full border border-border px-2 text-[11px] font-medium text-foreground",
              phoneWizard ? "min-w-16" : isCompactLayout ? "flex-1 min-w-0" : "min-w-16",
            )}>
              {effectivePreviewZoom}%
            </div>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom((prev) => clamp(prev + 10, 25, previewZoomMax))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom(isCompactLayout ? autoPreviewZoom : 100)}>
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 overflow-auto bg-muted/30",
          phoneWizard
            ? "px-2 py-2"
            : isMobileLayout ? "max-h-[min(46dvh,28rem)] px-2 py-2" : "px-2 sm:px-4 py-2 sm:py-4",
        )}
        ref={previewViewportRef}
      >
        {canPreview ? (
          <div className="flex min-h-full flex-col items-center gap-3">
            <div className="flex w-full items-start justify-center">
              <div
                className="origin-top"
                style={{
                  transform: `scale(${effectivePreviewZoom / 100})`,
                  transformOrigin: "top center",
                  width: "fit-content",
                }}
              >
                {renderPreviewContent(previewCaptureRef)}
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
  );
  const showMobilePreviewOverlay = isPhoneWizard && mobileStep !== "preview";
  const mobilePreviewMaxHeight = Math.max(mobileOverlayFrame.height - 116, 96);
  const desktopStudioGridTemplate = !isMobileLayout ? `${desktopPanelWidth}px 14px minmax(0, 1fr)` : undefined;
  const handleDesktopPanelResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMobileLayout) return;

    desktopPanelResizeRef.current = {
      startX: event.clientX,
      startWidth: desktopPanelWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.preventDefault();
  }, [desktopPanelWidth, isMobileLayout]);
  const handleMobileOverlayPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!showMobilePreviewOverlay || mobileOverlayState === "hidden-temporary") return;
    if ((event.target as HTMLElement).closest("[data-overlay-interactive='true']")) return;

    mobileOverlayInteractionRef.current = {
      mode: "drag",
      originX: event.clientX,
      originY: event.clientY,
      startFrame: mobileOverlayFrame,
    };
  }, [mobileOverlayFrame, mobileOverlayState, showMobilePreviewOverlay]);
  const handleMobileOverlayResizePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (!showMobilePreviewOverlay || mobileOverlayState !== "expanded") return;

    mobileOverlayInteractionRef.current = {
      mode: "resize",
      originX: event.clientX,
      originY: event.clientY,
      startFrame: mobileOverlayFrame,
    };
  }, [mobileOverlayFrame, mobileOverlayState, showMobilePreviewOverlay]);
  const handleMobileOverlayPointerMove = useCallback((_event: ReactPointerEvent<HTMLDivElement>) => {}, []);
  const handleMobileOverlayPointerUp = useCallback((_event: ReactPointerEvent<HTMLDivElement>) => {
    mobileOverlayInteractionRef.current = null;
  }, []);
  const restoreMobileOverlay = useCallback(() => {
    setMobileOverlayState(mobileStep === "format" ? "expanded" : "minimized");
  }, [mobileStep]);
  const renderMobilePreviewOverlay = () => {
    if (!showMobilePreviewOverlay) return null;

    if (mobileOverlayState === "hidden-temporary") {
      return (
        <div className="pointer-events-none absolute inset-0 z-[90]">
          <div className="pointer-events-auto absolute bottom-24 right-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-full border-primary/20 bg-background/95 px-3 text-[10px] shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/90"
              onClick={restoreMobileOverlay}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Tampilkan Preview
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="pointer-events-none absolute inset-0 z-[90]">
        <div
          ref={mobileOverlayCardRef}
          className="pointer-events-auto absolute overflow-hidden rounded-[22px] border border-border bg-background/96 p-2 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/90"
          style={{
            left: `${mobileOverlayFrame.left}px`,
            top: `${mobileOverlayFrame.top}px`,
            width: `${mobileOverlayFrame.width}px`,
            height: mobileOverlayState === "expanded" ? `${mobileOverlayFrame.height}px` : "auto",
          }}
          onPointerDown={handleMobileOverlayPointerDown}
        >
          <div className="flex items-start justify-between gap-2 px-1 pb-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-primary" />
                <p className="text-[10px] font-semibold text-foreground">Preview Live</p>
              </div>
              <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                {activeFormat?.label || "Format"} • {currentPaperLabel}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {supportsSignature && includeSignature ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full"
                  data-overlay-interactive="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={handleResetSignaturePosition}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                data-overlay-interactive="true"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setMobileOverlayState((prev) => (prev === "expanded" ? "minimized" : "expanded"))}
              >
                {mobileOverlayState === "expanded" ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronUp className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full"
                data-overlay-interactive="true"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => setMobileOverlayState("hidden-temporary")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {mobileOverlayState === "expanded" ? (
            <>
              <div className="pointer-events-auto flex min-h-0 flex-col gap-2">
                <div className="flex items-center gap-1 rounded-full border border-border bg-background p-1" data-overlay-interactive="true">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setMobileOverlayZoom((prev) => clamp(prev - 10, 15, 200))}
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <div className="flex min-w-0 flex-1 items-center justify-center rounded-full border border-border px-2 text-[10px] font-medium text-foreground">
                    {mobileOverlayZoom}%
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setMobileOverlayZoom((prev) => clamp(prev + 10, 15, 200))}
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => setMobileOverlayZoom(clamp(effectivePreviewZoom, 15, 200))}
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div
                  ref={mobileOverlayViewportRef}
                  data-overlay-interactive="true"
                  className="overflow-auto rounded-[18px] border border-border bg-muted/30 p-1"
                  style={{ height: `${mobilePreviewMaxHeight}px` }}
                >
                  {canPreview ? (
                    <div className="flex min-h-full items-start justify-start">
                      <div
                        className="origin-top-left"
                        style={{
                          transform: `scale(${mobileOverlayZoom / 100})`,
                          transformOrigin: "top left",
                          width: "fit-content",
                        }}
                      >
                        {renderPreviewContent(mobileOverlayCaptureRef)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[96px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/70 p-4 text-center text-[10px] leading-relaxed text-muted-foreground">
                      {noPreviewMessage}
                    </div>
                  )}
                </div>
              </div>

              <div className="pointer-events-auto mt-2 grid grid-cols-2 gap-2" data-overlay-interactive="true">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl text-[10px]"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setMobileOverlayState("minimized")}
                >
                  Ciutkan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 rounded-xl text-[10px]"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setMobileStep("preview")}
                >
                  Buka Preview
                </Button>
              </div>

              <div
                data-overlay-interactive="true"
                className="pointer-events-auto absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm"
                onPointerDown={handleMobileOverlayResizePointerDown}
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </div>
            </>
          ) : (
            <div className="pointer-events-auto flex items-center justify-between gap-2 rounded-2xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-[10px] text-muted-foreground">
              <span className="line-clamp-2">Preview diciutkan agar area pengaturan tetap lega saat Anda mengatur studio.</span>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2 text-[10px]"
                  data-overlay-interactive="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setMobileOverlayState("expanded")}
                >
                  Lihat
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded-full px-2 text-[10px]"
                  data-overlay-interactive="true"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setMobileStep("preview")}
                >
                  Preview
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)} className={cn("gap-1.5", triggerClassName)} disabled={triggerDisabled}>
        <TriggerIcon className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent ref={dialogContentRef} onPointerUpCapture={handleMobilePointerUpCapture} className="flex h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-h-[calc(100dvh-0.75rem)] max-w-[96rem] flex-col gap-0 overflow-hidden rounded-[22px] p-0 sm:h-[min(94dvh,58rem)] sm:w-[calc(100vw-1.5rem)] sm:rounded-[28px]">
          <DialogHeader className="min-w-0 px-4 pb-3 pt-4 sm:px-6 sm:pt-5 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Download className="h-4 w-4 text-primary" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs">
              {description}
            </DialogDescription>
            <div className="mt-3 flex flex-wrap gap-2">
              {studioSummaryChips.map((chip) => (
                <span key={chip.text} className={cn("inline-flex max-w-full items-center justify-center rounded-full border px-2.5 py-1 text-center text-[10px] font-semibold leading-relaxed sm:text-[11px]", chip.tone)}>
                  {chip.text}
                </span>
              ))}
            </div>
          </DialogHeader>

          {isPhoneWizard ? (
            <>
              <div ref={layoutViewportRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                <ExperimentalTypographyWindow
                  open={experimentalWindowOpen}
                  onOpenChange={setExperimentalWindowOpen}
                  documentStyle={documentStyle}
                  onDocumentStyleChange={onDocumentStyleChange}
                  columnTypographyOptions={columnTypographyOptions}
                  isMobile
                  highlightTarget={highlightTarget}
                  selectedHighlightTarget={selectedHighlightTarget}
                  onHighlightTargetHoverChange={setHoverHighlightTarget}
                  onHighlightTargetSelect={(target) => {
                    setHoverHighlightTarget(null);
                    setSelectedHighlightTarget(target);
                  }}
                  layoutResetToken={experimentalLayoutResetToken}
                />

                <div className="border-b border-border bg-muted/20 px-3 py-3 sm:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {mobileStep !== "format" ? (
                      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-2 text-[11px]" onClick={goToPreviousMobileStep}>
                        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                        Kembali
                      </Button>
                    ) : (
                      <div className="h-8" />
                    )}
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
                      Studio Mobile
                    </span>
                  </div>
                  <StudioStepHeader steps={mobileWizardSteps} currentStep={mobileStep} className="mt-2" />
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{mobileStepDescription}</p>
                </div>

                {mobileStep === "format" ? (
                  <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
                    <div className="space-y-4">
                      {supportsSignature ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3">
                          <div className="min-w-0">
                            <Label className="text-sm font-semibold text-foreground">Signature</Label>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              Aktifkan bila hasil ekspor perlu blok signature otomatis.
                            </p>
                          </div>
                          <Switch checked={includeSignature} onCheckedChange={onIncludeSignatureChange} />
                        </div>
                      ) : null}

                      {formatPanelContent}

                      <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground sm:text-xs">Gunakan aksi studio hanya bila perlu.</p>
                          {renderStudioUtilityActions(false)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dashed border-border bg-background/70 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
                        PDF cocok untuk cetak. PNG cocok untuk dibagikan cepat. Excel dan CSV tetap tersedia, tetapi preview visualnya belum dipakai.
                      </div>
                    </div>
                  </div>
                ) : null}

                {mobileStep === "setup" ? (
                  <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4">
                    <div className="space-y-3">
                      {renderPhoneSetupSection({
                        id: "document",
                        title: "Dokumen",
                        description: "Atur style dokumen, tipografi, dan preset tampilan dengan panel yang lebih ringkas.",
                        status: documentStyle ? "Siap diatur" : "Dasar",
                        children: stylePanelContent,
                      })}

                      {renderPhoneSetupSection({
                        id: "data",
                        title: "Data",
                        description: canConfigureColumns
                          ? "Pilih kolom yang ingin muncul di hasil ekspor dan live preview."
                          : "Format ini tidak menyediakan pengaturan kolom.",
                        status: canConfigureColumns ? `${activeColumnCount} kolom` : "Tidak tersedia",
                        disabled: !canConfigureColumns,
                        children: columnsPanelContent,
                      })}

                      {renderPhoneSetupSection({
                        id: "signature",
                        title: "Signature",
                        description: supportsSignature
                          ? "Isi identitas signature dan tanggal. Style serta posisi dipusatkan di tab Style Signature."
                          : "Template ini tidak memakai panel signature.",
                        status: supportsSignature ? `${draft.signers.filter((item) => item.name.trim()).length} signer` : "Tidak tersedia",
                        disabled: !supportsSignature,
                        children: signersPanelContent,
                      })}

                      {renderPhoneSetupSection({
                        id: "signatureStyle",
                        title: "Style Signature",
                        description: supportsSignature
                          ? "Kelola garis, font, alignment, dan posisi signature dari satu panel."
                          : "Template ini tidak memakai panel signature.",
                        status: supportsSignature ? (includeSignature ? "Dipakai saat ekspor" : "Disiapkan") : "Tidak tersedia",
                        disabled: !supportsSignature,
                        children: positionPanelContent,
                      })}
                    </div>
                  </div>
                ) : null}

                {mobileStep === "preview" ? renderPreviewWorkspace(true) : null}

                <StudioActionFooter
                  sticky
                  helperText={
                    mobileStep === "format"
                      ? "Format dan ukuran kertas yang dipilih akan dipakai juga oleh live preview dan file akhir."
                      : mobileStep === "setup"
                        ? "Perubahan di langkah ini langsung memengaruhi preview dan hasil ekspor."
                        : supportsSignature
                          ? "Simpan pengaturan bila ingin menjadikannya default untuk ekspor berikutnya."
                          : "Periksa hasil akhir lalu ekspor saat sudah siap."
                  }
                  actions={(
                    mobileStep === "preview" ? (
                      <>
                        {supportsSignature ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                            className="h-11 gap-1.5 text-xs w-full sm:h-9 sm:w-auto"
                          >
                            <Save className="h-3.5 w-3.5" />
                            Simpan Signature
                          </Button>
                        ) : null}
                        <Button type="button" onClick={handleExport} disabled={!activeFormat || isLoading || isSaving} className="h-11 gap-1.5 text-xs w-full sm:h-9 sm:w-auto">
                          <Download className="h-3.5 w-3.5" />
                          Ekspor {activeFormat?.label || ""}
                        </Button>
                      </>
                    ) : (
                      <>
                        {mobileStep === "setup" ? (
                          <Button type="button" variant="outline" onClick={goToPreviousMobileStep} className="h-11 text-xs w-full sm:h-9 sm:w-auto">
                            Kembali
                          </Button>
                        ) : null}
                        <Button type="button" onClick={goToNextMobileStep} disabled={isLoading || isSaving} className="h-11 gap-1.5 text-xs w-full sm:h-9 sm:w-auto">
                          {mobileStep === "format" ? "Lanjut ke Pengaturan" : "Lanjut ke Preview"}
                        </Button>
                      </>
                    )
                  )}
                />
                {renderMobilePreviewOverlay()}
              </div>
            </>
          ) : (
            <>
          {usesTabbedMobileStudio ? (
            <div className="border-b border-border px-3 py-2">
              <StudioPreviewToggle
                active={activeMobileSection}
                onChange={setActiveMobileSection}
                canPreview={canPreview}
              />
            </div>
          ) : null}

          <div
            ref={layoutViewportRef}
            className={cn(
            "relative flex-1 min-h-0",
            isMobileLayout ? "flex flex-col overflow-hidden" : "flex flex-col lg:grid",
          )}
          style={!isMobileLayout ? { gridTemplateColumns: desktopStudioGridTemplate } : undefined}
          >
            <ExperimentalTypographyWindow
              open={experimentalWindowOpen}
              onOpenChange={setExperimentalWindowOpen}
              documentStyle={documentStyle}
              onDocumentStyleChange={onDocumentStyleChange}
              columnTypographyOptions={columnTypographyOptions}
              isMobile={isMobileLayout}
              highlightTarget={highlightTarget}
              selectedHighlightTarget={selectedHighlightTarget}
              onHighlightTargetHoverChange={setHoverHighlightTarget}
              onHighlightTargetSelect={(target) => {
                setHoverHighlightTarget(null);
                setSelectedHighlightTarget(target);
              }}
              layoutResetToken={experimentalLayoutResetToken}
            />

            <div className={cn(
              "border-border bg-muted/20 min-h-0 flex flex-col",
              isMobileLayout
                ? cn(
                    "order-1 flex-1 overflow-hidden",
                    activeMobileSection === "panel" ? "flex" : "hidden",
                )
                : cn("order-2 border-t lg:order-1 lg:border-t-0 lg:border-r shadow-[inset_-1px_0_0_rgba(148,163,184,0.12)]", activeDesktopPanelTone.shell),
            )}>
              <div
                className={cn(
                  "m-2 min-h-0 flex flex-1 flex-col overflow-hidden rounded-[28px] border border-border/80 bg-background/92 shadow-[0_28px_60px_-42px_rgba(15,23,42,0.82)]",
                  !isMobileLayout && "backdrop-blur",
                )}
              >
                <Collapsible
                  open={studioTopTrayExpanded}
                  onOpenChange={handleStudioTopTrayExpandedChange}
                  className={cn(
                    "shrink-0 border-b border-border/70 px-2.5 sm:px-3",
                    isMobileLayout ? "pt-1.5 pb-1.5" : "bg-background/94 pt-1.5 pb-1.5",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground">Panel studio</p>
                      <p className="mt-0.5 hidden text-[9px] leading-tight text-muted-foreground lg:block">
                        Ringkasan kontrol utama. Alat studio tetap berada di panel yang sama dan tetap terlihat saat bagian ini diciutkan.
                      </p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 rounded-full px-3 text-[10px] sm:text-xs"
                        title={studioTopTrayExpanded ? "Ciutkan panel ringkas studio." : "Buka kembali panel ringkas studio."}
                      >
                        {studioTopTrayExpanded ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
                        {studioTopTrayExpanded ? "Ciutkan" : "Buka"}
                      </Button>
                    </CollapsibleTrigger>
                  </div>

                  {!studioTopTrayExpanded ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {!isMobileLayout ? (
                        <span className={cn("max-w-full rounded-full border px-2 py-0.5 text-[9px] font-semibold leading-tight", activeDesktopPanelTone.badge)}>
                          {activePanelMeta.label}
                        </span>
                      ) : null}
                      {supportsSignature ? (
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                          {includeSignature ? "Signature aktif" : "Tanpa signature"}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <CollapsibleContent className="mt-1.5 space-y-1.5">
                    {(supportsSignature || onRestoreDefaultMode) ? (
                      <div className="space-y-1">
                        {supportsSignature ? (
                          <div className={cn(
                            "flex items-center justify-between gap-2 rounded-xl border border-border bg-background",
                            isMobileLayout ? "px-2 py-1.5" : cn("px-2.5 py-1.5", activeDesktopPanelTone.card),
                          )}>
                            <div className="min-w-0">
                              <Label className="text-[11px] font-semibold text-foreground">Signature</Label>
                              <p className="mt-0 text-[9px] leading-tight text-muted-foreground md:hidden xl:block">
                                Sertakan blok signature pada file ekspor.
                              </p>
                            </div>
                            <Switch checked={includeSignature} onCheckedChange={onIncludeSignatureChange} />
                          </div>
                        ) : null}
                        <div className={cn(
                          "rounded-xl border border-border bg-background/80",
                          isMobileLayout ? "px-2 py-1.5" : cn("px-2.5 py-1.5", activeDesktopPanelTone.card),
                        )}>
                          <div className={cn(
                            "flex gap-1.5",
                            isMobileLayout ? "flex-col gap-1" : "flex-wrap items-center justify-between",
                          )}>
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold text-foreground">Aksi studio</p>
                              <p className="mt-0 text-[9px] leading-tight text-muted-foreground md:hidden xl:block">
                                Kembalikan mode awal atau rapikan layout.
                              </p>
                            </div>
                            {renderStudioUtilityActions(isMobileLayout)}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </CollapsibleContent>
                </Collapsible>

                <div className={cn("shrink-0 border-b border-border/70 bg-background/88 px-2.5 sm:px-3", isMobileLayout ? "py-1.5" : "py-1.5")}>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-[10px] font-semibold text-foreground">Alat studio</p>
                        {!isMobileLayout ? (
                          <span className={cn("max-w-full rounded-full border px-2 py-0.5 text-[9px] font-semibold leading-tight", activeDesktopPanelTone.badge)}>
                            {activePanelMeta.label}
                          </span>
                        ) : null}
                      </div>
                      <p className="hidden text-[10px] text-muted-foreground xl:block">Tab tetap tampil di dalam panel studio agar ruang kerja alat tetap luas.</p>
                    </div>
                    <div className={cn("-mx-1 px-1 pt-0.5 pb-0.5", isMobileLayout ? "overflow-visible" : "overflow-x-auto overflow-y-visible")}>
                      {isMobileLayout ? (
                        <StudioSectionTabs
                          sections={panelSections}
                          active={activePanel}
                          onChange={(next) => {
                            if ((next === "signature" || next === "signatureStyle") && !supportsSignature) return;
                            switchPanel(next);
                          }}
                        />
                      ) : (
                        <div className="grid min-w-max auto-cols-max grid-flow-col gap-2 lg:flex lg:min-w-0 lg:flex-wrap">
                          {panelSections.map(({ id, label, icon: Icon }) => {
                            const enabled = !((id === "signature" || id === "signatureStyle") && !supportsSignature);
                            return (
                              <Button
                                key={id}
                                type="button"
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-auto min-h-9 min-w-fit shrink-0 rounded-full px-3 py-2 justify-start gap-1.5 text-[10px] leading-tight sm:text-xs",
                                  !isMobileLayout && (activePanel === id ? activeDesktopPanelTone.activeTab : activeDesktopPanelTone.idleTab),
                                  !enabled && "opacity-50",
                                )}
                                onClick={() => enabled && switchPanel(id)}
                                disabled={!enabled}
                                title={enabled ? `Buka tab ${label} di panel alat studio.` : `Tab ${label} tidak tersedia untuk template ini.`}
                              >
                                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                                {label}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                <div
                  ref={panelScrollRef}
                  className={cn(
                    "h-full overflow-y-auto space-y-3",
                    isMobileLayout
                      ? "px-3 py-3 pb-44 sm:px-4"
                      : "px-3 py-2.5 pr-2 sm:px-3.5 sm:py-3",
                  )}
                >
                {activePanel === "format" ? (
                  <>
                    <div className={cn("rounded-xl border border-border bg-background/80 p-3", !isMobileLayout && activeDesktopPanelTone.card)}>
                      <p className="text-[11px] font-semibold text-foreground">Format ekspor</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Pilih format hasil akhir dan ukuran halaman. Perubahan langsung masuk ke live preview.
                      </p>
                    </div>
                    {formatPanelContent}

                    <div className="rounded-xl border border-dashed border-border bg-background/60 p-3">
                      <p className="text-[11px] font-semibold text-foreground">Hint studio</p>
                      <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
                        <div>PDF cocok untuk cetak dan dokumen resmi.</div>
                        <div>PNG HD cocok untuk dibagikan cepat, sedangkan PNG 4K cocok untuk kualitas tinggi.</div>
                        <div>Excel dan CSV tetap tersedia, namun preview visualnya belum dipakai agar struktur tabel spreadsheet bisa didesain ulang nanti.</div>
                      </div>
                    </div>
                  </>
                ) : null}

                {activePanel === "columns" && columnOptions && onColumnOptionChange ? (
                  <ColumnPanel columnOptions={columnOptions} onColumnOptionChange={onColumnOptionChange} />
                ) : null}

                {activePanel === "signature" ? (
                  signersPanelContent
                ) : null}

                {activePanel === "style" ? (
                  stylePanelContent
                ) : null}

                {activePanel === "signatureStyle" ? (
                  positionPanelContent
                ) : null}
              </div>
              </div>
            </div>
            </div>

            {!isMobileLayout ? (
              <div className="relative hidden lg:flex lg:order-2 lg:min-h-0 lg:items-stretch lg:justify-center">
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label="Ubah lebar panel alat studio"
                  className="group flex w-[14px] cursor-col-resize touch-none items-center justify-center"
                  onPointerDown={handleDesktopPanelResizeStart}
                >
                  <div className="flex h-full w-[6px] items-center justify-center rounded-full bg-border/60 transition-colors group-hover:bg-primary/25">
                    <GripVertical className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                </div>
              </div>
            ) : null}

            <div className={cn(
              "flex flex-col bg-background min-h-0",
              isMobileLayout
                ? cn(
                    "order-1 flex-1 overflow-hidden",
                    activeMobileSection === "preview" ? "flex" : "hidden",
                  )
                : "order-1 min-h-[18rem] lg:order-3",
            )}>
              <div className="border-b border-border px-3 py-3 sm:px-4">
                <div className={cn("flex gap-3", isMobileLayout ? "flex-col" : "flex-col xl:flex-row xl:items-start xl:justify-between")}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Eye className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">Live Preview</p>
                    <span className={cn("max-w-full rounded-full border px-2.5 py-1 text-[10px] font-semibold leading-relaxed sm:text-[11px]", getFormatToneClasses(activeFormat?.id || "pdf"))}>
                      {activeFormat?.label || "Format"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                    Preview di bawah ini selalu mengikuti state aktif. Gunakan zoom untuk memeriksa detail sebelum ekspor.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {experimentalModeActive ? (
                      <div className="max-w-full rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold leading-relaxed text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200 sm:text-[11px]">
                        Eksperimental Aktif
                      </div>
                    ) : null}
                    {highlightTarget ? (
                      <div className="max-w-full rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-medium leading-relaxed text-primary sm:text-[11px]">
                        Target aktif: {highlightTarget.label || (highlightTarget.kind === "column" ? highlightTarget.key : highlightTarget.kind)}
                      </div>
                    ) : null}
                    {!isNarrowLayout ? (
                      <div className="max-w-full rounded-full border border-border bg-muted/30 px-3 py-1.5 text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
                        Zoom tetap stabil saat panel diubah
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={cn(
                  "flex w-full min-w-0 gap-2",
                  isCompactLayout ? "flex-col" : "flex-wrap items-center xl:w-auto xl:justify-end",
                )}>
                  {supportsSignature && includeSignature ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn("min-h-9 rounded-full px-3 py-1.5 text-[11px] whitespace-normal text-center leading-relaxed sm:text-xs", isCompactLayout ? "w-full" : "order-2")}
                      onClick={handleResetSignaturePosition}
                      title="Kembalikan blok signature ke posisi default di layout preview."
                    >
                      <RotateCcw className="mr-1 h-3.5 w-3.5" />
                      Reset Posisi Signature
                    </Button>
                  ) : null}
                  {canPreview ? (
                    <Button
                      type="button"
                      variant={liveEditMode ? "default" : "outline"}
                      size="sm"
                      className={cn("min-h-9 rounded-full px-3 py-1.5 text-[11px] whitespace-normal text-center leading-relaxed sm:text-xs", isCompactLayout ? "w-full" : "order-2")}
                      onClick={() => {
                        if (liveEditMode) {
                          setLiveEditMode(false);
                          setExperimentalWindowOpen(false);
                        } else {
                          openExperimentalWorkspace();
                        }
                      }}
                      title={liveEditMode ? "Matikan mode edit langsung di preview." : "Aktifkan mode edit langsung agar perubahan dan highlight bisa dicek langsung di preview."}
                    >
                      {liveEditMode ? "Edit Langsung Aktif" : "Edit di Preview"}
                    </Button>
                  ) : null}
                  <div className={cn(
                    "flex items-center gap-1 rounded-full border border-border bg-background p-1",
                    isCompactLayout ? "w-full justify-between" : "order-1",
                  )}>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom((prev) => clamp(prev - 10, 25, previewZoomMax))} title="Perkecil zoom live preview 10 persen.">
                      <ZoomOut className="h-3.5 w-3.5" />
                    </Button>
                      <div className={cn(
                        "flex h-8 items-center justify-center rounded-full border border-border px-2 text-[11px] font-medium text-foreground",
                        isCompactLayout ? "flex-1 min-w-0" : "min-w-16",
                      )}>
                        {effectivePreviewZoom}%
                    </div>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom((prev) => clamp(prev + 10, 25, previewZoomMax))} title="Perbesar zoom live preview 10 persen.">
                      <ZoomIn className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setPreviewZoom(isCompactLayout ? autoPreviewZoom : 100)} title="Kembalikan zoom preview ke posisi fit atau 100 persen.">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                </div>
              </div>

              <div className={cn(
                "flex-1 overflow-auto bg-muted/30",
                isMobileLayout ? "max-h-[min(52dvh,32rem)] px-2 py-2" : "px-2 py-2 sm:px-4 sm:py-4",
              )} ref={previewViewportRef}>
                {canPreview ? (
                  <div className="flex min-h-full flex-col items-center gap-3">
                    <div className="flex w-full items-start justify-center">
                      <div
                        className="origin-top"
                        style={{
                          transform: `scale(${effectivePreviewZoom / 100})`,
                          transformOrigin: "top center",
                          width: "fit-content",
                        }}
                      >
                        {renderPreviewContent(previewCaptureRef)}
                      </div>
                    </div>
                    {previewFooter ? <div className="w-full max-w-[min(100%,70rem)]">{previewFooter}</div> : null}
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

          {showMobilePreviewOverlay ? (
            <div className="pointer-events-none absolute inset-0 z-[90] lg:hidden">
              <div
                ref={mobileOverlayCardRef}
                className="pointer-events-auto absolute overflow-hidden rounded-[22px] border border-border bg-background/96 p-2 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/90"
                style={{
                  left: `${mobileOverlayFrame.left}px`,
                  top: `${mobileOverlayFrame.top}px`,
                  width: `${mobileOverlayFrame.width}px`,
                  height: mobileOverlayState === "expanded" ? `${mobileOverlayFrame.height}px` : "auto",
                }}
                onPointerDown={handleMobileOverlayPointerDown}
                onPointerMove={handleMobileOverlayPointerMove}
                onPointerUp={handleMobileOverlayPointerUp}
                onPointerCancel={handleMobileOverlayPointerUp}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 px-1 pb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-primary" />
                      <p className="text-[11px] font-semibold text-foreground">Preview Live</p>
                    </div>
                    <p className="mt-1 break-words text-[10px] leading-relaxed text-muted-foreground">
                      {activeFormat?.label || "Format"} • {recommendedPaperOption?.label || currentPaperSize}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {supportsSignature && includeSignature ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        data-overlay-interactive="true"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={handleResetSignaturePosition}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      data-overlay-interactive="true"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setMobileOverlayState((prev) => (prev === "expanded" ? "minimized" : "expanded"))}
                    >
                      {mobileOverlayState === "expanded" ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      data-overlay-interactive="true"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setMobileOverlayState("hidden-temporary")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {mobileOverlayState === "expanded" ? (
                  <>
                    <div className="pointer-events-auto flex min-h-0 flex-col gap-2">
                      <div className="flex items-center gap-1.5 rounded-full border border-border bg-background p-1" data-overlay-interactive="true">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => setMobileOverlayZoom((prev) => clamp(prev - 10, 15, 200))}
                        >
                          <ZoomOut className="h-3.5 w-3.5" />
                        </Button>
                        <div className="flex min-w-0 flex-1 items-center justify-center rounded-full border border-border px-2 text-[11px] font-medium text-foreground">
                          {mobileOverlayZoom}%
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => setMobileOverlayZoom(effectivePreviewZoom)}
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 rounded-full"
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => setMobileOverlayZoom((prev) => clamp(prev + 10, 15, 200))}
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div
                        ref={mobileOverlayViewportRef}
                        data-overlay-interactive="true"
                        className="overflow-auto rounded-[18px] border border-border bg-muted/30 p-1"
                        style={{ height: `${mobilePreviewMaxHeight}px` }}
                      >
                        <div className="flex min-h-full items-start justify-start">
                          <div
                            className="origin-top-left"
                            style={{
                              transform: `scale(${mobileOverlayZoom / 100})`,
                              transformOrigin: "top left",
                              width: "fit-content",
                            }}
                          >
                            {renderPreviewContent(mobileOverlayCaptureRef)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pointer-events-auto mt-2 grid grid-cols-1 gap-2" data-overlay-interactive="true">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-10 rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setActiveMobileSection("preview")}
                      >
                        Perbesar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="min-h-10 rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => setActiveMobileSection("preview")}
                      >
                        Buka Preview
                      </Button>
                    </div>

                    <div
                      data-overlay-interactive="true"
                      className="pointer-events-auto absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm"
                      onPointerDown={handleMobileOverlayResizePointerDown}
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </div>
                  </>
                ) : (
                  <div className="pointer-events-auto flex flex-col items-stretch gap-2 rounded-2xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    <span>Preview diciutkan agar panel tetap lega saat Anda mengatur alat.</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-3 text-[11px]"
                      data-overlay-interactive="true"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setActiveMobileSection("preview")}
                    >
                      Lihat
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <StudioActionFooter
            sticky={isMobileLayout}
            helperText={
              supportsSignature
                ? "Simpan pengaturan bila ingin menjadikannya default untuk ekspor berikutnya."
                : "Anda tetap bisa mengekspor tanpa signature."
            }
            actions={(
              <>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} className="h-11 w-full text-xs sm:h-9 sm:min-w-[9rem] sm:w-auto sm:text-[11px]">
                  Tutup
                </Button>
                {supportsSignature ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSave}
                    disabled={isSaving || isLoading}
                    className="h-11 w-full gap-1.5 text-xs sm:h-9 sm:min-w-[11rem] sm:w-auto sm:text-[11px]"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Simpan Signature
                  </Button>
                ) : null}
                <Button type="button" onClick={handleExport} disabled={!activeFormat || isLoading || isSaving} className="h-11 w-full gap-1.5 text-xs sm:h-9 sm:min-w-[10rem] sm:w-auto sm:text-[11px]">
                  <Download className="h-3.5 w-3.5" />
                  Ekspor {activeFormat?.label || ""}
                </Button>
              </>
            )}
          />
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={resetLayoutConfirmOpen} onOpenChange={setResetLayoutConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset tata letak studio?</AlertDialogTitle>
            <AlertDialogDescription>
              Posisi overlay live preview, zoom, panel aktif, langkah mobile, lebar panel alat studio, dan posisi jendela Studio Eksperimen akan dikembalikan ke tata letak awal.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetLayoutOnly}>
              Reset Tata Letak
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
