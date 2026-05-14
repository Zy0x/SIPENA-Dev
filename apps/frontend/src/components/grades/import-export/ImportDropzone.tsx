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
        "group flex min-h-[11rem] w-full flex-col items-center justify-center rounded-[20px] border-2 border-dashed p-5 text-center transition-colors",
        "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/45 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-blue-950/20",
        isDragging && "border-blue-400 bg-blue-50 dark:bg-blue-950/35",
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
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100 dark:bg-blue-950/30 dark:ring-blue-900/70">
        {fileName ? <FileSpreadsheet className="h-7 w-7" /> : <UploadCloud className="h-7 w-7" />}
      </div>
      <p className="max-w-full truncate text-base font-semibold text-slate-950 dark:text-slate-50" title={fileName || undefined}>
        {fileName || "Pilih atau letakkan file nilai"}
      </p>
      <p id={descriptionId} className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Excel/CSV akan diperiksa sebelum disimpan.
      </p>
    </button>
  );
}
