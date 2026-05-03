import { useState, useCallback, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle,
  XCircle, Loader2, ChevronRight, ChevronDown, Info,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import * as XLSX from "xlsx";
import { useStudioViewportProfile } from "@/hooks/useStudioViewportProfile";
import {
  StudioInfoCollapsible,
  StudioStepHeader,
} from "@/components/studio/ResponsiveStudio";

interface BatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SheetData {
  name: string;
  rows: Record<string, any>[];
  errors: string[];
  warnings: string[];
  status: "pending" | "valid" | "error" | "imported";
}

type ImportStep = "upload" | "preview" | "importing" | "done";

const SHEET_NAMES = ["Panduan", "Kelas", "Siswa", "Mata Pelajaran", "Struktur BAB & Tugas", "Nilai", "Presensi"];

export default function BatchImportDialog({ open, onOpenChange }: BatchImportDialogProps) {
  const { user } = useAuth();
  const { activeYear, activeSemester } = useAcademicYear();
  const { success, error: showError } = useEnhancedToast();

  const [step, setStep] = useState<ImportStep>("upload");
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [expandedSheet, setExpandedSheet] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] });
  const layoutViewportRef = useRef<HTMLDivElement>(null);
  const viewport = useStudioViewportProfile(layoutViewportRef, open);

  const handleDownloadTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Panduan
    const guideData = [
      ["PANDUAN PENGISIAN DATA SIPENA — BATCH IMPORT"],
      [""],
      ["File ini digunakan untuk mengimpor seluruh ekosistem data akademik ke SIPENA dalam satu kali proses."],
      [""],
      ["INSTRUKSI UMUM:"],
      ["1. Jangan mengubah nama sheet atau menghapus kolom header."],
      ["2. Isi data sesuai contoh yang diberikan di baris pertama setiap sheet."],
      ["3. Kolom bertanda (*) bersifat WAJIB."],
      ["4. Nama kelas di setiap sheet harus PERSIS sama dengan sheet Kelas."],
      ["5. Nama mapel dan tugas harus PERSIS sama antar sheet."],
      [""],
      ["URUTAN SHEET:"],
      ["Sheet 2: Kelas — Daftar kelas yang akan dibuat beserta KKM kelas"],
      ["Sheet 3: Siswa — Daftar siswa per kelas"],
      ["Sheet 4: Mata Pelajaran — Daftar mapel per kelas"],
      ["Sheet 5: Struktur BAB & Tugas — BAB dan tugas per mapel"],
      ["Sheet 6: Nilai — Nilai siswa per tugas"],
      ["Sheet 7: Presensi — Status kehadiran harian"],
    ];
    const wsGuide = XLSX.utils.aoa_to_sheet(guideData);
    wsGuide["!cols"] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan");

    // Sheet 2: Kelas
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Wali Kelas"],
      ["Kelas 7A", 75, "Kelas unggulan", "Budi Santoso"],
      ["Kelas 7B", 72, "Kelas reguler", "Siti Rahayu"],
    ]), "Kelas");

    // Sheet 3: Siswa
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nama Kelas *", "No Absen *", "Nama Siswa *", "NISN"],
      ["Kelas 7A", 1, "Ahmad Fauzi", "0012345678"],
      ["Kelas 7A", 2, "Budi Pratama", "0012345679"],
      ["Kelas 7B", 1, "Citra Dewi", "0012345680"],
    ]), "Siswa");

    // Sheet 4: Mata Pelajaran
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nama Kelas *", "Nama Mapel *", "KKM *"],
      ["Kelas 7A", "Matematika", 75],
      ["Kelas 7A", "Bahasa Indonesia", 70],
      ["Kelas 7B", "Matematika", 75],
    ]), "Mata Pelajaran");

    // Sheet 5: Struktur BAB & Tugas
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nama Mapel *", "Nama Kelas *", "Nama BAB *", "Nama Tugas *"],
      ["Matematika", "Kelas 7A", "BAB 1 Bilangan", "Tugas 1"],
      ["Matematika", "Kelas 7A", "BAB 1 Bilangan", "Quiz 1"],
      ["Matematika", "Kelas 7A", "BAB 2 Aljabar", "Tugas 1"],
    ]), "Struktur BAB & Tugas");

    // Sheet 6: Nilai
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nama Kelas", "Nama Siswa *", "Nama Mapel *", "Nama Tugas *", "Nilai *"],
      ["Kelas 7A", "Ahmad Fauzi", "Matematika", "Tugas 1", 85],
      ["Kelas 7A", "Ahmad Fauzi", "Matematika", "Quiz 1", 90],
      ["Kelas 7A", "Budi Pratama", "Matematika", "Tugas 1", 78],
    ]), "Nilai");

    // Sheet 7: Presensi
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Nama Kelas", "Nama Siswa *", "Tanggal *", "Status *"],
      ["Kelas 7A", "Ahmad Fauzi", "2026-03-01", "H"],
      ["Kelas 7A", "Ahmad Fauzi", "2026-03-02", "H"],
      ["Kelas 7A", "Budi Pratama", "2026-03-01", "S"],
    ]), "Presensi");

    XLSX.writeFile(wb, "SIPENA_Template_Batch_Import.xlsx");
    success("Template diunduh", "Isi template lalu upload kembali");
  }, [success]);

  const validateSheets = useCallback((workbook: XLSX.WorkBook): SheetData[] => {
    const result: SheetData[] = [];

    // Parse Kelas
    const kelasSheet = workbook.Sheets["Kelas"];
    const kelasRows = kelasSheet ? XLSX.utils.sheet_to_json<any>(kelasSheet) : [];
    const kelasErrors: string[] = [];
    const kelasNames = new Set<string>();
    kelasRows.forEach((r, i) => {
      const name = String(r["Nama Kelas *"] || r["Nama Kelas"] || "").trim();
      const classKkm = Number(r["KKM Kelas *"] || r["KKM Kelas"]);
      if (!name) kelasErrors.push(`Baris ${i + 2}: Nama kelas kosong`);
      if (isNaN(classKkm) || classKkm < 0 || classKkm > 100) kelasErrors.push(`Baris ${i + 2}: KKM kelas tidak valid (${classKkm})`);
      else if (kelasNames.has(name)) kelasErrors.push(`Baris ${i + 2}: Kelas "${name}" duplikat`);
      else kelasNames.add(name);
    });
    result.push({ name: "Kelas", rows: kelasRows, errors: kelasErrors, warnings: [], status: kelasErrors.length ? "error" : "valid" });

    // Parse Siswa
    const siswaSheet = workbook.Sheets["Siswa"];
    const siswaRows = siswaSheet ? XLSX.utils.sheet_to_json<any>(siswaSheet) : [];
    const siswaErrors: string[] = [];
    const siswaWarnings: string[] = [];
    siswaRows.forEach((r, i) => {
      const kelas = String(r["Nama Kelas *"] || r["Nama Kelas"] || "").trim();
      const nama = String(r["Nama Siswa *"] || r["Nama Siswa"] || "").trim();
      if (!kelas) siswaErrors.push(`Baris ${i + 2}: Nama kelas kosong`);
      else if (!kelasNames.has(kelas)) siswaWarnings.push(`Baris ${i + 2}: Kelas "${kelas}" tidak ada di sheet Kelas`);
      if (!nama) siswaErrors.push(`Baris ${i + 2}: Nama siswa kosong`);
    });
    result.push({ name: "Siswa", rows: siswaRows, errors: siswaErrors, warnings: siswaWarnings, status: siswaErrors.length ? "error" : "valid" });

    // Parse Mata Pelajaran
    const mapelSheet = workbook.Sheets["Mata Pelajaran"];
    const mapelRows = mapelSheet ? XLSX.utils.sheet_to_json<any>(mapelSheet) : [];
    const mapelErrors: string[] = [];
    mapelRows.forEach((r, i) => {
      const kelas = String(r["Nama Kelas *"] || r["Nama Kelas"] || "").trim();
      const mapel = String(r["Nama Mapel *"] || r["Nama Mapel"] || "").trim();
      const kkm = Number(r["KKM *"] || r["KKM"]);
      if (!kelas) mapelErrors.push(`Baris ${i + 2}: Nama kelas kosong`);
      if (!mapel) mapelErrors.push(`Baris ${i + 2}: Nama mapel kosong`);
      if (isNaN(kkm) || kkm < 0 || kkm > 100) mapelErrors.push(`Baris ${i + 2}: KKM tidak valid (${kkm})`);
    });
    result.push({ name: "Mata Pelajaran", rows: mapelRows, errors: mapelErrors, warnings: [], status: mapelErrors.length ? "error" : "valid" });

    // Parse Struktur BAB & Tugas
    const strukturSheet = workbook.Sheets["Struktur BAB & Tugas"];
    const strukturRows = strukturSheet ? XLSX.utils.sheet_to_json<any>(strukturSheet) : [];
    const strukturErrors: string[] = [];
    strukturRows.forEach((r, i) => {
      if (!String(r["Nama Mapel *"] || r["Nama Mapel"] || "").trim()) strukturErrors.push(`Baris ${i + 2}: Nama mapel kosong`);
      if (!String(r["Nama BAB *"] || r["Nama BAB"] || "").trim()) strukturErrors.push(`Baris ${i + 2}: Nama BAB kosong`);
      if (!String(r["Nama Tugas *"] || r["Nama Tugas"] || "").trim()) strukturErrors.push(`Baris ${i + 2}: Nama tugas kosong`);
    });
    result.push({ name: "Struktur BAB & Tugas", rows: strukturRows, errors: strukturErrors, warnings: [], status: strukturErrors.length ? "error" : "valid" });

    // Parse Nilai
    const nilaiSheet = workbook.Sheets["Nilai"];
    const nilaiRows = nilaiSheet ? XLSX.utils.sheet_to_json<any>(nilaiSheet) : [];
    const nilaiErrors: string[] = [];
    nilaiRows.forEach((r, i) => {
      if (!String(r["Nama Siswa *"] || r["Nama Siswa"] || "").trim()) nilaiErrors.push(`Baris ${i + 2}: Nama siswa kosong`);
      if (!String(r["Nama Mapel *"] || r["Nama Mapel"] || "").trim()) nilaiErrors.push(`Baris ${i + 2}: Nama mapel kosong`);
      const val = Number(r["Nilai *"] || r["Nilai"]);
      if (isNaN(val)) nilaiErrors.push(`Baris ${i + 2}: Nilai tidak valid`);
    });
    result.push({ name: "Nilai", rows: nilaiRows, errors: nilaiErrors, warnings: [], status: nilaiErrors.length ? "error" : "valid" });

    // Parse Presensi
    const presensiSheet = workbook.Sheets["Presensi"];
    const presensiRows = presensiSheet ? XLSX.utils.sheet_to_json<any>(presensiSheet) : [];
    const presensiErrors: string[] = [];
    const validStatus = ["H", "I", "S", "A", "D"];
    presensiRows.forEach((r, i) => {
      if (!String(r["Nama Siswa *"] || r["Nama Siswa"] || "").trim()) presensiErrors.push(`Baris ${i + 2}: Nama siswa kosong`);
      const status = String(r["Status *"] || r["Status"] || "").toUpperCase().trim();
      if (!validStatus.includes(status)) presensiErrors.push(`Baris ${i + 2}: Status "${status}" tidak valid (H/I/S/A/D)`);
    });
    result.push({ name: "Presensi", rows: presensiRows, errors: presensiErrors, warnings: [], status: presensiErrors.length ? "error" : "valid" });

    return result;
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showError("File terlalu besar", "Maksimal 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const validated = validateSheets(wb);
        setSheets(validated);
        setStep("preview");
      } catch {
        showError("File tidak valid", "Pastikan file berformat .xlsx");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, [validateSheets, showError]);

  const totalErrors = useMemo(() => sheets.reduce((acc, s) => acc + s.errors.length, 0), [sheets]);
  const totalRows = useMemo(() => sheets.reduce((acc, s) => acc + s.rows.length, 0), [sheets]);

  const handleImport = useCallback(async () => {
    if (!user) return;
    setImporting(true);
    setStep("importing");
    const errors: string[] = [];
    let successCount = 0;

    const getVal = (row: any, ...keys: string[]) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim()) return String(row[k]).trim();
      }
      return "";
    };

    try {
      // 1. Import Kelas
      const kelasSheet = sheets.find(s => s.name === "Kelas");
      const classMap: Record<string, string> = {};
      if (kelasSheet && kelasSheet.rows.length > 0) {
        setProgress({ current: 0, total: kelasSheet.rows.length, label: "Mengimpor kelas..." });
        for (let i = 0; i < kelasSheet.rows.length; i++) {
          const r = kelasSheet.rows[i];
          const name = getVal(r, "Nama Kelas *", "Nama Kelas");
          const classKkm = Number(getVal(r, "KKM Kelas *", "KKM Kelas"));
          if (!name) continue;
          try {
            const { data } = await (supabase as any).from("classes").insert({
              name,
              class_kkm: classKkm,
              description: getVal(r, "Deskripsi") || null,
              user_id: user.id,
              academic_year_id: activeYear?.id || null,
            }).select("id").single();
            if (data) { classMap[name] = data.id; successCount++; }
          } catch (err: any) {
            errors.push(`Kelas "${name}": ${err.message}`);
          }
          setProgress(p => ({ ...p, current: i + 1 }));
        }
      }

      // 2. Import Siswa
      const siswaSheet = sheets.find(s => s.name === "Siswa");
      const studentMap: Record<string, string> = {};
      if (siswaSheet && siswaSheet.rows.length > 0) {
        setProgress({ current: 0, total: siswaSheet.rows.length, label: "Mengimpor siswa..." });
        for (let i = 0; i < siswaSheet.rows.length; i++) {
          const r = siswaSheet.rows[i];
          const kelas = getVal(r, "Nama Kelas *", "Nama Kelas");
          const nama = getVal(r, "Nama Siswa *", "Nama Siswa");
          const classId = classMap[kelas];
          if (!classId || !nama) continue;
          try {
            const { data } = await (supabase as any).from("students").insert({
              class_id: classId,
              name: nama,
              nisn: getVal(r, "NISN") || null,
              order_number: Number(getVal(r, "No Absen *", "No Absen")) || null,
            }).select("id").single();
            if (data) { studentMap[`${kelas}::${nama}`] = data.id; successCount++; }
          } catch (err: any) {
            errors.push(`Siswa "${nama}": ${err.message}`);
          }
          setProgress(p => ({ ...p, current: i + 1 }));
        }
      }

      // 3. Import Mata Pelajaran
      const mapelSheet = sheets.find(s => s.name === "Mata Pelajaran");
      const subjectMap: Record<string, string> = {};
      if (mapelSheet && mapelSheet.rows.length > 0) {
        setProgress({ current: 0, total: mapelSheet.rows.length, label: "Mengimpor mata pelajaran..." });
        for (let i = 0; i < mapelSheet.rows.length; i++) {
          const r = mapelSheet.rows[i];
          const kelas = getVal(r, "Nama Kelas *", "Nama Kelas");
          const mapel = getVal(r, "Nama Mapel *", "Nama Mapel");
          const kkm = Number(getVal(r, "KKM *", "KKM")) || 70;
          const classId = classMap[kelas];
          if (!mapel) continue;
          try {
            const { data } = await (supabase as any).from("subjects").insert({
              name: mapel,
              kkm,
              class_id: classId || null,
              user_id: user.id,
              academic_year_id: activeYear?.id || null,
            }).select("id").single();
            if (data) { subjectMap[`${kelas}::${mapel}`] = data.id; successCount++; }
          } catch (err: any) {
            errors.push(`Mapel "${mapel}": ${err.message}`);
          }
          setProgress(p => ({ ...p, current: i + 1 }));
        }
      }

      // 4. Import Struktur BAB & Tugas
      const strukturSheet = sheets.find(s => s.name === "Struktur BAB & Tugas");
      const chapterMap: Record<string, string> = {};
      const assignmentMap: Record<string, string> = {};
      if (strukturSheet && strukturSheet.rows.length > 0) {
        setProgress({ current: 0, total: strukturSheet.rows.length, label: "Mengimpor BAB & tugas..." });
        for (let i = 0; i < strukturSheet.rows.length; i++) {
          const r = strukturSheet.rows[i];
          const mapel = getVal(r, "Nama Mapel *", "Nama Mapel");
          const kelas = getVal(r, "Nama Kelas *", "Nama Kelas");
          const bab = getVal(r, "Nama BAB *", "Nama BAB");
          const tugas = getVal(r, "Nama Tugas *", "Nama Tugas");
          const subjectId = subjectMap[`${kelas}::${mapel}`];
          if (!subjectId || !bab || !tugas) continue;

          const chapterKey = `${kelas}::${mapel}::${bab}`;
          if (!chapterMap[chapterKey]) {
            try {
              const { data } = await (supabase as any).from("chapters").insert({
                subject_id: subjectId,
                name: bab,
                semester_id: activeSemester?.id || null,
              }).select("id").single();
              if (data) { chapterMap[chapterKey] = data.id; successCount++; }
            } catch (err: any) {
              errors.push(`BAB "${bab}": ${err.message}`);
            }
          }

          const chapterId = chapterMap[chapterKey];
          if (chapterId) {
            try {
              const { data } = await (supabase as any).from("assignments").insert({
                chapter_id: chapterId,
                name: tugas,
              }).select("id").single();
              if (data) { assignmentMap[`${kelas}::${mapel}::${tugas}`] = data.id; successCount++; }
            } catch (err: any) {
              errors.push(`Tugas "${tugas}": ${err.message}`);
            }
          }
          setProgress(p => ({ ...p, current: i + 1 }));
        }
      }

      // 5. Import Nilai
      const nilaiSheet = sheets.find(s => s.name === "Nilai");
      if (nilaiSheet && nilaiSheet.rows.length > 0) {
        setProgress({ current: 0, total: nilaiSheet.rows.length, label: "Mengimpor nilai..." });
        for (let i = 0; i < nilaiSheet.rows.length; i++) {
          const r = nilaiSheet.rows[i];
          const kelas = getVal(r, "Nama Kelas", "Nama Kelas *");
          const siswa = getVal(r, "Nama Siswa *", "Nama Siswa");
          const mapel = getVal(r, "Nama Mapel *", "Nama Mapel");
          const tugas = getVal(r, "Nama Tugas *", "Nama Tugas");
          const nilai = Number(getVal(r, "Nilai *", "Nilai"));
          const studentId = studentMap[`${kelas}::${siswa}`];
          const subjectId = subjectMap[`${kelas}::${mapel}`];
          const assignmentId = assignmentMap[`${kelas}::${mapel}::${tugas}`];
          if (!studentId || !subjectId) { errors.push(`Nilai baris ${i + 2}: siswa/mapel tidak ditemukan`); continue; }
          try {
            await (supabase as any).from("grades").upsert({
              student_id: studentId,
              subject_id: subjectId,
              assignment_id: assignmentId || null,
              value: Math.min(100, Math.max(0, nilai)),
              grade_type: "assignment",
            }, { onConflict: "student_id,assignment_id" });
            successCount++;
          } catch (err: any) {
            errors.push(`Nilai "${siswa}/${tugas}": ${err.message}`);
          }
          setProgress(p => ({ ...p, current: i + 1 }));
        }
      }

      // 6. Import Presensi
      const presensiSheet = sheets.find(s => s.name === "Presensi");
      if (presensiSheet && presensiSheet.rows.length > 0) {
        setProgress({ current: 0, total: presensiSheet.rows.length, label: "Mengimpor presensi..." });
        for (let i = 0; i < presensiSheet.rows.length; i++) {
          const r = presensiSheet.rows[i];
          const kelas = getVal(r, "Nama Kelas", "Nama Kelas *");
          const siswa = getVal(r, "Nama Siswa *", "Nama Siswa");
          const tanggal = getVal(r, "Tanggal *", "Tanggal");
          const status = getVal(r, "Status *", "Status").toUpperCase();
          const studentId = studentMap[`${kelas}::${siswa}`];
          const classId = classMap[kelas];
          if (!studentId || !classId) { errors.push(`Presensi baris ${i + 2}: siswa/kelas tidak ditemukan`); continue; }
          try {
            await (supabase as any).from("attendance_records").upsert({
              student_id: studentId,
              class_id: classId,
              date: tanggal,
              status,
            }, { onConflict: "student_id,date" });
            successCount++;
          } catch (err: any) {
            errors.push(`Presensi "${siswa}/${tanggal}": ${err.message}`);
          }
          setProgress(p => ({ ...p, current: i + 1 }));
        }
      }

    } catch (err: any) {
      errors.push(`Error umum: ${err.message}`);
    }

    setImportResult({ success: successCount, errors });
    setImporting(false);
    setStep("done");
  }, [user, sheets, activeYear, activeSemester]);

  const resetDialog = useCallback(() => {
    setStep("upload");
    setSheets([]);
    setExpandedSheet(null);
    setImportResult({ success: 0, errors: [] });
  }, []);
  const activeSheetDetail = useMemo(
    () => sheets.find((sheet) => sheet.name === expandedSheet) ?? null,
    [expandedSheet, sheets],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!importing) { onOpenChange(v); if (!v) resetDialog(); } }}>
      <DialogContent className="w-[calc(100vw-0.75rem)] max-w-4xl h-[min(100dvh-0.75rem,50rem)] overflow-hidden rounded-[24px] p-0 gap-0">
        <DialogHeader className="border-b border-border px-4 pt-4 pb-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Import Batch — Ekosistem Data Akademik
            <Badge variant="outline" className="text-[10px]">Multi-Sheet</Badge>
          </DialogTitle>
          <DialogDescription>
            Kelola upload, validasi, dan impor seluruh struktur akademik dari satu file Excel.
          </DialogDescription>
        </DialogHeader>

        <div ref={layoutViewportRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <StudioStepHeader
                steps={[
                  { id: "upload", label: "Upload File" },
                  { id: "preview", label: "Validasi Sheet" },
                  { id: "importing", label: "Import" },
                  { id: "done", label: "Selesai" },
                ]}
                currentStep={step}
              />

        {/* Step: Upload */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Upload file Excel multi-sheet</p>
                <p className="text-xs text-muted-foreground">Satu file untuk kelas, siswa, mapel, BAB, nilai, dan presensi</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
                <Download className="w-4 h-4" />
                Download Template
              </Button>
              <label>
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                <Button asChild className="gap-2 cursor-pointer">
                  <span>
                    <Upload className="w-4 h-4" />
                    Upload File Excel
                  </span>
                </Button>
              </label>
            </div>

            <StudioInfoCollapsible
              title="Struktur sheet yang diharapkan"
              description="Panduan ini penting karena batch import sensitif terhadap nama sheet dan kolom."
              defaultOpen
            >
              <div className="space-y-1">
                <p className="text-xs font-medium flex items-center gap-1.5"><Info className="w-3 h-3" /> Struktur Sheet yang Diharapkan:</p>
                {SHEET_NAMES.slice(1).map((name, i) => (
                  <p key={name} className="text-xs text-muted-foreground pl-4">Sheet {i + 2}: {name}</p>
                ))}
              </div>
            </StudioInfoCollapsible>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{totalRows} baris data terdeteksi</p>
              {totalErrors > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  <XCircle className="w-3 h-3 mr-1" /> {totalErrors} error
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 max-h-[50vh]">
              <div className="space-y-1.5">
                {sheets.map((sheet) => (
                  <div key={sheet.name} className="rounded-lg border border-border overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-2.5 text-left hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedSheet(expandedSheet === sheet.name ? null : sheet.name)}
                    >
                      <div className="flex items-center gap-2">
                        {expandedSheet === sheet.name ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        <span className="text-sm font-medium">{sheet.name}</span>
                        <Badge variant="secondary" className="text-[10px]">{sheet.rows.length} baris</Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {sheet.errors.length > 0 && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                        {sheet.warnings.length > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                        {sheet.errors.length === 0 && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                      </div>
                    </button>

                    {expandedSheet === sheet.name && (
                      <div className="border-t border-border p-2 space-y-2">
                        {sheet.errors.length > 0 && (
                          <div className="space-y-0.5">
                            {sheet.errors.slice(0, 5).map((err, i) => (
                              <p key={i} className="text-[11px] text-destructive flex items-start gap-1">
                                <XCircle className="w-3 h-3 mt-0.5 shrink-0" /> {err}
                              </p>
                            ))}
                            {sheet.errors.length > 5 && <p className="text-[10px] text-muted-foreground">...dan {sheet.errors.length - 5} error lainnya</p>}
                          </div>
                        )}
                        {sheet.warnings.length > 0 && (
                          <div className="space-y-0.5">
                            {sheet.warnings.slice(0, 3).map((w, i) => (
                              <p key={i} className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1">
                                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {w}
                              </p>
                            ))}
                          </div>
                        )}
                        {sheet.rows.length > 0 && (
                          <div className="overflow-x-auto max-h-[200px]">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  {Object.keys(sheet.rows[0]).map(key => (
                                    <TableHead key={key} className="text-[10px] h-7 px-2 whitespace-nowrap">{key}</TableHead>
                                  ))}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {sheet.rows.slice(0, 5).map((row, i) => (
                                  <TableRow key={i}>
                                    {Object.values(row).map((val: any, j) => (
                                      <TableCell key={j} className="text-[11px] py-1 px-2">{String(val ?? "")}</TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {sheet.rows.length > 5 && <p className="text-[10px] text-muted-foreground text-center py-1">...dan {sheet.rows.length - 5} baris lainnya</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            {viewport.isPhone && activeSheetDetail ? (
              <StudioInfoCollapsible
                title={`Fokus sheet: ${activeSheetDetail.name}`}
                description="Mode mobile menyorot detail sheet aktif agar daftar panjang tidak terasa berat."
                defaultOpen
              >
                <p className="text-xs text-muted-foreground">
                  {activeSheetDetail.rows.length} baris, {activeSheetDetail.errors.length} error, {activeSheetDetail.warnings.length} warning.
                </p>
              </StudioInfoCollapsible>
            ) : null}

            <Separator />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={resetDialog}>Batal</Button>
              <Button size="sm" onClick={handleImport} disabled={totalErrors > 0} className="gap-2">
                <Upload className="w-4 h-4" />
                Import {totalRows} Baris
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === "importing" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">{progress.label}</p>
              <p className="text-xs text-muted-foreground">{progress.current} / {progress.total}</p>
            </div>
            <div className="w-full max-w-xs bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="py-6 space-y-4">
            <div className="text-center space-y-2">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <p className="text-lg font-bold">Import Selesai</p>
              <p className="text-sm text-muted-foreground">
                {importResult.success} data berhasil diimpor
                {importResult.errors.length > 0 && `, ${importResult.errors.length} error`}
              </p>
            </div>

            {importResult.errors.length > 0 && (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive">Error Detail:</p>
                  {importResult.errors.slice(0, 20).map((err, i) => (
                    <p key={i} className="text-[11px] text-destructive/80">{err}</p>
                  ))}
                  {importResult.errors.length > 20 && (
                    <p className="text-[10px] text-muted-foreground">...dan {importResult.errors.length - 20} error lainnya</p>
                  )}
                </div>
              </ScrollArea>
            )}

            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => { resetDialog(); onOpenChange(false); }}>Tutup</Button>
              <Button onClick={resetDialog}>Import Lagi</Button>
            </div>
          </div>
        )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
