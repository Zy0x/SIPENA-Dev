import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Upload, Loader2, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from "lucide-react";
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
  open,
  onOpenChange,
  subjectId,
  subjectName,
  classId,
  className,
  students,
  assignments,
  onImportComplete,
}: ImportGradesDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
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
    setHeaders([]);
    setColumnMapping({});
    setStep("upload");
    setError(null);
    setImportResult({ success: 0, failed: 0 });
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
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

        const headerRow = (json[0] as string[]).map((header) => String(header || "").trim());
        setHeaders(headerRow);

        const autoMap: Record<string, string> = {};
        headerRow.forEach((header, index) => {
          const lower = header.toLowerCase();
          if (lower.includes("nama") || lower === "name" || lower === "siswa") {
            autoMap.nama = String(index);
          }
          assignments.forEach((assignment) => {
            if (lower === assignment.name.toLowerCase() || lower.includes(assignment.name.toLowerCase())) {
              autoMap[assignment.id] = String(index);
            }
          });
        });
        setColumnMapping(autoMap);

        const rows: ParsedRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i] as any[];
          if (!row || row.length === 0) continue;

          const nameColIdx = autoMap.nama ? parseInt(autoMap.nama, 10) : 0;
          const studentName = String(row[nameColIdx] || "").trim();
          if (!studentName) continue;

          const matched = students.find((student) =>
            student.name.toLowerCase() === studentName.toLowerCase()
            || student.name.toLowerCase().includes(studentName.toLowerCase())
            || studentName.toLowerCase().includes(student.name.toLowerCase()),
          );

          const grades: Record<string, number | null> = {};
          assignments.forEach((assignment) => {
            const colIdx = autoMap[assignment.id] ? parseInt(autoMap[assignment.id], 10) : -1;
            if (colIdx >= 0 && row[colIdx] !== undefined && row[colIdx] !== "") {
              const value = parseFloat(String(row[colIdx]));
              grades[assignment.id] = Number.isNaN(value) ? null : Math.min(100, Math.max(0, Math.round(value)));
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
      } catch {
        setError("Gagal membaca file. Pastikan format Excel (.xlsx/.csv) valid.");
      }
    };

    reader.readAsArrayBuffer(selectedFile);
    if (e.target) e.target.value = "";
  }, [assignments, students]);

  const matchedCount = parsedRows.filter((row) => row.status === "matched").length;
  const unmatchedCount = parsedRows.filter((row) => row.status === "unmatched").length;
  const mappedAssignments = assignments.filter((assignment) => columnMapping[assignment.id]).length;

  const handleImport = useCallback(async () => {
    setStep("importing");
    let success = 0;
    let failed = 0;

    for (const row of parsedRows) {
      if (!row.matchedStudentId) {
        failed++;
        continue;
      }

      for (const [assignmentId, value] of Object.entries(row.grades)) {
        if (value === null) continue;

        try {
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
  }, [onImportComplete, parsedRows, showSuccess, subjectId]);

  const handleDownloadTemplate = useCallback(() => {
    const templateHeaders = ["Nama Siswa", ...assignments.map((assignment) => assignment.name)];
    const data = students.map((student) => [student.name, ...assignments.map(() => "")]);
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders, ...data]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nilai");
    ws["!cols"] = [{ wch: 25 }, ...assignments.map(() => ({ wch: 12 }))];
    XLSX.writeFile(wb, `Template_Nilai_${className}_${subjectName}.xlsx`);
  }, [assignments, className, students, subjectName]);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) resetState(); onOpenChange(value); }}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-3xl h-[min(100dvh-0.75rem,46rem)] overflow-hidden rounded-[24px] p-0 gap-0">
        <DialogHeader className="border-b border-border px-4 pt-4 pb-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Nilai dari Excel
          </DialogTitle>
          <DialogDescription>
            {className} • {subjectName}
          </DialogDescription>
        </DialogHeader>

        <div ref={layoutViewportRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <StudioStepHeader
                steps={[
                  { id: "upload", label: "Upload File" },
                  { id: "preview", label: "Cek Data" },
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
                      <p className="text-xs text-muted-foreground">Kolom pertama: Nama Siswa. Kolom berikutnya: nilai per tugas.</p>
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
                    <Download className="h-3.5 w-3.5" /> Download Template Excel
                  </Button>

                  <StudioInfoCollapsible
                    title="Panduan dan mapping"
                    description="Panel ini merangkum struktur file dan akan semakin berguna setelah file terbaca."
                    defaultOpen
                  >
                    <div className="space-y-3 text-xs text-muted-foreground">
                      <ul className="list-disc space-y-1 pl-4">
                        <li>Baris pertama harus berisi header: Nama Siswa dan nama tugas.</li>
                        <li>Nama siswa dicocokkan otomatis dengan data kelas aktif.</li>
                        <li>Nilai harus berupa angka 0-100.</li>
                        <li>Sel kosong diabaikan dan tidak menimpa nilai yang sudah ada.</li>
                      </ul>
                      {headers.length > 0 ? (
                        <div className="rounded-2xl border border-border bg-muted/20 p-3">
                          <p className="text-[11px] font-semibold text-foreground">
                            {headers.length} header terdeteksi • {mappedAssignments}/{assignments.length} tugas terpetakan
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </StudioInfoCollapsible>
                </>
              ) : null}

              {step === "preview" ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-green-500" /> {matchedCount} cocok
                    </Badge>
                    {unmatchedCount > 0 ? (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <AlertCircle className="h-3 w-3" /> {unmatchedCount} tidak cocok
                      </Badge>
                    ) : null}
                    <Badge variant="secondary" className="text-xs">
                      {parsedRows.length} baris
                    </Badge>
                  </div>

                  <StudioInfoCollapsible
                    title="Ringkasan mapping kolom"
                    description="Periksa seberapa banyak header file berhasil dipetakan ke tugas."
                    defaultOpen={viewport.isTablet}
                  >
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>{headers.length} header terdeteksi dari file yang diunggah.</p>
                      <p>{mappedAssignments} tugas berhasil dipetakan otomatis dari total {assignments.length} tugas.</p>
                    </div>
                  </StudioInfoCollapsible>

                  <ResponsiveDataPreview
                    rows={parsedRows}
                    profile={viewport.profile}
                    getRowKey={(row, index) => `${row.studentName}-${index}`}
                    detailLabel="Lihat tabel nilai"
                    columns={[
                      { id: "student", label: "Nama", primary: true, render: (row) => row.studentName },
                      {
                        id: "status",
                        label: "Status",
                        render: (row) => (
                          <span className={row.status === "matched" ? "text-emerald-600" : "text-destructive"}>
                            {row.status === "matched" ? "Cocok" : "Tidak cocok"}
                          </span>
                        ),
                      },
                      {
                        id: "grades",
                        label: "Nilai",
                        render: (row) => `${Object.values(row.grades).filter((value) => value !== null).length} nilai`,
                      },
                    ]}
                  />
                </>
              ) : null}

              {step === "importing" ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Mengimpor nilai...</p>
                </div>
              ) : null}

              {step === "done" ? (
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <div>
                    <p className="text-lg font-semibold">Import Selesai</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {importResult.success} nilai berhasil, {importResult.failed} gagal
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <StudioActionFooter
          sticky
          helperText="Tampilan mobile menomorsatukan ringkasan data lebih dulu, lalu tabel detail hanya dibuka saat memang diperlukan."
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
                  <Button onClick={handleImport} disabled={matchedCount === 0} className="h-11 w-full gap-2 text-xs sm:h-9 sm:w-auto">
                    <Upload className="h-4 w-4" /> Import {matchedCount} Siswa
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
