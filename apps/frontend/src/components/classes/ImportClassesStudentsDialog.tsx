import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  School,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useStudioViewportProfile } from "@/hooks/useStudioViewportProfile";
import type { Class } from "@/hooks/useClasses";
import {
  ResponsiveDataPreview,
  StudioActionFooter,
  StudioInfoCollapsible,
  StudioStepHeader,
} from "@/components/studio/ResponsiveStudio";
import {
  buildClassStudentImportPlan,
  downloadClassStudentImportTemplate,
  type ExistingClassForImport,
  type ClassStudentImportPlan,
  type ParsedImportClass,
  readClassStudentImportWorkbook,
} from "@/lib/classStudentImport";

interface ImportClassesStudentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingClasses: Class[];
}

type ImportStep = "upload" | "preview" | "importing" | "done";

interface ImportResult {
  classesCreated: number;
  classesReused: number;
  classesExcluded: number;
  studentsCreated: number;
  studentsSkipped: number;
  studentsExcluded: number;
  errors: string[];
}

function issueTone(severity: "error" | "warning" | "info") {
  if (severity === "error") return "border-destructive/25 bg-destructive/10 text-destructive";
  if (severity === "warning") return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-primary/20 bg-primary/10 text-primary";
}

function classStatusLabel(item: ParsedImportClass) {
  if (item.existingClassId) return "Sudah ada";
  return "Kelas baru";
}

function importClassKey(item: ParsedImportClass) {
  return `${item.rowNumber}:${item.normalizedName || item.name}:${item.sheetName}`;
}

export default function ImportClassesStudentsDialog({
  open,
  onOpenChange,
  existingClasses,
}: ImportClassesStudentsDialogProps) {
  const { user } = useAuth();
  const { activeYearId } = useAcademicYear();
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError, toast } = useEnhancedToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const layoutViewportRef = useRef<HTMLDivElement>(null);
  const viewport = useStudioViewportProfile(layoutViewportRef, open);

  const [fileName, setFileName] = useState("");
  const [step, setStep] = useState<ImportStep>("upload");
  const [plan, setPlan] = useState<ClassStudentImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmWarnings, setConfirmWarnings] = useState(false);
  const [progress, setProgress] = useState({ value: 0, label: "" });
  const [result, setResult] = useState<ImportResult | null>(null);
  const [includedClassKeys, setIncludedClassKeys] = useState<Set<string>>(new Set());

  const resetState = useCallback(() => {
    setFileName("");
    setStep("upload");
    setPlan(null);
    setError(null);
    setConfirmWarnings(false);
    setProgress({ value: 0, label: "" });
    setResult(null);
    setIncludedClassKeys(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen && step === "importing") return;
    if (!nextOpen) resetState();
    onOpenChange(nextOpen);
  }, [onOpenChange, resetState, step]);

  const loadExistingClassesWithStudents = useCallback(async (): Promise<ExistingClassForImport[]> => {
    if (existingClasses.length === 0) return [];

    const classIds = existingClasses.map((item) => item.id);
    const { data, error: studentsError } = await supabase
      .from("students")
      .select("id,class_id,name,nisn")
      .in("class_id", classIds);

    if (studentsError) throw studentsError;

    const studentsByClass = new Map<string, Array<{ id: string; name: string; nisn: string }>>();
    (data ?? []).forEach((student: any) => {
      const collection = studentsByClass.get(student.class_id) ?? [];
      collection.push({
        id: student.id,
        name: student.name ?? "",
        nisn: student.nisn ?? "",
      });
      studentsByClass.set(student.class_id, collection);
    });

    return existingClasses.map((item) => ({
      id: item.id,
      name: item.name,
      class_kkm: item.class_kkm,
      description: item.description,
      students: studentsByClass.get(item.id) ?? [],
    }));
  }, [existingClasses]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    setError(null);
    setPlan(null);
    setResult(null);
    setConfirmWarnings(false);

    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().match(/\.(xlsx|xls)$/)) {
      setError("Format file tidak didukung. Gunakan file Excel .xlsx atau .xls dari template SIPENA.");
      return;
    }

    try {
      setFileName(selectedFile.name);
      const [buffer, existing] = await Promise.all([
        selectedFile.arrayBuffer(),
        loadExistingClassesWithStudents(),
      ]);
      const workbook = readClassStudentImportWorkbook(buffer);
      const parsedPlan = buildClassStudentImportPlan(workbook, existing);
      setPlan(parsedPlan);
      setIncludedClassKeys(new Set(parsedPlan.classes.map(importClassKey)));
      setStep("preview");
    } catch (err: any) {
      setError(err?.message || "Gagal membaca workbook. Pastikan file berasal dari template Import Kelas & Siswa SIPENA.");
      setStep("upload");
    } finally {
      event.target.value = "";
    }
  }, [loadExistingClassesWithStudents]);

  const includedClasses = useMemo(() => {
    if (!plan) return [];
    return plan.classes.filter((item) => includedClassKeys.has(importClassKey(item)));
  }, [includedClassKeys, plan]);

  const selectedTotals = useMemo(() => {
    const students = includedClasses.flatMap((item) => item.students);
    const issues = includedClasses.flatMap((item) => [
      ...item.issues,
      ...item.students.flatMap((student) => student.issues),
    ]);
    const excludedClasses = plan ? plan.classes.filter((item) => !includedClassKeys.has(importClassKey(item))) : [];
    return {
      classCount: includedClasses.length,
      newClassCount: includedClasses.filter((item) => !item.existingClassId).length,
      existingClassCount: includedClasses.filter((item) => item.existingClassId).length,
      studentCount: students.length,
      newStudentCount: students.filter((item) => item.status === "new").length,
      skippedStudentCount: students.filter((item) => item.status === "skip-existing").length,
      warningStudentCount: students.filter((item) => item.status === "warning-name-conflict").length,
      blockedStudentCount: students.filter((item) => item.status === "blocked-nisn-conflict" || item.status === "invalid").length,
      errorCount: issues.filter((item) => item.severity === "error").length,
      warningCount: issues.filter((item) => item.severity === "warning").length,
      excludedClassCount: excludedClasses.length,
      excludedStudentCount: excludedClasses.reduce((total, item) => total + item.students.length, 0),
      issues,
    };
  }, [includedClassKeys, includedClasses, plan]);

  const canImport = useMemo(() => {
    if (!plan || step !== "preview") return false;
    if (selectedTotals.errorCount > 0) return false;
    if (selectedTotals.warningCount > 0 && !confirmWarnings) return false;
    return selectedTotals.classCount > 0;
  }, [confirmWarnings, plan, selectedTotals.classCount, selectedTotals.errorCount, selectedTotals.warningCount, step]);

  const importableStudentsCount = useMemo(() => {
    return includedClasses.reduce((total, item) => (
      total + item.students.filter((student) => student.status === "new" || student.status === "warning-name-conflict").length
    ), 0);
  }, [includedClasses]);

  const setAllClassesIncluded = useCallback((included: boolean) => {
    if (!plan) return;
    setIncludedClassKeys(included ? new Set(plan.classes.map(importClassKey)) : new Set());
    setConfirmWarnings(false);
  }, [plan]);

  const toggleClassIncluded = useCallback((key: string, included: boolean) => {
    setIncludedClassKeys((current) => {
      const next = new Set(current);
      if (included) next.add(key);
      else next.delete(key);
      return next;
    });
    setConfirmWarnings(false);
  }, []);

  const handleImport = useCallback(async () => {
    if (!user || !activeYearId || !plan || !canImport) {
      if (!activeYearId) showError("Import belum bisa dijalankan", "Tahun ajaran aktif belum tersedia.");
      return;
    }

    setStep("importing");
    setProgress({ value: 3, label: "Menyiapkan import..." });

    const errors: string[] = [];
    const classIdMap = new Map<string, string>();
    let classesCreated = 0;
    let classesReused = 0;
    let studentsCreated = 0;
    let studentsSkipped = selectedTotals.skippedStudentCount;
    const totalWork = Math.max(selectedTotals.newClassCount + importableStudentsCount, 1);
    let completed = 0;

    const updateProgress = (label: string) => {
      completed += 1;
      setProgress({ value: Math.min(99, Math.round((completed / totalWork) * 100)), label });
    };

    try {
      for (const item of includedClasses) {
        if (item.existingClassId) {
          classIdMap.set(item.normalizedName, item.existingClassId);
          classesReused += 1;
          continue;
        }

        const { data, error: insertError } = await supabase
          .from("classes")
          .insert({
            user_id: user.id,
            name: item.name,
            description: item.description || null,
            class_kkm: item.classKkm,
            academic_year_id: activeYearId,
            semester_id: null,
          })
          .select("id")
          .single();

        if (insertError || !data) {
          errors.push(`Kelas "${item.name}": ${insertError?.message || "gagal dibuat"}`);
          continue;
        }

        classIdMap.set(item.normalizedName, data.id);
        classesCreated += 1;
        updateProgress(`Membuat kelas ${item.name}`);
      }

      for (const item of includedClasses) {
        const classId = classIdMap.get(item.normalizedName);
        if (!classId) {
          const skipped = item.students.filter((student) => student.status === "new" || student.status === "warning-name-conflict").length;
          studentsSkipped += skipped;
          continue;
        }

        const studentsToInsert = item.students
          .filter((student) => student.status === "new" || student.status === "warning-name-conflict")
          .map((student) => ({
            user_id: user.id,
            class_id: classId,
            name: student.name,
            nisn: student.nisn,
          }));

        if (studentsToInsert.length === 0) continue;

        const { data, error: insertError } = await supabase
          .from("students")
          .insert(studentsToInsert)
          .select("id");

        if (insertError) {
          errors.push(`Siswa kelas "${item.name}": ${insertError.message}`);
          studentsSkipped += studentsToInsert.length;
        } else {
          studentsCreated += data?.length ?? studentsToInsert.length;
        }

        studentsToInsert.forEach(() => updateProgress(`Mengimpor siswa ${item.name}`));
      }
    } catch (err: any) {
      errors.push(err?.message || "Terjadi error saat import.");
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["classes"] }),
      queryClient.invalidateQueries({ queryKey: ["students"] }),
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] }),
    ]);

    const finalResult = {
      classesCreated,
      classesReused,
      classesExcluded: selectedTotals.excludedClassCount,
      studentsCreated,
      studentsSkipped,
      studentsExcluded: selectedTotals.excludedStudentCount,
      errors,
    };
    setResult(finalResult);
    setProgress({ value: 100, label: "Import selesai." });
    setStep("done");

    if (errors.length > 0) {
      toast({
        title: "Import selesai dengan catatan",
        description: `${studentsCreated} siswa berhasil dibuat, ${errors.length} error perlu diperiksa.`,
        variant: "warning",
      });
    } else {
      showSuccess("Import berhasil", `${classesCreated} kelas baru dan ${studentsCreated} siswa berhasil ditambahkan.`);
    }
  }, [activeYearId, canImport, importableStudentsCount, includedClasses, plan, queryClient, selectedTotals.excludedClassCount, selectedTotals.excludedStudentCount, selectedTotals.newClassCount, selectedTotals.skippedStudentCount, showError, showSuccess, toast, user]);

  const previewRows = useMemo(() => {
    if (!plan) return [];
    return plan.classes.map((item) => {
      const key = importClassKey(item);
      const included = includedClassKeys.has(key);
      return {
        key,
        included,
        className: item.name,
        sheetName: item.sheetName,
        status: included ? classStatusLabel(item) : "Tidak dipilih",
        students: item.students.length,
        newStudents: item.students.filter((student) => student.status === "new").length,
        warnings: item.students.filter((student) => student.status === "warning-name-conflict").length + item.issues.filter((issue) => issue.severity === "warning").length,
        errors: item.students.filter((student) => student.status === "invalid" || student.status === "blocked-nisn-conflict").length + item.issues.filter((issue) => issue.severity === "error").length,
      };
    });
  }, [includedClassKeys, plan]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="w-[calc(100vw-0.75rem)] max-w-5xl h-[min(100dvh-0.75rem,48rem)] overflow-hidden rounded-[24px] p-0 gap-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <DialogHeader className="border-b border-border px-4 pt-4 pb-3 sm:px-5">
          <DialogTitle ref={titleRef} tabIndex={-1} className="flex items-center justify-center gap-2 pr-8 text-base outline-none sm:justify-start sm:text-lg">
            <School className="h-5 w-5 text-primary" />
            Import Kelas & Siswa
          </DialogTitle>
          <DialogDescription className="text-center sm:text-left">
            Tambahkan banyak kelas dan siswa dari satu file Excel resmi SIPENA.
          </DialogDescription>
        </DialogHeader>

        <div ref={layoutViewportRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="space-y-4">
              <StudioStepHeader
                steps={[
                  { id: "upload", label: "Pilih File" },
                  { id: "preview", label: "Cek Data" },
                  { id: "importing", label: "Import" },
                  { id: "done", label: "Selesai" },
                ]}
                currentStep={step}
              />

              {step === "upload" && (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.72fr)]">
                  <div className="space-y-4">
                    <button
                      type="button"
                      className="flex min-h-[11rem] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <FileSpreadsheet className="mb-3 h-11 w-11 text-muted-foreground" />
                      <p className="text-sm font-semibold text-foreground">{fileName || "Pilih file Excel"}</p>
                      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                        Pakai template resmi agar kelas dan siswa terbaca rapi sesuai format SIPENA.
                      </p>
                    </button>

                    {error ? (
                      <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-border bg-background/70 p-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Template resmi</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Unduh template, isi daftar kelas dan siswa, lalu upload kembali di sini.
                      </p>
                    </div>
                    <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={downloadClassStudentImportTemplate}>
                      <Download className="h-4 w-4" />
                      Download Template
                    </Button>
                    <StudioInfoCollapsible
                      title="Aturan import"
                      description="Ringkasan singkat agar file mudah dibaca SIPENA."
                      defaultOpen
                    >
                      <ul className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
                        <li>Isi sheet Kelas untuk nama kelas, KKM, deskripsi, dan nama sheet siswa.</li>
                        <li>Isi satu sheet siswa untuk setiap kelas, misalnya Siswa - VIIA dan Siswa - VIIB.</li>
                        <li>Kolom wajib: Nama Kelas, KKM Kelas, Nama Siswa, dan NISN.</li>
                        <li>Kelas atau siswa yang sudah ada tidak akan dibuat dobel.</li>
                        <li>Catatan merah harus diperbaiki sebelum import. Catatan kuning boleh dilanjutkan setelah dicek.</li>
                      </ul>
                    </StudioInfoCollapsible>
                  </div>
                </div>
              )}

              {step === "preview" && plan && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-primary/5 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Pilih kelas yang ingin dimasukkan</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {selectedTotals.classCount} dari {plan.totals.classCount} kelas dipilih, berisi {selectedTotals.studentCount} siswa. Geser tabel ke samping bila kolom belum terlihat penuh.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setAllClassesIncluded(true)}>
                        Pilih Semua
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="h-9 text-xs" onClick={() => setAllClassesIncluded(false)}>
                        Hapus Pilihan
                      </Button>
                    </div>
                  </div>

                  <ResponsiveDataPreview
                    rows={previewRows}
                    profile={viewport.profile}
                    mode="table"
                    getRowKey={(row) => row.key}
                    detailLabel="Lihat tabel kelas"
                    columns={[
                      {
                        id: "include",
                        label: "Ikut",
                        className: "w-20 text-center",
                        cellClassName: "text-center",
                        render: (row) => (
                          <Checkbox
                            checked={row.included}
                            onCheckedChange={(value) => toggleClassIncluded(row.key, value === true)}
                            aria-label={`Ikutkan kelas ${row.className}`}
                            className="sipena-import-class-include-checkbox h-5 w-5 rounded-full touch-pan-x"
                          />
                        ),
                      },
                      {
                        id: "className",
                        label: "Kelas",
                        primary: true,
                        render: (row) => row.className,
                      },
                      {
                        id: "sheetName",
                        label: "Sheet",
                        render: (row) => row.sheetName,
                      },
                      {
                        id: "status",
                        label: "Status",
                        render: (row) => (
                          <Badge variant={row.included ? "outline" : "secondary"} className="whitespace-nowrap">
                            {row.status}
                          </Badge>
                        ),
                      },
                      {
                        id: "students",
                        label: "Siswa",
                        render: (row) => `${row.students} data`,
                      },
                      {
                        id: "issues",
                        label: "Catatan",
                        render: (row) => row.errors || row.warnings ? `${row.errors} perlu diperbaiki, ${row.warnings} perlu dicek` : "Aman",
                      },
                    ]}
                  />

                  {selectedTotals.issues.length > 0 ? (
                    <div className="rounded-2xl border border-border bg-background/70">
                      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <p className="text-sm font-semibold">Catatan kelas terpilih</p>
                        </div>
                        <Badge variant="outline">{selectedTotals.issues.length} catatan</Badge>
                      </div>
                      <ScrollArea className="max-h-56">
                        <div className="space-y-2 p-3">
                          {selectedTotals.issues.map((item, index) => (
                            <div key={`${item.sheetName}-${item.rowNumber}-${index}`} className={`rounded-xl border px-3 py-2 text-xs ${issueTone(item.severity)}`}>
                              <span className="font-semibold uppercase">{item.severity}</span>
                              <span className="mx-1.5">-</span>
                              <span>{item.sheetName}{item.rowNumber ? ` baris ${item.rowNumber}` : ""}: {item.message}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Kelas terpilih siap diimpor tanpa catatan.
                    </div>
                  )}

                  {selectedTotals.warningCount > 0 ? (
                    <label className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm">
                      <Checkbox
                        checked={confirmWarnings}
                        onCheckedChange={(value) => setConfirmWarnings(value === true)}
                        className="mt-0.5"
                      />
                      <span className="leading-relaxed">
                        Saya sudah memeriksa catatan kuning dan ingin melanjutkan. Nama siswa yang sama dengan NISN berbeda akan tetap ditambahkan sebagai siswa baru.
                      </span>
                    </label>
                  ) : null}

                  {selectedTotals.classCount === 0 ? (
                    <div className="flex items-start gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      Pilih minimal satu kelas agar import dapat dijalankan.
                    </div>
                  ) : null}
                </div>
              )}

              {step === "importing" && (
                <div className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-background/70 p-6 text-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-semibold">Mengimpor data</p>
                    <p className="mt-1 text-xs text-muted-foreground">{progress.label || "Mohon tunggu, data sedang disimpan."}</p>
                  </div>
                  <Progress value={progress.value} className="h-3" />
                  <p className="text-xs text-muted-foreground">{progress.value}%</p>
                </div>
              )}

              {step === "done" && result && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <p className="text-sm font-semibold">Import selesai</p>
                    </div>
                    <Separator className="my-3" />
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Badge variant="outline" className="justify-center py-2">{result.classesCreated} kelas baru</Badge>
                      <Badge variant="outline" className="justify-center py-2">{result.classesReused} kelas existing</Badge>
                      <Badge variant="outline" className="justify-center py-2">{result.studentsCreated} siswa dibuat</Badge>
                      <Badge variant="outline" className="justify-center py-2">{result.studentsSkipped} siswa dilewati</Badge>
                      <Badge variant="outline" className="justify-center py-2 sm:col-span-2 lg:col-span-4">{result.classesExcluded} kelas tidak diimport, {result.studentsExcluded} siswa tidak diimport</Badge>
                    </div>
                  </div>

                  {result.errors.length > 0 ? (
                    <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-3">
                      <p className="text-sm font-semibold text-destructive">Error saat simpan</p>
                      <ul className="mt-2 space-y-1 text-xs text-destructive">
                        {result.errors.map((item, index) => (
                          <li key={`${item}-${index}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>

        <StudioActionFooter
          sticky
          helperText={(
            step === "preview"
              ? "Data baru akan disimpan hanya untuk kelas yang dicentang."
              : "Gunakan template resmi agar daftar kelas dan siswa mudah dicek."
          )}
          actions={(
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} className="h-11 w-full text-xs sm:h-9 sm:w-auto">
                {step === "done" ? "Tutup" : "Batal"}
              </Button>
              {step === "upload" ? (
                <Button type="button" onClick={() => fileInputRef.current?.click()} className="h-11 w-full gap-2 text-xs sm:h-9 sm:w-auto">
                  <Upload className="h-4 w-4" />
                  Upload Workbook
                </Button>
              ) : null}
              {step === "preview" ? (
                <Button type="button" onClick={handleImport} disabled={!canImport} className="h-11 w-full gap-2 text-xs sm:h-9 sm:w-auto">
                  <Upload className="h-4 w-4" />
                  Import Kelas & Siswa
                </Button>
              ) : null}
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
