import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SliderWithButtons } from "@/components/ui/slider-with-buttons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useEnhancedToast } from "@/contexts/ToastContext";
import {
  type SignatureSettingsConfig,
  type SignatureSigner,
  type SignatureAlignment,
  createDefaultSignatureConfig,
  createEmptySignatureSigner,
  hasValidSignatureConfig,
  formatSignatureDisplayDate,
} from "@/hooks/useSignatureSettings";
import { SignaturePreviewCanvas, type SignaturePreviewData } from "@/components/export/SignaturePreviewCanvas";
import {
  AlignLeft, AlignCenter, AlignRight,
  ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
  CalendarIcon, Eye, GripVertical, Maximize2,
  Lock, Move, PenTool, Plus, RotateCcw, Save, Trash2,
  ZoomIn, ZoomOut,
} from "lucide-react";
import { createDefaultReportDocumentStyle, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";

interface SignatureExportPanelProps {
  includeSignature: boolean;
  onIncludeSignatureChange: (value: boolean) => void;
  signatureConfig: SignatureSettingsConfig | null;
  hasSignature: boolean;
  isLoading: boolean;
  isSaving: boolean;
  onSaveSignature: (config: SignatureSettingsConfig) => Promise<unknown>;
  documentStyle?: ReportDocumentStyle;
  onDocumentStyleChange?: Dispatch<SetStateAction<ReportDocumentStyle>>;
  previewData?: SignaturePreviewData;
  autoFitOnePage?: boolean;
  onAutoFitOnePageChange?: (value: boolean) => void;
}

export function SignatureExportPanel({
  includeSignature,
  onIncludeSignatureChange,
  signatureConfig,
  hasSignature,
  isLoading,
  isSaving,
  onSaveSignature,
  documentStyle: documentStyleProp,
  onDocumentStyleChange: onDocumentStyleChangeProp,
  previewData,
  autoFitOnePage,
  onAutoFitOnePageChange,
}: SignatureExportPanelProps) {
  const [internalDocStyle, setInternalDocStyle] = useState<ReportDocumentStyle>(createDefaultReportDocumentStyle());
  const documentStyle = documentStyleProp ?? internalDocStyle;
  const onDocumentStyleChange = onDocumentStyleChangeProp ?? setInternalDocStyle;
  const { success, error: showError } = useEnhancedToast();
  const [openEditor, setOpenEditor] = useState(false);
  const [draft, setDraft] = useState<SignatureSettingsConfig>(createDefaultSignatureConfig());
  const [previewFormat, setPreviewFormat] = useState<"pdf" | "png">("pdf");
  const [activePanel, setActivePanel] = useState<"signers" | "style" | "position">("signers");
  const [previewZoom, setPreviewZoom] = useState(100);

  useEffect(() => {
    if (signatureConfig) setDraft({ ...createDefaultSignatureConfig(), ...signatureConfig });
  }, [signatureConfig]);

  useEffect(() => {
    if (openEditor) {
      setDraft(signatureConfig ? { ...createDefaultSignatureConfig(), ...signatureConfig } : createDefaultSignatureConfig());
      // Only reset zoom when first opening the editor
      setPreviewZoom(100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEditor]);

  const signerCount = useMemo(() => draft.signers.filter((s) => s.name.trim()).length, [draft.signers]);

  const setSigner = (index: number, field: keyof SignatureSigner, value: string) => {
    setDraft((prev) => ({
      ...prev,
      signers: prev.signers.map((signer, i) => (i === index ? { ...signer, [field]: value } : signer)),
    }));
  };

  const addSigner = () => {
    if (draft.signers.length >= 4) return;
    setDraft((prev) => ({ ...prev, signers: [...prev.signers, createEmptySignatureSigner()] }));
  };

  const removeSigner = (index: number) => {
    setDraft((prev) => {
      const next = prev.signers.filter((_, i) => i !== index);
      return { ...prev, signers: next.length > 0 ? next : [createEmptySignatureSigner()] };
    });
  };

  const moveSigner = (index: number, direction: "up" | "down") => {
    setDraft((prev) => {
      const newSigners = [...prev.signers];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newSigners.length) return prev;
      [newSigners[index], newSigners[targetIndex]] = [newSigners[targetIndex], newSigners[index]];
      return { ...prev, signers: newSigners };
    });
  };

  // Position nudge — 1mm per step
  const nudgePosition = useCallback((axis: 'x' | 'y', delta: number) => {
    setDraft((prev) => ({
      ...prev,
      ...(axis === 'x'
        ? { signatureOffsetX: Math.max(-80, Math.min(80, prev.signatureOffsetX + delta)) }
        : { signatureOffsetY: Math.max(-40, Math.min(60, prev.signatureOffsetY + delta)) }),
    }));
  }, []);

  const resetPosition = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      signatureOffsetX: 0,
      signatureOffsetY: 0,
      signatureAlignment: 'right',
      placementMode: 'adaptive',
      signaturePreset: 'bottom-right',
      manualXPercent: null,
      manualYPercent: null,
      snapToGrid: true,
      gridSizeMm: 5,
      lockSignaturePosition: false,
      showDebugGuides: false,
    }));
  }, []);

  const handleSave = async () => {
    if (!hasValidSignatureConfig(draft)) {
      showError("Tanda tangan belum lengkap", "Isi kota dan minimal 1 nama penanda tangan.");
      return;
    }
    try {
      await onSaveSignature(draft);
      success("Pengaturan tanda tangan disimpan");
      onIncludeSignatureChange(true);
      setOpenEditor(false);
    } catch (err: any) {
      showError("Gagal menyimpan", err?.message || "Terjadi kesalahan");
    }
  };

  const previewDate = draft.useCustomDate && draft.customDate
    ? formatSignatureDisplayDate(draft.customDate)
    : formatSignatureDisplayDate();

  return (
    <Card className="mb-3 sm:mb-4 border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox
          id="includeSignature"
          checked={includeSignature}
          disabled={isLoading}
          onCheckedChange={(checked) => onIncludeSignatureChange(!!checked)}
        />
        <Label htmlFor="includeSignature" className="text-xs sm:text-sm cursor-pointer flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-primary" />
          {hasSignature ? "Sertakan tanda tangan resmi" : "Sertakan tanda tangan (belum diatur)"}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-[11px] sm:text-xs ml-auto"
          onClick={() => setOpenEditor(true)}
        >
          <Eye className="w-3.5 h-3.5 mr-1" />
          Edit
        </Button>
      </div>

      {hasSignature && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {signatureConfig?.city || "-"} • {signatureConfig?.signers?.filter((s) => s.name.trim()).length || 0} penanda tangan • {previewDate}
        </p>
      )}

      <Dialog open={openEditor} onOpenChange={setOpenEditor}>
        <DialogContent className="sm:max-w-6xl max-h-[92dvh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 flex-shrink-0 border-b border-border">
            <DialogTitle className="text-sm sm:text-base flex items-center gap-2">
              <PenTool className="w-4 h-4 text-primary" />
              Editor Tanda Tangan Ekspor
            </DialogTitle>
            <DialogDescription className="text-[11px] sm:text-xs">
              Atur penanda tangan, gaya visual, dan posisi tanda tangan secara presisi dengan live preview.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-0">
            {/* ═══ LEFT: TABBED CONTROLS ═══ */}
            <div className="border-r border-border flex flex-col overflow-hidden">
              {/* Panel tabs */}
              <div className="flex border-b border-border flex-shrink-0">
                {([
                  { key: 'signers', label: 'Penanda Tangan', icon: '✍️' },
                  { key: 'style', label: 'Gaya', icon: '🎨' },
                  { key: 'position', label: 'Posisi', icon: '📐' },
                ] as const).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActivePanel(tab.key)}
                    className={cn(
                      "flex-1 px-2 py-2 text-[10px] sm:text-[11px] font-medium transition-colors",
                      "border-b-2 hover:bg-muted/50",
                      activePanel === tab.key
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground"
                    )}
                  >
                    <span className="mr-0.5">{tab.icon}</span> {tab.label}
                  </button>
                ))}
              </div>

              {/* Panel content — scrollable */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activePanel === "signers" && (
                  <SignerPanel
                    draft={draft}
                    setDraft={setDraft}
                    setSigner={setSigner}
                    addSigner={addSigner}
                    removeSigner={removeSigner}
                    moveSigner={moveSigner}
                    signerCount={signerCount}
                  />
                )}
                {activePanel === "style" && (
                  <StylePanel
                    draft={draft}
                    setDraft={setDraft}
                    documentStyle={documentStyle}
                    onDocumentStyleChange={onDocumentStyleChange}
                    autoFitOnePage={autoFitOnePage}
                    onAutoFitOnePageChange={onAutoFitOnePageChange}
                  />
                )}
                {activePanel === "position" && (
                  <PositionPanel
                    draft={draft}
                    setDraft={setDraft}
                    nudgePosition={nudgePosition}
                    resetPosition={resetPosition}
                  />
                )}
              </div>
            </div>

            {/* ═══ RIGHT: INTERACTIVE PREVIEW ═══ */}
            <div className="flex flex-col overflow-hidden bg-muted/20">
              {/* Preview toolbar */}
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border flex-shrink-0 bg-background/50">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Preview</p>
                  <Tabs value={previewFormat} onValueChange={(v) => setPreviewFormat(v as "pdf" | "png")}>
                    <TabsList className="h-6">
                      <TabsTrigger value="pdf" className="text-[10px] h-5 px-2">PDF</TabsTrigger>
                      <TabsTrigger value="png" className="text-[10px] h-5 px-2">PNG</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom(z => Math.max(25, z - 10))}>
                        <ZoomOut className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">Perkecil</TooltipContent>
                  </Tooltip>
                  <span className="text-[10px] text-muted-foreground min-w-[32px] text-center">{previewZoom}%</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom(z => Math.min(200, z + 10))}>
                        <ZoomIn className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">Perbesar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewZoom(100)}>
                        <Maximize2 className="w-3 h-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[10px]">Reset zoom</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Preview canvas — scrollable */}
              <div className="flex-1 overflow-auto p-3 sm:p-4">
                <div className="flex justify-center">
                  <div
                    className="origin-top transition-transform"
                    style={{
                      transform: `scale(${previewZoom / 100})`,
                      transformOrigin: "top center",
                    }}
                  >
                    <SignaturePreviewCanvas
                      previewFormat={previewFormat}
                      draft={draft}
                      setDraft={setDraft}
                      previewDate={previewDate}
                      previewData={previewData}
                    />
                  </div>
                </div>
              </div>

              <div className="px-3 py-1 border-t border-border flex-shrink-0 flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground max-w-[70%] truncate">
                  {previewData
                    ? `Preview nyata • ${previewData.studentCount} siswa • ${previewData.columns.length} kolom • mode ${draft.placementMode}`
                    : `Preview generik • offset X=${draft.signatureOffsetX}mm, Y=${draft.signatureOffsetY}mm`}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  Preset: {draft.signaturePreset === 'bottom-left' ? 'Bawah kiri' : draft.signaturePreset === 'bottom-center' ? 'Bawah tengah' : draft.signaturePreset === 'follow-content' ? 'Ikut konten' : 'Bawah kanan'}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="px-4 py-3 border-t border-border flex-shrink-0 gap-2">
            <Button variant="outline" onClick={() => setOpenEditor(false)} size="sm">Batal</Button>
            <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-1.5">
              <Save className="w-3.5 h-3.5" />
              Simpan Pengaturan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
   PANEL: Penanda Tangan
   ═══════════════════════════════════════════════════════ */
function SignerPanel({
  draft, setDraft, setSigner, addSigner, removeSigner, moveSigner, signerCount,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  setSigner: (i: number, f: keyof SignatureSigner, v: string) => void;
  addSigner: () => void;
  removeSigner: (i: number) => void;
  moveSigner: (i: number, d: "up" | "down") => void;
  signerCount: number;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-xs">Kota <span className="text-destructive">*</span></Label>
        <Input
          value={draft.city}
          onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
          placeholder="Banjarmasin"
          className="h-8 text-xs"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-2">
        <div>
          <Label className="text-[11px]">Tanggal custom</Label>
          <p className="text-[9px] text-muted-foreground">Matikan untuk tanggal otomatis</p>
        </div>
        <Switch
          checked={draft.useCustomDate}
          onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, useCustomDate: checked, customDate: checked ? prev.customDate : null }))}
        />
      </div>

      {draft.useCustomDate && (
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
      )}

      <Separator />

      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">Penanda tangan ({signerCount})</Label>
        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px]" onClick={addSigner} disabled={draft.signers.length >= 4}>
          <Plus className="w-3 h-3 mr-0.5" /> Tambah
        </Button>
      </div>

      <div className="space-y-2">
        {draft.signers.map((signer, index) => (
          <div key={signer.id} className="rounded-lg border border-border p-2 space-y-1.5 bg-background/50">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                <GripVertical className="w-3 h-3" />
                #{index + 1}
                {index === 0 && <span className="text-primary text-[8px]">(Utama)</span>}
              </p>
              <div className="flex items-center gap-0.5">
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveSigner(index, "up")} disabled={index === 0}>
                  <ArrowUp className="w-2.5 h-2.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => moveSigner(index, "down")} disabled={index === draft.signers.length - 1}>
                  <ArrowDown className="w-2.5 h-2.5" />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => removeSigner(index)} disabled={draft.signers.length <= 1}>
                  <Trash2 className="w-2.5 h-2.5" />
                </Button>
              </div>
            </div>
            <Input value={signer.title} onChange={(e) => setSigner(index, "title", e.target.value)} placeholder="Jabatan" className="h-7 text-[11px]" />
            <Input value={signer.name} onChange={(e) => setSigner(index, "name", e.target.value)} placeholder="Nama lengkap" className="h-7 text-[11px]" />
            <Input value={signer.nip} onChange={(e) => setSigner(index, "nip", e.target.value)} placeholder="NIP (opsional)" className="h-7 text-[11px]" />
            {index === 0 && (
              <Input value={signer.school_name} onChange={(e) => setSigner(index, "school_name", e.target.value)} placeholder="Nama sekolah (opsional)" className="h-7 text-[11px]" />
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   PANEL: Gaya Visual
   ═══════════════════════════════════════════════════════ */
function StylePanel({
  draft, setDraft, documentStyle, onDocumentStyleChange, autoFitOnePage, onAutoFitOnePageChange,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  documentStyle: ReportDocumentStyle;
  onDocumentStyleChange: Dispatch<SetStateAction<ReportDocumentStyle>>;
  autoFitOnePage?: boolean;
  onAutoFitOnePageChange?: (value: boolean) => void;
}) {
  return (
    <>
      <div className="rounded-lg border border-border p-2.5 space-y-2 bg-background/40">
        <div>
          <Label className="text-[11px] font-semibold">Tipografi Dokumen</Label>
          <p className="text-[9px] text-muted-foreground">
            Atur ukuran judul, header tabel, dan isi tabel. Preview akan menyesuaikan secara realtime.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px]">Judul dokumen ({documentStyle.titleFontSize}pt)</Label>
          <SliderWithButtons
            value={documentStyle.titleFontSize}
            min={4} max={36} step={1}
            onValueChange={(v) => onDocumentStyleChange((prev) => ({ ...prev, titleFontSize: v }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px]">Info dokumen ({documentStyle.metaFontSize}pt)</Label>
          <SliderWithButtons
            value={documentStyle.metaFontSize}
            min={4} max={24} step={1}
            onValueChange={(v) => onDocumentStyleChange((prev) => ({ ...prev, metaFontSize: v }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px]">Header tabel ({documentStyle.tableHeaderFontSize}pt)</Label>
          <SliderWithButtons
            value={documentStyle.tableHeaderFontSize}
            min={4} max={24} step={1}
            onValueChange={(v) => onDocumentStyleChange((prev) => ({ ...prev, tableHeaderFontSize: v }))}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px]">Isi tabel ({documentStyle.tableBodyFontSize}pt)</Label>
          <SliderWithButtons
            value={documentStyle.tableBodyFontSize}
            min={4} max={24} step={1}
            onValueChange={(v) => onDocumentStyleChange((prev) => ({ ...prev, tableBodyFontSize: v }))}
          />
          <p className="text-[9px] text-muted-foreground">
            Rekomendasi keterbacaan: 11-12pt. Jika kolom terlalu banyak, sistem akan membagi tabel ke beberapa bagian halaman.
          </p>
        </div>

        <Separator />

        {/* Presets */}
        <div>
          <Label className="text-[11px] font-semibold">Preset Ukuran</Label>
          <p className="text-[9px] text-muted-foreground mb-1.5">
            Penyesuaian cepat ukuran font untuk kebutuhan berbeda. Preset `1 Halaman` tetap menjaga keterbacaan, lalu hanya menambah halaman tanda tangan bila ruang halaman pertama memang tidak cukup.
          </p>
          <div className="grid grid-cols-2 gap-1">
            {([
              { label: '1 Halaman', title: 14, meta: 9, header: 10, body: 10, desc: 'Prioritaskan 1 halaman tabel', autoFit: true },
              { label: 'Kompak', title: 14, meta: 9, header: 9, body: 8, desc: 'Hemat ruang', autoFit: false },
              { label: 'Standar', title: 16, meta: 10, header: 12, body: 11, desc: 'Default', autoFit: false },
              { label: 'Besar', title: 20, meta: 12, header: 14, body: 13, desc: 'Mudah dibaca', autoFit: false },
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
                className="h-auto py-1.5 text-[10px] flex-col items-start"
                onClick={() => {
                  onDocumentStyleChange({
                    ...documentStyle,
                    titleFontSize: preset.title,
                    metaFontSize: preset.meta,
                    tableHeaderFontSize: preset.header,
                    tableBodyFontSize: preset.body,
                  });
                  onAutoFitOnePageChange?.(preset.autoFit);
                }}
              >
                <span className="font-medium">{preset.label}</span>
                <span className="text-[8px] opacity-70">{preset.desc}</span>
              </Button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded-lg border border-border p-2">
            <div>
              <Label className="text-[11px]">Optimalkan ke 1 halaman tabel</Label>
              <p className="text-[9px] text-muted-foreground">Jika tabel sudah muat, halaman kedua hanya dipakai untuk tanda tangan tanpa header tabel kosong.</p>
            </div>
            <Switch
              checked={!!autoFitOnePage}
              onCheckedChange={(checked) => onAutoFitOnePageChange?.(checked)}
            />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-[11px]">Ukuran font tanda tangan ({draft.fontSize}pt)</Label>
        <SliderWithButtons
          value={draft.fontSize}
          min={4} max={24} step={1}
          onValueChange={(v) => setDraft((prev) => ({ ...prev, fontSize: v }))}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border p-2">
        <div>
          <Label className="text-[11px]">Garis tanda tangan</Label>
          <p className="text-[9px] text-muted-foreground">Garis di bawah area tanda tangan</p>
        </div>
        <Switch
          checked={draft.showSignatureLine}
          onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showSignatureLine: checked }))}
        />
      </div>

      {draft.showSignatureLine && (
        <div className="space-y-1.5">
          <Label className="text-[11px]">Lebar garis ({draft.signatureLineWidth}mm)</Label>
          <SliderWithButtons
            value={draft.signatureLineWidth}
            min={20} max={100} step={5}
            onValueChange={(v) => setDraft((prev) => ({ ...prev, signatureLineWidth: v }))}
          />
        </div>
      )}

      {draft.signers.length > 1 && (
        <div className="space-y-1.5">
          <Label className="text-[11px]">Jarak antar penanda tangan ({draft.signatureSpacing}mm)</Label>
          <SliderWithButtons
            value={draft.signatureSpacing}
            min={5} max={80} step={5}
            onValueChange={(v) => setDraft((prev) => ({ ...prev, signatureSpacing: v }))}
          />
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   PANEL: Posisi & Alignment
   ═══════════════════════════════════════════════════════ */
function PositionPanel({
  draft, setDraft, nudgePosition, resetPosition,
}: {
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  nudgePosition: (axis: 'x' | 'y', delta: number) => void;
  resetPosition: () => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold">Strategi Layout</Label>
        <div className="grid grid-cols-3 gap-1">
          {([
            { key: 'adaptive', label: 'Adaptive' },
            { key: 'flow', label: 'Flow' },
            { key: 'fixed', label: 'Fixed' },
          ] as const).map((mode) => (
            <Button
              key={mode.key}
              variant={draft.placementMode === mode.key ? "default" : "outline"}
              size="sm"
              className="h-8 text-[10px]"
              onClick={() => setDraft((prev) => ({ ...prev, placementMode: mode.key }))}
            >
              {mode.label}
            </Button>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground">
          Adaptive menjaga area aman otomatis, Flow menempel setelah konten, Fixed mengikuti posisi drag-and-drop.
        </p>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold">Preset Posisi</Label>
        <div className="grid grid-cols-2 gap-1">
          {([
            { key: 'bottom-left', label: 'Bawah Kiri' },
            { key: 'bottom-center', label: 'Bawah Tengah' },
            { key: 'bottom-right', label: 'Bawah Kanan' },
            { key: 'follow-content', label: 'Ikut Konten' },
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

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold">Perataan Horizontal</Label>
        <div className="flex gap-1">
          {([
            { key: 'left', icon: AlignLeft, label: 'Kiri' },
            { key: 'center', icon: AlignCenter, label: 'Tengah' },
            { key: 'right', icon: AlignRight, label: 'Kanan' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <Button
              key={key}
              variant={draft.signatureAlignment === key ? "default" : "outline"}
              size="sm"
              className="flex-1 h-8 text-[10px] gap-1"
              onClick={() => setDraft((prev) => ({ ...prev, signatureAlignment: key }))}
            >
              <Icon className="w-3 h-3" />
              {label}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="rounded-lg border border-border p-2 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-[11px]">Snap ke grid</Label>
            <p className="text-[9px] text-muted-foreground">Jaga posisi tetap presisi dan konsisten antar halaman</p>
          </div>
          <Switch
            checked={draft.snapToGrid}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, snapToGrid: checked }))}
          />
        </div>
        {draft.snapToGrid && (
          <div className="space-y-1.5">
            <Label className="text-[11px]">Ukuran grid ({draft.gridSizeMm}mm)</Label>
            <SliderWithButtons
              value={draft.gridSizeMm}
              min={1} max={20} step={1}
              onValueChange={(v) => setDraft((prev) => ({ ...prev, gridSizeMm: v }))}
            />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-2 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-2">
            <Lock className="w-3.5 h-3.5 mt-0.5 text-primary" />
            <div>
              <Label className="text-[11px]">Kunci posisi</Label>
              <p className="text-[9px] text-muted-foreground">Cegah tanda tangan bergeser saat preview disentuh</p>
            </div>
          </div>
          <Switch
            checked={draft.lockSignaturePosition}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, lockSignaturePosition: checked }))}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-[11px]">Debug bounding box</Label>
            <p className="text-[9px] text-muted-foreground">Tampilkan safe zone untuk validasi pixel-perfect</p>
          </div>
          <Switch
            checked={draft.showDebugGuides}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, showDebugGuides: checked }))}
          />
        </div>
      </div>

      <Separator />

      {/* Offset X */}
      <div className="space-y-1.5">
        <Label className="text-[11px]">Offset Horizontal ({draft.signatureOffsetX}mm)</Label>
        <SliderWithButtons
          value={draft.signatureOffsetX}
          min={-120} max={120} step={1}
          onValueChange={(v) => setDraft((prev) => ({ ...prev, signatureOffsetX: v }))}
        />
        <p className="text-[9px] text-muted-foreground">Negatif = geser kiri, Positif = geser kanan</p>
      </div>

      {/* Offset Y */}
      <div className="space-y-1.5">
        <Label className="text-[11px]">Offset Vertikal ({draft.signatureOffsetY}mm)</Label>
        <SliderWithButtons
          value={draft.signatureOffsetY}
          min={-60} max={80} step={1}
          onValueChange={(v) => setDraft((prev) => ({ ...prev, signatureOffsetY: v }))}
        />
        <p className="text-[9px] text-muted-foreground">Negatif = naik, Positif = turun</p>
      </div>

      <Separator />

      {/* D-Pad precise controls */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold">Kontrol Presisi</Label>
        <div className="flex flex-col items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgePosition('y', -1)}>
            <ArrowUp className="w-3.5 h-3.5" />
          </Button>
          <div className="flex gap-1 items-center">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgePosition('x', -1)}>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="w-10 h-8 rounded-md border border-border flex items-center justify-center">
              <Move className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgePosition('x', 1)}>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => nudgePosition('y', 1)}>
            <ArrowDown className="w-3.5 h-3.5" />
          </Button>
          <p className="text-[9px] text-muted-foreground mt-1">1mm per klik</p>
        </div>
      </div>

      <Separator />

      <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" onClick={resetPosition}>
        <RotateCcw className="w-3 h-3" />
        Reset ke Posisi Default
      </Button>
    </>
  );
}

