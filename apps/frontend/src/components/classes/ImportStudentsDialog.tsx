import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useStudents } from "@/hooks/useStudents";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useStudioViewportProfile } from "@/hooks/useStudioViewportProfile";
import {
  ResponsiveDataPreview,
  StudioActionFooter,
  StudioInfoCollapsible,
  StudioStepHeader,
} from "@/components/studio/ResponsiveStudio";

interface ImportStudentsDialogProps {
  classId: string;
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ImportStudentsDialog({
  classId,
  className,
  open,
  onOpenChange,
}: ImportStudentsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ name: string; nisn: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const layoutViewportRef = useRef<HTMLDivElement>(null);
  const { createStudentsBatch } = useStudents(classId);
  const { toast } = useEnhancedToast();
  const viewport = useStudioViewportProfile(layoutViewportRef, open);
  const currentStep = preview.length > 0 ? "preview" : "upload";

  const parseCSV = (content: string) => {
    const lines = content.trim().split("\n");
    const students: { name: string; nisn: string }[] = [];

    // Skip header if exists
    const startIndex = lines[0]?.toLowerCase().includes("nama") ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(/[,;\t]/).map((p) => p.trim().replace(/^"|"$/g, ""));
      
      if (parts.length >= 2 && parts[0] && parts[1]) {
        students.push({
          name: parts[0],
          nisn: parts[1],
        });
      }
    }

    return students;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    setError(null);
    setPreview([]);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith(".csv")) {
      setError("Format file tidak didukung. Gunakan CSV atau Excel.");
      setFile(null);
      return;
    }

    setFile(selectedFile);

    // Read and preview CSV
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = parseCSV(content);
        if (parsed.length === 0) {
          setError("Tidak ada data valid ditemukan dalam file.");
          return;
        }
        setPreview(parsed.slice(0, 5));
      } catch (err) {
        setError("Gagal membaca file. Pastikan format sudah benar.");
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const students = parseCSV(content);

      if (students.length === 0) {
        toast({
          title: "Import gagal",
          description: "Tidak ada data valid dalam file",
          variant: "error",
        });
        return;
      }

      const studentsWithClassId = students.map((s) => ({
        ...s,
        class_id: classId,
      }));

      await createStudentsBatch.mutateAsync(studentsWithClassId);
      
      setFile(null);
      setPreview([]);
      onOpenChange(false);
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-2xl h-[min(100dvh-0.75rem,44rem)] overflow-hidden rounded-[24px] p-0 gap-0">
        <DialogHeader className="border-b border-border px-4 pt-4 pb-3 sm:px-5">
          <DialogTitle>Import Siswa ke {className}</DialogTitle>
          <DialogDescription>
            Upload file CSV atau Excel dengan kolom Nama dan NISN
          </DialogDescription>
        </DialogHeader>

        <div ref={layoutViewportRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <StudioStepHeader
                steps={[
                  { id: "upload", label: "Upload File" },
                  { id: "preview", label: "Periksa Data" },
                ]}
                currentStep={currentStep}
              />

              <div className="grid gap-2">
                <Label>File CSV/Excel</Label>
                <div
                  className="rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 p-5 text-center transition-colors hover:border-primary/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                  {file ? (
                    <>
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">File siap diperiksa sebelum diimpor.</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-muted-foreground">Klik untuk pilih file atau drag & drop</p>
                      <p className="mt-1 text-xs text-muted-foreground">Format: CSV, XLS, XLSX</p>
                    </>
                  )}
                </div>
              </div>

              {error ? (
                <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              ) : null}

              {preview.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Preview Data</Label>
                    <span className="rounded-full border border-border bg-muted/30 px-2.5 py-1 text-[10px] text-muted-foreground">
                      {preview.length} data pertama
                    </span>
                  </div>
                  <ResponsiveDataPreview
                    rows={preview}
                    profile={viewport.profile}
                    getRowKey={(student, index) => `${student.nisn}-${index}`}
                    columns={[
                      {
                        id: "name",
                        label: "Nama",
                        primary: true,
                        render: (student) => student.name,
                      },
                      {
                        id: "nisn",
                        label: "NISN",
                        render: (student) => student.nisn,
                      },
                    ]}
                    detailLabel="Lihat tabel siswa"
                  />
                </div>
              ) : null}

              <StudioInfoCollapsible
                title="Panduan format"
                description="Buka panduan bila Anda ingin memastikan struktur CSV atau Excel sudah sesuai."
                defaultOpen={!file}
              >
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Baris pertama bisa berisi header `Nama` dan `NISN`. Setiap baris berikutnya berisi data siswa
                  dengan format `Nama, NISN`.
                </p>
              </StudioInfoCollapsible>
            </div>
          </div>
        </div>

        <StudioActionFooter
          sticky
          helperText="Pastikan preview sudah benar. Footer tetap terlihat agar aksi utama tidak hilang di mobile."
          actions={(
            <>
              <Button type="button" variant="outline" onClick={handleClose} className="h-11 w-full text-xs sm:h-9 sm:w-auto">
                Batal
              </Button>
              <Button
                onClick={handleImport}
                disabled={!file || preview.length === 0 || createStudentsBatch.isPending}
                className="h-11 w-full text-xs sm:h-9 sm:w-auto"
              >
                {createStudentsBatch.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mengimport...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import Siswa
                  </>
                )}
              </Button>
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
