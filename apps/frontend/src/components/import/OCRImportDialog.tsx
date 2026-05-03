import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  Image as ImageIcon,
  ScanLine,
  Edit3,
  Sparkles,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useStudioViewportProfile } from "@/hooks/useStudioViewportProfile";
import {
  ResponsiveDataPreview,
  StudioActionFooter,
  StudioInfoCollapsible,
  StudioStepHeader,
} from "@/components/studio/ResponsiveStudio";

export type OCRImportType = "students" | "grades" | "attendance";

interface OCRImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: OCRImportType;
  title: string;
  description: string;
  onDataReady: (rows: string[][]) => void;
}

const TYPE_HINTS: Record<OCRImportType, { columns: string[]; example: string; tips: string[] }> = {
  students: {
    columns: ["No", "Nama Siswa", "NISN"],
    example: "1\tAhmad Fauzi\t1234567890\n2\tBudi Santoso\t1234567891",
    tips: [
      "Setiap baris mewakili 1 siswa.",
      "Pisahkan kolom dengan Tab atau | (pipe).",
      "Format: No | Nama | NISN.",
    ],
  },
  grades: {
    columns: ["Nama Siswa", "Nilai 1", "Nilai 2", "..."],
    example: "Ahmad Fauzi\t85\t90\t78\nBudi Santoso\t92\t88\t95",
    tips: [
      "Baris pertama boleh berupa header.",
      "Pisahkan kolom dengan Tab atau | (pipe).",
      "Nilai harus berupa angka 0-100.",
    ],
  },
  attendance: {
    columns: ["Nama Siswa", "Tanggal", "Status"],
    example: "Ahmad Fauzi\t2026-03-04\tH\nBudi Santoso\t2026-03-04\tS",
    tips: [
      "Status: H, I, S, A, atau D.",
      "Format tanggal: YYYY-MM-DD atau DD/MM/YYYY.",
      "Pisahkan kolom dengan Tab atau | (pipe).",
    ],
  },
};

export default function OCRImportDialog({
  open,
  onOpenChange,
  type,
  title,
  description,
  onDataReady,
}: OCRImportDialogProps) {
  const [step, setStep] = useState<"capture" | "edit" | "preview">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const layoutViewportRef = useRef<HTMLDivElement>(null);
  const { success: showSuccess } = useEnhancedToast();
  const viewport = useStudioViewportProfile(layoutViewportRef, open);
  const hints = TYPE_HINTS[type];

  const resetState = useCallback(() => {
    setStep("capture");
    setImagePreview(null);
    setRawText("");
    setParsedRows([]);
    setIsProcessing(false);
  }, []);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setImagePreview(evt.target?.result as string);
      setStep("edit");
      setRawText("");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const parseText = useCallback(() => {
    if (!rawText.trim()) return;
    setIsProcessing(true);

    try {
      const lines = rawText.trim().split("\n").filter((line) => line.trim());
      const rows: string[][] = [];

      for (const line of lines) {
        let cells: string[];
        if (line.includes("\t")) {
          cells = line.split("\t").map((cell) => cell.trim());
        } else if (line.includes("|")) {
          cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
        } else {
          cells = line.split(/\s{2,}/).map((cell) => cell.trim());
        }

        if (cells.length > 0 && cells.some(Boolean)) {
          rows.push(cells);
        }
      }

      setParsedRows(rows);
      setStep("preview");
    } finally {
      setIsProcessing(false);
    }
  }, [rawText]);

  const handleConfirm = useCallback(() => {
    onDataReady(parsedRows);
    showSuccess("Data siap", `${parsedRows.length} baris data berhasil diparsing`);
    resetState();
    onOpenChange(false);
  }, [onDataReady, onOpenChange, parsedRows, resetState, showSuccess]);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) resetState(); onOpenChange(value); }}>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />

      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-3xl h-[min(100dvh-0.75rem,48rem)] overflow-hidden rounded-[24px] p-0 gap-0">
        <DialogHeader className="border-b border-border px-4 pt-4 pb-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            {title}
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Sparkles className="h-2.5 w-2.5" /> Beta OCR
            </Badge>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div ref={layoutViewportRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <StudioStepHeader
                steps={[
                  { id: "capture", label: "Ambil Gambar" },
                  { id: "edit", label: "Rapikan Teks" },
                  { id: "preview", label: "Preview Hasil" },
                ]}
                currentStep={step}
              />

              {step === "capture" ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center transition-colors hover:bg-muted/40"
                    >
                      <Camera className="h-10 w-10 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Ambil Foto</p>
                        <p className="text-[10px] text-muted-foreground">Gunakan kamera langsung dari perangkat</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center transition-colors hover:bg-muted/40"
                    >
                      <ImageIcon className="h-10 w-10 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Pilih Gambar</p>
                        <p className="text-[10px] text-muted-foreground">Upload dari galeri atau file manager</p>
                      </div>
                    </button>
                  </div>

                  <StudioInfoCollapsible
                    title="Cara menggunakan Beta OCR"
                    description="Buka panduan ini bila Anda ingin alur singkat yang aman di mobile."
                    defaultOpen
                  >
                    <ol className="list-decimal space-y-1 pl-4 text-[11px] text-muted-foreground">
                      <li>Ambil foto atau pilih gambar dokumen data.</li>
                      <li>Gunakan gambar itu sebagai referensi visual.</li>
                      <li>Ketik atau tempel ulang data ke area teks.</li>
                      <li>Parse data lalu koreksi hasil sebelum dipakai.</li>
                    </ol>
                  </StudioInfoCollapsible>

                  <StudioInfoCollapsible
                    title="Kolom yang diharapkan"
                    description="Kolom ini dipakai sebagai panduan saat Anda menyalin data dari gambar."
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {hints.columns.map((column, index) => (
                        <Badge key={`${column}-${index}`} variant="outline" className="text-[10px]">
                          {column}
                        </Badge>
                      ))}
                    </div>
                  </StudioInfoCollapsible>
                </>
              ) : null}

              {step === "edit" ? (
                <>
                  {imagePreview ? (
                    <div className="overflow-hidden rounded-2xl border border-border bg-muted/20">
                      <img src={imagePreview} alt="Preview OCR" className="max-h-[17rem] w-full object-contain" />
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-1.5 text-sm font-medium">
                        <Edit3 className="h-3.5 w-3.5" /> Ketik Data dari Gambar
                      </label>
                      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-3 text-[10px]" onClick={() => setRawText(hints.example)}>
                        Isi Contoh
                      </Button>
                    </div>
                    <Textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder={`Ketik data di sini...\nPisahkan kolom dengan Tab atau | (pipe)\n\nContoh:\n${hints.example}`}
                      className="min-h-[14rem] resize-y rounded-2xl font-mono text-xs"
                    />
                  </div>

                  <StudioInfoCollapsible
                    title="Tips pengetikan"
                    description="Gunakan tips ini agar parser lebih mudah membaca data."
                    defaultOpen={viewport.isPhone}
                  >
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {hints.tips.map((tip, index) => (
                        <p key={`${tip}-${index}`} className="flex items-start gap-2">
                          <span className="text-primary">•</span>
                          <span>{tip}</span>
                        </p>
                      ))}
                    </div>
                  </StudioInfoCollapsible>
                </>
              ) : null}

              {step === "preview" ? (
                <>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-green-500" /> {parsedRows.length} baris terdeteksi
                  </Badge>
                  <ResponsiveDataPreview
                    rows={parsedRows}
                    profile={viewport.profile}
                    getRowKey={(row, index) => `${row.join("-")}-${index}`}
                    detailLabel="Lihat tabel hasil OCR"
                    columns={(parsedRows[0] ?? hints.columns).map((_, index) => ({
                      id: `column-${index}`,
                      label: hints.columns[index] || `Kolom ${index + 1}`,
                      primary: index === 0,
                      render: (row: string[]) => row[index] ?? "—",
                    }))}
                  />
                </>
              ) : null}

              {isProcessing ? (
                <div className="flex flex-col items-center justify-center gap-4 py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Memproses data...</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <StudioActionFooter
          sticky
          helperText="Pada mobile, gambar referensi, editor teks, dan preview dipisah per langkah agar layar kecil tetap nyaman dipakai."
          actions={(
            <>
              {step === "capture" ? (
                <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 w-full text-xs sm:h-9 sm:w-auto">
                  Tutup
                </Button>
              ) : null}
              {step === "edit" ? (
                <>
                  <Button variant="outline" onClick={() => setStep("capture")} className="h-11 w-full text-xs sm:h-9 sm:w-auto">
                    Kembali
                  </Button>
                  <Button onClick={parseText} disabled={!rawText.trim() || isProcessing} className="h-11 w-full gap-2 text-xs sm:h-9 sm:w-auto">
                    <ScanLine className="h-4 w-4" /> Parse Data
                  </Button>
                </>
              ) : null}
              {step === "preview" ? (
                <>
                  <Button variant="outline" onClick={() => setStep("edit")} className="h-11 w-full text-xs sm:h-9 sm:w-auto">
                    Koreksi
                  </Button>
                  <Button onClick={handleConfirm} disabled={parsedRows.length === 0} className="h-11 w-full gap-2 text-xs sm:h-9 sm:w-auto">
                    <Upload className="h-4 w-4" /> Gunakan Data ({parsedRows.length})
                  </Button>
                </>
              ) : null}
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
