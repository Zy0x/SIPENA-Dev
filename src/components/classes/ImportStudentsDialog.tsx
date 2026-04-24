import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useStudents } from "@/hooks/useStudents";
import { useEnhancedToast } from "@/contexts/ToastContext";

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
  const { createStudentsBatch } = useStudents(classId);
  const { toast } = useEnhancedToast();

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Siswa ke {className}</DialogTitle>
          <DialogDescription>
            Upload file CSV atau Excel dengan kolom Nama dan NISN
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* File Input */}
          <div className="grid gap-2">
            <Label>File CSV/Excel</Label>
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              {file ? (
                <p className="text-sm text-foreground font-medium">{file.name}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Klik untuk pilih file atau drag & drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Format: CSV, XLS, XLSX
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="grid gap-2">
              <Label>Preview ({preview.length} data pertama)</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nama</th>
                      <th className="px-3 py-2 text-left font-medium">NISN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((student, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2">{student.name}</td>
                        <td className="px-3 py-2">{student.nisn}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Format Help */}
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">
              <strong>Format file:</strong> Baris pertama bisa berisi header (Nama, NISN).
              Setiap baris berikutnya berisi data siswa dengan format: Nama, NISN
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            Batal
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || preview.length === 0 || createStudentsBatch.isPending}
          >
            {createStudentsBatch.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Mengimport...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Siswa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
