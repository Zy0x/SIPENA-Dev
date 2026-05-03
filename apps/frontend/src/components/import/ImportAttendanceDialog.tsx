import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, CalendarDays, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import * as XLSX from "xlsx";
import { useStudioViewportProfile } from "@/hooks/useStudioViewportProfile";
import {
  ResponsiveDataPreview,
  StudioActionFooter,
  StudioInfoCollapsible,
  StudioStepHeader,
} from "@/components/studio/ResponsiveStudio";

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
  open,
  onOpenChange,
  classId,
  className,
  students,
  onImportComplete,
}: ImportAttendanceDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedAttendanceRow[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [importResult, setImportResult] = useState({ success: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layoutViewportRef = useRef<HTMLDivElement>(null);
  const { success: showSuccess } = useEnhancedToast();
  const viewport = useStudioViewportProfile(layoutViewportRef, open);

  const resetState = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setStep("upload");
    setError(null);
    setImportResult({ success: 0, failed: 0 });
  }, []);

  const parseExcelDate = (val: any): string | null => {
    if (!val) return null;
    if (typeof val === "number") {
      const date = XLSX.SSF.parse_date_code(val);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
      }
    }

    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

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

        const headerRow = (json[0] as string[]).map((h) => String(h || "").trim().toLowerCase());

        let nameCol = 0;
        let dateCol = -1;
        let statusCol = -1;
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

          const matched = students.find((student) =>
            student.name.toLowerCase() === studentName.toLowerCase()
            || student.name.toLowerCase().includes(studentName.toLowerCase())
            || studentName.toLowerCase().includes(student.name.toLowerCase()),
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

  const validCount = parsedRows.filter((row) => row.valid).length;
  const invalidCount = parsedRows.filter((row) => !row.valid).length;

  const handleImport = useCallback(async () => {
    setStep("importing");
    let success = 0;
    let failed = 0;

    for (const row of parsedRows) {
      if (!row.valid || !row.matchedStudentId) {
        failed++;
        continue;
      }

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
  }, [classId, onImportComplete, parsedRows, showSuccess]);

  const handleDownloadTemplate = useCallback(() => {
    const headers = ["Nama Siswa", "Tanggal", "Status"];
    const sampleData = students.slice(0, 3).map((student) => [student.name, "2026-03-04", "H"]);
    if (sampleData.length === 0) sampleData.push(["Contoh Nama", "2026-03-04", "H"]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presensi");
    ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 10 }];
    XLSX.writeFile(wb, `Template_Presensi_${className}.xlsx`);
  }, [className, students]);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) resetState(); onOpenChange(value); }}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-3xl h-[min(100dvh-0.75rem,46rem)] overflow-hidden rounded-[24px] p-0 gap-0">
        <DialogHeader className="border-b border-border px-4 pt-4 pb-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Import Presensi dari Excel
          </DialogTitle>
          <DialogDescription>{className}</DialogDescription>
        </DialogHeader>

        <div ref={layoutViewportRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <StudioStepHeader
                steps={[
                  { id: "upload", label: "Upload File" },
                  { id: "preview", label: "Periksa Data" },
                  { id: "importing", label: "Import" },
                  { id: "done", label: "Selesai" },
                ]}
                currentStep={step}
              />

              {step === "upload" ? (
                <>
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Pilih file Excel (.xlsx, .csv)</p>
                      <p className="text-xs text-muted-foreground">Kolom: Nama Siswa, Tanggal, Status (H/I/S/A/D)</p>
                    </div>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />

                  {error ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  ) : null}

                  <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={handleDownloadTemplate}>
                    <Download className="h-3.5 w-3.5" /> Download Template
                  </Button>

                  <StudioInfoCollapsible
                    title="Panduan format presensi"
                    description="Buka panduan bila Anda ingin memastikan struktur file sudah tepat."
                    defaultOpen
                  >
                    <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                      <li>Kolom wajib: Nama Siswa, Tanggal, Status.</li>
                      <li>Format tanggal: YYYY-MM-DD atau DD/MM/YYYY.</li>
                      <li>Status valid: H, I, S, A, D.</li>
                      <li>Data duplikat akan ditimpa dengan mode upsert.</li>
                    </ul>
                  </StudioInfoCollapsible>
                </>
              ) : null}

              {step === "preview" ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-green-500" /> {validCount} valid
                    </Badge>
                    {invalidCount > 0 ? (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertCircle className="h-3 w-3" /> {invalidCount} invalid
                      </Badge>
                    ) : null}
                  </div>

                  <ResponsiveDataPreview
                    rows={parsedRows}
                    profile={viewport.profile}
                    getRowKey={(row, index) => `${row.studentName}-${row.date}-${index}`}
                    detailLabel="Lihat tabel presensi"
                    columns={[
                      { id: "name", label: "Nama", primary: true, render: (row) => row.studentName },
                      { id: "date", label: "Tanggal", render: (row) => row.date || "—" },
                      {
                        id: "status",
                        label: "Status",
                        render: (row) => (
                          <Badge variant={row.status ? "outline" : "destructive"} className="text-[10px]">
                            {row.status || "?"}
                          </Badge>
                        ),
                      },
                      {
                        id: "validation",
                        label: "Validasi",
                        render: (row) => (
                          <span className={row.valid ? "text-emerald-600" : "text-destructive"}>
                            {row.valid ? "Valid" : "Perlu diperiksa"}
                          </span>
                        ),
                      },
                    ]}
                  />
                </>
              ) : null}

              {step === "importing" ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Mengimpor presensi...</p>
                </div>
              ) : null}

              {step === "done" ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <div>
                    <p className="text-lg font-semibold">Import Selesai</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {importResult.success} data berhasil, {importResult.failed} gagal
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <StudioActionFooter
          sticky
          helperText="Area aksi tetap terlihat agar langkah upload, cek, dan import tetap nyaman di mobile dan tablet."
          actions={(
            <>
              {step === "upload" ? (
                <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 w-full text-xs sm:h-9 sm:w-auto">
                  Tutup
                </Button>
              ) : null}
              {step === "preview" ? (
                <>
                  <Button variant="outline" onClick={() => { setStep("upload"); setParsedRows([]); }} className="h-11 w-full text-xs sm:h-9 sm:w-auto">
                    Kembali
                  </Button>
                  <Button onClick={handleImport} disabled={validCount === 0} className="h-11 w-full gap-2 text-xs sm:h-9 sm:w-auto">
                    <Upload className="h-4 w-4" /> Import {validCount} Data
                  </Button>
                </>
              ) : null}
              {step === "done" ? (
                <Button onClick={() => { resetState(); onOpenChange(false); }} className="h-11 w-full text-xs sm:h-9 sm:w-auto">
                  Selesai
                </Button>
              ) : null}
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
