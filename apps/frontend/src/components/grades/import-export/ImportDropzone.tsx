import { useCallback, useRef, useState } from "react";
import { FileSpreadsheet, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

interface ImportDropzoneProps {
  fileName?: string | null;
  onFileSelected: (file: File) => void;
}

export function ImportDropzone({ fileName, onFileSelected }: ImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const descriptionId = "sipena-grade-import-dropzone-description";

  const handleFile = useCallback((file?: File) => {
    if (file) onFileSelected(file);
  }, [onFileSelected]);

  return (
    <button
      type="button"
      aria-label="Pilih file nilai untuk dianalisis"
      aria-describedby={descriptionId}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFile(event.dataTransfer.files?.[0]);
      }}
      className={cn(
        "group flex min-h-[13rem] w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed p-5 text-center transition-colors",
        "border-emerald-200 bg-emerald-50/45 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20",
        isDragging && "border-emerald-400 bg-emerald-100/75 dark:bg-emerald-950/45",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        aria-label="File nilai Excel atau CSV"
        className="sr-only"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100 dark:bg-slate-950 dark:ring-emerald-900/70">
        {fileName ? <FileSpreadsheet className="h-7 w-7" /> : <UploadCloud className="h-7 w-7" />}
      </div>
      <p className="max-w-full truncate text-base font-semibold text-slate-950 dark:text-slate-50" title={fileName || undefined}>
        {fileName || "Letakkan file nilai di sini"}
      </p>
      <p id={descriptionId} className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        File akan diperiksa otomatis lalu ditampilkan sebagai preview. Data tidak akan ditimpa tanpa konfirmasi.
      </p>
    </button>
  );
}
