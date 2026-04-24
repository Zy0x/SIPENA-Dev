import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2, Download,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import * as XLSX from "xlsx";

interface ImportGradesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  students: { id: string; name: string; nisn: string }[];
  assignments: { id: string; name: string; chapter_id: string }[];
  onImportComplete?: () => void;
}

interface ParsedRow {
  studentName: string;
  matchedStudentId: string | null;
  grades: Record<string, number | null>;
  status: "matched" | "unmatched" | "error";
}

export default function ImportGradesDialog({
  open, onOpenChange, subjectId, subjectName, classId, className,
  students, assignments, onImportComplete,
}: ImportGradesDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { success: showSuccess, error: showError } = useEnhancedToast();

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setHeaders([]);
    setColumnMapping({});
    setStep("upload");
    setError(null);
    setImportResult({ success: 0, failed: 0 });
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

        const headerRow = (json[0] as string[]).map(h => String(h || "").trim());
        setHeaders(headerRow);

        // Auto-detect column mapping
        const autoMap: Record<string, string> = {};
        headerRow.forEach((h, i) => {
          const lower = h.toLowerCase();
          if (lower.includes("nama") || lower === "name" || lower === "siswa") {
            autoMap["nama"] = String(i);
          }
          // Try to match assignment names
          assignments.forEach(a => {
            if (lower === a.name.toLowerCase() || lower.includes(a.name.toLowerCase())) {
              autoMap[a.id] = String(i);
            }
          });
        });
        setColumnMapping(autoMap);

        // Parse data rows
        const rows: ParsedRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i] as any[];
          if (!row || row.length === 0) continue;

          const nameColIdx = autoMap["nama"] ? parseInt(autoMap["nama"]) : 0;
          const studentName = String(row[nameColIdx] || "").trim();
          if (!studentName) continue;

          // Match student by name (fuzzy)
          const matched = students.find(s =>
            s.name.toLowerCase() === studentName.toLowerCase() ||
            s.name.toLowerCase().includes(studentName.toLowerCase()) ||
            studentName.toLowerCase().includes(s.name.toLowerCase())
          );

          const grades: Record<string, number | null> = {};
          assignments.forEach(a => {
            const colIdx = autoMap[a.id] ? parseInt(autoMap[a.id]) : -1;
            if (colIdx >= 0 && row[colIdx] !== undefined && row[colIdx] !== "") {
              const val = parseFloat(String(row[colIdx]));
              grades[a.id] = isNaN(val) ? null : Math.min(100, Math.max(0, Math.round(val)));
            }
          });

          rows.push({
            studentName,
            matchedStudentId: matched?.id || null,
            grades,
            status: matched ? "matched" : "unmatched",
          });
        }

        setParsedRows(rows);
        setStep("preview");
      } catch (err) {
        setError("Gagal membaca file. Pastikan format Excel (.xlsx/.csv) valid.");
      }
    };
    reader.readAsArrayBuffer(f);
    if (e.target) e.target.value = "";
  }, [students, assignments]);

  const matchedCount = parsedRows.filter(r => r.status === "matched").length;
  const unmatchedCount = parsedRows.filter(r => r.status === "unmatched").length;

  const handleImport = useCallback(async () => {
    setStep("importing");
    let success = 0;
    let failed = 0;

    for (const row of parsedRows) {
      if (!row.matchedStudentId) { failed++; continue; }

      for (const [assignmentId, value] of Object.entries(row.grades)) {
        if (value === null) continue;
        try {
          // Upsert grade
          const { error: upsertError } = await (supabase as any)
            .from("grades")
            .upsert({
              student_id: row.matchedStudentId,
              subject_id: subjectId,
              assignment_id: assignmentId,
              grade_type: "assignment",
              value,
            }, { onConflict: "student_id,subject_id,assignment_id,grade_type" });

          if (upsertError) {
            console.error("Grade upsert error:", upsertError);
            failed++;
          } else {
            success++;
          }
        } catch {
          failed++;
        }
      }
    }

    setImportResult({ success, failed });
    setStep("done");
    if (success > 0) {
      showSuccess("Import berhasil", `${success} nilai berhasil diimpor`);
      onImportComplete?.();
    }
  }, [parsedRows, subjectId, showSuccess, onImportComplete]);

  const handleDownloadTemplate = useCallback(() => {
    const headers = ["Nama Siswa", ...assignments.map(a => a.name)];
    const data = students.map(s => [s.name, ...assignments.map(() => "")]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nilai");
    ws["!cols"] = [{ wch: 25 }, ...assignments.map(() => ({ wch: 12 }))];
    XLSX.writeFile(wb, `Template_Nilai_${className}_${subjectName}.xlsx`);
  }, [students, assignments, className, subjectName]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Nilai dari Excel
          </DialogTitle>
          <DialogDescription>
            {className} — {subjectName}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-8 h-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Pilih file Excel (.xlsx, .csv)</p>
                <p className="text-xs text-muted-foreground">Kolom pertama: Nama Siswa. Kolom berikutnya: nilai per tugas.</p>
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
              <Download className="w-3.5 h-3.5" /> Download Template Excel
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">Panduan:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Baris pertama harus berisi header (Nama Siswa, nama tugas)</li>
                <li>Nama siswa akan dicocokkan otomatis dengan data yang ada</li>
                <li>Nilai harus berupa angka 0-100</li>
                <li>Sel kosong akan diabaikan (tidak menimpa nilai yang ada)</li>
              </ul>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" /> {matchedCount} cocok
              </Badge>
              {unmatchedCount > 0 && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertCircle className="w-3 h-3" /> {unmatchedCount} tidak cocok
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">{parsedRows.length} baris</Badge>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="text-center w-20">Status</TableHead>
                    <TableHead className="text-center w-20">Nilai</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, i) => (
                    <TableRow key={i} className={row.status === "unmatched" ? "bg-destructive/5" : ""}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="text-sm">{row.studentName}</TableCell>
                      <TableCell className="text-center">
                        {row.status === "matched" ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-destructive mx-auto" />
                        )}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {Object.values(row.grades).filter(v => v !== null).length} nilai
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
            <p className="text-sm text-muted-foreground">Mengimpor nilai...</p>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="text-lg font-semibold">Import Selesai</p>
              <p className="text-sm text-muted-foreground mt-1">
                {importResult.success} nilai berhasil, {importResult.failed} gagal
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
              <Button onClick={handleImport} disabled={matchedCount === 0} className="gap-2">
                <Upload className="w-4 h-4" /> Import {matchedCount} Siswa
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
