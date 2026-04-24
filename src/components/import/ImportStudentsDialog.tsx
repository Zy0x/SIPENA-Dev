import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2, Download, Users,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import * as XLSX from "xlsx";

interface ImportStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  existingStudents: { id: string; name: string; nisn: string }[];
  onImportComplete?: () => void;
}

interface ParsedStudent {
  name: string;
  nisn: string;
  absen: string;
  isDuplicate: boolean;
  status: "ok" | "duplicate" | "error";
}

export default function ImportStudentsDialog({
  open, onOpenChange, classId, className,
  existingStudents, onImportComplete,
}: ImportStudentsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStudent[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [importResult, setImportResult] = useState({ success: 0, failed: 0, skipped: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success: showSuccess } = useEnhancedToast();

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setStep("upload");
    setError(null);
    setImportResult({ success: 0, failed: 0, skipped: 0 });
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

        if (json.length < 2) {
          setError("File harus memiliki minimal 1 header dan 1 baris data.");
          return;
        }

        const headerRow = (json[0] as string[]).map(h => String(h || "").trim().toLowerCase());
        
        // Detect columns
        let nameCol = 0, nisnCol = -1, absenCol = -1;
        headerRow.forEach((h, i) => {
          if (h.includes("nama") || h === "name" || h === "siswa") nameCol = i;
          if (h.includes("nisn") || h.includes("nis")) nisnCol = i;
          if (h.includes("absen") || h.includes("no") || h === "nomor") absenCol = i;
        });

        const rows: ParsedStudent[] = [];
        const existingNisns = new Set(existingStudents.map(s => s.nisn.toLowerCase()));
        const existingNames = new Set(existingStudents.map(s => s.name.toLowerCase()));

        for (let i = 1; i < json.length; i++) {
          const row = json[i] as any[];
          if (!row || row.length === 0) continue;

          const name = String(row[nameCol] || "").trim();
          if (!name) continue;

          const nisn = nisnCol >= 0 ? String(row[nisnCol] || "").trim() : "";
          const absen = absenCol >= 0 ? String(row[absenCol] || "").trim() : String(i);

          const isDuplicate = (nisn && existingNisns.has(nisn.toLowerCase())) || existingNames.has(name.toLowerCase());

          rows.push({
            name,
            nisn,
            absen,
            isDuplicate,
            status: isDuplicate ? "duplicate" : "ok",
          });
        }

        setParsedRows(rows);
        setStep("preview");
      } catch {
        setError("Gagal membaca file. Pastikan format Excel (.xlsx/.csv) valid.");
      }
    };
    reader.readAsArrayBuffer(f);
    if (e.target) e.target.value = "";
  }, [existingStudents]);

  const okCount = parsedRows.filter(r => r.status === "ok").length;
  const dupCount = parsedRows.filter(r => r.status === "duplicate").length;

  const handleImport = useCallback(async () => {
    setStep("importing");
    let success = 0, failed = 0, skipped = 0;

    for (const row of parsedRows) {
      if (row.isDuplicate) { skipped++; continue; }

      try {
        const { error: insertError } = await (supabase as any).from("students").insert({
          class_id: classId,
          name: row.name,
          nisn: row.nisn || `AUTO_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          order_number: parseInt(row.absen) || (existingStudents.length + success + 1),
        });

        if (insertError) {
          console.error("Student insert error:", insertError);
          failed++;
        } else {
          success++;
        }
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed, skipped });
    setStep("done");
    if (success > 0) {
      showSuccess("Import berhasil", `${success} siswa berhasil diimpor`);
      onImportComplete?.();
    }
  }, [parsedRows, classId, existingStudents, showSuccess, onImportComplete]);

  const handleDownloadTemplate = useCallback(() => {
    const headers = ["No Absen", "Nama Siswa", "NISN"];
    const data = [["1", "Contoh Nama Siswa", "1234567890"]];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siswa");
    ws["!cols"] = [{ wch: 10 }, { wch: 30 }, { wch: 15 }];
    XLSX.writeFile(wb, `Template_Siswa_${className}.xlsx`);
  }, [className]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Import Siswa dari Excel
          </DialogTitle>
          <DialogDescription>{className}</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Pilih file Excel (.xlsx, .csv)</p>
                <p className="text-xs text-muted-foreground">Kolom: Nama Siswa, NISN (opsional), No Absen (opsional)</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button variant="outline" size="sm" className="gap-2" onClick={handleDownloadTemplate}>
              <Download className="w-3.5 h-3.5" /> Download Template
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">Panduan:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Baris pertama: header (Nama Siswa, NISN, No Absen)</li>
                <li>Siswa duplikat (nama/NISN sama) otomatis dilewati</li>
                <li>NISN opsional, akan di-generate otomatis jika kosong</li>
              </ul>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" /> {okCount} baru
              </Badge>
              {dupCount > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <AlertCircle className="w-3 h-3" /> {dupCount} duplikat (skip)
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NISN</TableHead>
                    <TableHead className="text-center w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow key={i} className={row.isDuplicate ? "bg-muted/30 opacity-60" : ""}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="text-sm">{row.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.nisn || "-"}</TableCell>
                      <TableCell className="text-center">
                        {row.isDuplicate ? (
                          <Badge variant="secondary" className="text-[10px]">Duplikat</Badge>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Mengimpor siswa...</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">Import Selesai</p>
              <p className="text-sm text-muted-foreground mt-1">
                {importResult.success} ditambahkan, {importResult.skipped} dilewati, {importResult.failed} gagal
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "upload" && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => { setStep("upload"); setParsedRows([]); }}>Kembali</Button>
              <Button onClick={handleImport} disabled={okCount === 0} className="gap-2">
                <Upload className="w-4 h-4" /> Import {okCount} Siswa
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => { resetState(); onOpenChange(false); }}>Selesai</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
