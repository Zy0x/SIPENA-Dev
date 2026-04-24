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
  Upload, Loader2, CalendarDays, AlertCircle, CheckCircle2, Download,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import * as XLSX from "xlsx";

interface ImportAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  students: { id: string; name: string; nisn: string }[];
  onImportComplete?: () => void;
}

interface ParsedAttendanceRow {
  studentName: string;
  matchedStudentId: string | null;
  date: string;
  status: string;
  valid: boolean;
}

const VALID_STATUSES = ["H", "I", "S", "A", "D"];

export default function ImportAttendanceDialog({
  open, onOpenChange, classId, className,
  students, onImportComplete,
}: ImportAttendanceDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success: showSuccess } = useEnhancedToast();

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setStep("upload");
    setError(null);
    setImportResult({ success: 0, failed: 0 });
  }, []);

  const parseExcelDate = (val: any): string | null => {
    if (!val) return null;
    // If it's a number (Excel serial date)
    if (typeof val === "number") {
      const date = XLSX.SSF.parse_date_code(val);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
      }
    }
    // If it's a string, try to parse
    const str = String(val).trim();
    // Try yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    // Try dd/mm/yyyy or dd-mm-yyyy
    const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
    return null;
  };

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
        const json = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });

        if (json.length < 2) {
          setError("File harus memiliki minimal 1 header dan 1 baris data.");
          return;
        }

        const headerRow = (json[0] as string[]).map(h => String(h || "").trim().toLowerCase());
        
        let nameCol = 0, dateCol = -1, statusCol = -1;
        headerRow.forEach((h, i) => {
          if (h.includes("nama") || h === "name" || h === "siswa") nameCol = i;
          if (h.includes("tanggal") || h === "date" || h.includes("tgl")) dateCol = i;
          if (h.includes("status") || h.includes("keterangan") || h === "ket") statusCol = i;
        });

        if (dateCol === -1 || statusCol === -1) {
          setError("Kolom 'Tanggal' dan 'Status' wajib ada. Header: Nama, Tanggal, Status (H/I/S/A/D).");
          return;
        }

        const rows: ParsedAttendanceRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i] as any[];
          if (!row || row.length === 0) continue;

          const studentName = String(row[nameCol] || "").trim();
          if (!studentName) continue;

          const date = parseExcelDate(row[dateCol]);
          const rawStatus = String(row[statusCol] || "").trim().toUpperCase();
          const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : "";

          const matched = students.find(s =>
            s.name.toLowerCase() === studentName.toLowerCase() ||
            s.name.toLowerCase().includes(studentName.toLowerCase()) ||
            studentName.toLowerCase().includes(s.name.toLowerCase())
          );

          rows.push({
            studentName,
            matchedStudentId: matched?.id || null,
            date: date || "",
            status,
            valid: !!matched && !!date && !!status,
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
  }, [students]);

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;

  const handleImport = useCallback(async () => {
    setStep("importing");
    let success = 0, failed = 0;

    for (const row of parsedRows) {
      if (!row.valid || !row.matchedStudentId) { failed++; continue; }

      try {
        const { error: upsertError } = await (supabase as any)
          .from("attendance")
          .upsert({
            class_id: classId,
            student_id: row.matchedStudentId,
            date: row.date,
            status: row.status,
          }, { onConflict: "class_id,student_id,date" });

        if (upsertError) {
          console.error("Attendance upsert error:", upsertError);
          failed++;
        } else {
          success++;
        }
      } catch {
        failed++;
      }
    }

    setImportResult({ success, failed });
    setStep("done");
    if (success > 0) {
      showSuccess("Import berhasil", `${success} data presensi berhasil diimpor`);
      onImportComplete?.();
    }
  }, [parsedRows, classId, showSuccess, onImportComplete]);

  const handleDownloadTemplate = useCallback(() => {
    const headers = ["Nama Siswa", "Tanggal", "Status"];
    const sampleData = students.slice(0, 3).map(s => [s.name, "2026-03-04", "H"]);
    if (sampleData.length === 0) sampleData.push(["Contoh Nama", "2026-03-04", "H"]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presensi");
    ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }];
    XLSX.writeFile(wb, `Template_Presensi_${className}.xlsx`);
  }, [students, className]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Import Presensi dari Excel
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
                <p className="text-xs text-muted-foreground">Kolom: Nama Siswa, Tanggal, Status (H/I/S/A/D)</p>
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
                <li>Kolom wajib: Nama Siswa, Tanggal, Status</li>
                <li>Format tanggal: YYYY-MM-DD atau DD/MM/YYYY</li>
                <li>Status valid: H (Hadir), I (Izin), S (Sakit), A (Alpha), D (Dispensasi)</li>
                <li>Data duplikat akan ditimpa (upsert)</li>
              </ul>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" /> {validCount} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertCircle className="w-3 h-3" /> {invalidCount} invalid
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center w-16">✓</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow key={i} className={!row.valid ? "bg-destructive/5" : ""}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="text-sm">{row.studentName}</TableCell>
                      <TableCell className="text-xs">{row.date || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={row.status ? "outline" : "destructive"} className="text-[10px]">
                          {row.status || "?"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {row.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-destructive mx-auto" />
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
            <p className="text-sm text-muted-foreground">Mengimpor presensi...</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">Import Selesai</p>
              <p className="text-sm text-muted-foreground mt-1">
                {importResult.success} data berhasil, {importResult.failed} gagal
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
              <Button onClick={handleImport} disabled={validCount === 0} className="gap-2">
                <Upload className="w-4 h-4" /> Import {validCount} Data
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
