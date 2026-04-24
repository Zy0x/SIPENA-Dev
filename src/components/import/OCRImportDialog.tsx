import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Camera, Upload, Loader2, AlertCircle, CheckCircle2, Image as ImageIcon,
  ScanLine, Edit3, Sparkles,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";

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
      "Setiap baris = 1 siswa",
      "Pisahkan kolom dengan Tab atau | (pipe)",
      "Format: No | Nama | NISN",
    ],
  },
  grades: {
    columns: ["Nama Siswa", "Nilai 1", "Nilai 2", "..."],
    example: "Ahmad Fauzi\t85\t90\t78\nBudi Santoso\t92\t88\t95",
    tips: [
      "Baris pertama bisa berupa header (Nama, Tugas 1, Tugas 2, ...)",
      "Pisahkan kolom dengan Tab atau | (pipe)",
      "Nilai harus berupa angka 0-100",
    ],
  },
  attendance: {
    columns: ["Nama Siswa", "Tanggal", "Status"],
    example: "Ahmad Fauzi\t2026-03-04\tH\nBudi Santoso\t2026-03-04\tS",
    tips: [
      "Status: H (Hadir), I (Izin), S (Sakit), A (Alpha), D (Dispensasi)",
      "Format tanggal: YYYY-MM-DD atau DD/MM/YYYY",
      "Pisahkan kolom dengan Tab atau | (pipe)",
    ],
  },
};

export default function OCRImportDialog({
  open, onOpenChange, type, title, description, onDataReady,
}: OCRImportDialogProps) {
  const [step, setStep] = useState<"capture" | "edit" | "preview">("capture");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { success: showSuccess } = useEnhancedToast();

  const hints = TYPE_HINTS[type];

  const resetState = useCallback(() => {
    setStep("capture");
    setImagePreview(null);
    setRawText("");
    setParsedRows([]);
    setIsProcessing(false);
  }, []);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setImagePreview(evt.target?.result as string);
      setStep("edit");
      // Pre-fill with example to guide user
      setRawText("");
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  }, []);

  const parseText = useCallback(() => {
    if (!rawText.trim()) return;
    setIsProcessing(true);

    try {
      const lines = rawText.trim().split("\n").filter(l => l.trim());
      const rows: string[][] = [];

      for (const line of lines) {
        // Try tab first, then pipe, then multiple spaces
        let cells: string[];
        if (line.includes("\t")) {
          cells = line.split("\t").map(c => c.trim());
        } else if (line.includes("|")) {
          cells = line.split("|").map(c => c.trim()).filter(c => c);
        } else {
          cells = line.split(/\s{2,}/).map(c => c.trim());
        }
        if (cells.length > 0 && cells.some(c => c)) {
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
  }, [parsedRows, onDataReady, showSuccess, resetState, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" />
            {title}
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Sparkles className="w-2.5 h-2.5" /> Beta OCR
            </Badge>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "capture" && (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <Camera className="w-10 h-10 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium">Ambil Foto</p>
                  <p className="text-[10px] text-muted-foreground">Foto langsung dari kamera</p>
                </div>
              </button>

              <button
                onClick={() => imageInputRef.current?.click()}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-10 h-10 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">Pilih Gambar</p>
                  <p className="text-[10px] text-muted-foreground">Upload dari galeri</p>
                </div>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Cara Menggunakan Beta OCR
              </p>
              <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal pl-4">
                <li>Foto atau pilih gambar dokumen data (daftar siswa, lembar nilai, dll)</li>
                <li>Gambar akan ditampilkan sebagai referensi</li>
                <li>Ketik atau salin data dari gambar ke area teks yang tersedia</li>
                <li>Sistem akan memparsing data secara otomatis</li>
                <li>Preview dan koreksi sebelum mengimpor</li>
              </ol>
            </div>

            <div className="text-xs text-muted-foreground">
              <p className="font-semibold mb-1">Kolom yang diharapkan:</p>
              <div className="flex flex-wrap gap-1.5">
                {hints.columns.map((col, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{col}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "edit" && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            {imagePreview && (
              <div className="rounded-lg border overflow-hidden max-h-[200px]">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-contain bg-muted/20" />
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Ketik Data dari Gambar
                </label>
                <button
                  onClick={() => setRawText(hints.example)}
                  className="text-[10px] text-primary hover:underline"
                >
                  Lihat contoh format
                </button>
              </div>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Ketik data di sini...\nPisahkan kolom dengan Tab atau | (pipe)\n\nContoh:\n${hints.example}`}
                className="min-h-[140px] font-mono text-xs resize-y"
              />
            </div>

            <div className="text-[11px] text-muted-foreground space-y-0.5">
              {hints.tips.map((tip, i) => (
                <p key={i} className="flex items-start gap-1">
                  <span className="text-primary shrink-0">•</span> {tip}
                </p>
              ))}
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" /> {parsedRows.length} baris terdeteksi
              </Badge>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    {parsedRows[0]?.map((_, i) => (
                      <TableHead key={i} className="text-xs">
                        {hints.columns[i] || `Kolom ${i + 1}`}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      {row.map((cell, j) => (
                        <TableCell key={j} className="text-xs">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Memproses data...</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "capture" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          )}
          {step === "edit" && (
            <>
              <Button variant="outline" onClick={() => setStep("capture")}>Kembali</Button>
              <Button onClick={parseText} disabled={!rawText.trim()} className="gap-2">
                <ScanLine className="w-4 h-4" /> Parse Data
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("edit")}>Koreksi</Button>
              <Button onClick={handleConfirm} disabled={parsedRows.length === 0} className="gap-2">
                <Upload className="w-4 h-4" /> Gunakan Data ({parsedRows.length} baris)
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
