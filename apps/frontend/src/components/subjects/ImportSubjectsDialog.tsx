import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Copy, Loader2, School } from "lucide-react";

import { ResponsiveDataPreview, StudioActionFooter } from "@/components/studio/ResponsiveStudio";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useStudioViewportProfile } from "@/hooks/useStudioViewportProfile";
import type { Class } from "@/hooks/useClasses";
import { useSubjectImportSources } from "@/hooks/useSubjectImportSources";
import { type Subject, useSubjects } from "@/hooks/useSubjects";
import { buildSubjectBatchPlan } from "@/lib/subjectBatch";

interface ImportSubjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetClass: Class;
  targetSubjects: Subject[];
}

interface ImportPreviewRow {
  subject: Subject;
  status: "ready" | "existing";
}

interface StructureSummary {
  chapters: number;
  assignments: number;
  formulas: number;
  links: number;
}

const EMPTY_STRUCTURE_SUMMARY: StructureSummary = {
  chapters: 0,
  assignments: 0,
  formulas: 0,
  links: 0,
};

export default function ImportSubjectsDialog({
  open,
  onOpenChange,
  targetClass,
  targetSubjects,
}: ImportSubjectsDialogProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const viewport = useStudioViewportProfile(layoutRef, open);
  const { academicYears, semesters, activeSemesterNumber } = useAcademicYear();
  const [sourceYearId, setSourceYearId] = useState("");
  const [sourceSemesterId, setSourceSemesterId] = useState("");
  const [sourceClassId, setSourceClassId] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [includeStructure, setIncludeStructure] = useState(false);
  const [structureAcknowledged, setStructureAcknowledged] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [structureSummary, setStructureSummary] = useState(EMPTY_STRUCTURE_SUMMARY);
  const [structureSummaryLoading, setStructureSummaryLoading] = useState(false);
  const [structureSummaryError, setStructureSummaryError] = useState<string | null>(null);

  const {
    sourceClasses: availableSourceClasses,
    isLoading: sourceClassesLoading,
    error: sourceClassesError,
    refetch: refetchSourceClasses,
  } = useSubjectImportSources(open);
  const { subjects: sourceSubjects, isLoading: sourceSubjectsLoading, importSubjectsFromClass } = useSubjects(sourceClassId, false, false);

  const targetSemester = useMemo(() => (
    semesters.find((semester) => (
      semester.academic_year_id === targetClass.academic_year_id && semester.is_active
    )) || semesters.find((semester) => semester.id === targetClass.semester_id) || null
  ), [semesters, targetClass.academic_year_id, targetClass.semester_id]);

  const sourceSemesters = useMemo(
    () => semesters.filter((semester) => semester.academic_year_id === sourceYearId),
    [semesters, sourceYearId],
  );

  const sourceClasses = useMemo(() => availableSourceClasses.filter((item) => (
    item.id !== targetClass.id
    && item.academic_year_id === sourceYearId
    && (!sourceSemesterId || item.semester_id === sourceSemesterId || item.semester_id === null)
  )), [availableSourceClasses, sourceSemesterId, sourceYearId, targetClass.id]);

  const previewRows = useMemo<ImportPreviewRow[]>(() => {
    const plan = buildSubjectBatchPlan(
      sourceSubjects.map((subject) => ({
        id: subject.id,
        name: subject.name,
        kkm: subject.kkm,
        isCustom: subject.is_custom,
      })),
      targetSubjects.map((subject) => subject.name),
    );

    const subjectsById = new Map(sourceSubjects.map((subject) => [subject.id, subject]));
    return plan.flatMap((planned) => {
      const subject = subjectsById.get(planned.id);
      return subject ? [{
        subject,
        status: planned.status === "ready" ? "ready" as const : "existing" as const,
      }] : [];
    });
  }, [sourceSubjects, targetSubjects]);

  const readyRows = useMemo(() => previewRows.filter((row) => row.status === "ready"), [previewRows]);
  const selectedReadyIds = useMemo(
    () => readyRows.map((row) => row.subject.id).filter((id) => selectedSubjectIds.has(id)),
    [readyRows, selectedSubjectIds],
  );
  const selectionFingerprint = readyRows.map((row) => row.subject.id).join("|");
  const selectedFingerprint = useMemo(
    () => [...selectedReadyIds].sort().join("|"),
    [selectedReadyIds],
  );

  useEffect(() => {
    if (!open || typeof performance === "undefined") return undefined;
    performance.mark("sipena-subject-import-opened");
    const frame = requestAnimationFrame(() => {
      performance.mark("sipena-subject-import-painted");
      performance.measure(
        "sipena-subject-import-open-to-paint",
        "sipena-subject-import-opened",
        "sipena-subject-import-painted",
      );
      if (performance.getEntriesByName("sipena-subject-import-triggered", "mark").length > 0) {
        performance.measure(
          "sipena-subject-import-trigger-to-paint",
          "sipena-subject-import-triggered",
          "sipena-subject-import-painted",
        );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const fallbackYear = academicYears.find((year) => year.id !== targetClass.academic_year_id)
      || academicYears.find((year) => year.id === targetClass.academic_year_id);
    setSourceYearId(fallbackYear?.id || "");
    setSourceClassId("");
    setIncludeStructure(false);
    setStructureAcknowledged(false);
  }, [academicYears, open, targetClass.academic_year_id]);

  useEffect(() => {
    const preferredSemester = sourceSemesters.find((semester) => semester.number === (targetSemester?.number || activeSemesterNumber))
      || sourceSemesters[0];
    setSourceSemesterId(preferredSemester?.id || "");
    setSourceClassId("");
  }, [activeSemesterNumber, sourceSemesters, targetSemester?.number]);

  useEffect(() => {
    setSelectedSubjectIds(new Set(readyRows.map((row) => row.subject.id)));
    setIncludeStructure(false);
    setStructureAcknowledged(false);
    setStructureSummary(EMPTY_STRUCTURE_SUMMARY);
    setStructureSummaryError(null);
  }, [readyRows, selectionFingerprint]);

  useEffect(() => {
    if (!sourceClassId || sourceSubjectsLoading || typeof performance === "undefined") return undefined;
    const frame = requestAnimationFrame(() => {
      performance.mark("sipena-subject-import-preview-ready");
      try {
        performance.measure(
          "sipena-subject-import-source-to-preview",
          "sipena-subject-import-source-selected",
          "sipena-subject-import-preview-ready",
        );
      } catch {
        // The source may come from restored state rather than an explicit selection.
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [sourceClassId, sourceSubjectsLoading]);

  const structureAvailable = Boolean(sourceSemesterId && targetSemester?.id);

  const loadStructureSummary = useCallback(async (): Promise<StructureSummary> => {
    if (selectedReadyIds.length === 0 || !sourceSemesterId) return EMPTY_STRUCTURE_SUMMARY;

    const { data: chapters, error: chaptersError } = await supabase
      .from("chapters")
      .select("id")
      .in("subject_id", selectedReadyIds)
      .or(`semester_id.eq.${sourceSemesterId},semester_id.is.null`);
    if (chaptersError) throw chaptersError;

    const chapterIds = (chapters || []).map((chapter) => chapter.id);
    const assignmentsPromise = chapterIds.length > 0
      ? supabase
        .from("assignments")
        .select("id", { count: "exact", head: true })
        .in("chapter_id", chapterIds)
        .or(`semester_id.eq.${sourceSemesterId},semester_id.is.null`)
      : Promise.resolve({ count: 0, error: null });

    const [assignmentsResult, formulasResult, linksResult] = await Promise.all([
      assignmentsPromise,
      supabase.from("grade_formula_settings").select("id", { count: "exact", head: true }).in("subject_id", selectedReadyIds),
      supabase
        .from("shared_links")
        .select("id", { count: "exact", head: true })
        .eq("class_id", sourceClassId)
        .in("subject_id", selectedReadyIds)
        .eq("revoked", false)
        .gt("expired_at", new Date().toISOString()),
    ]);

    if (assignmentsResult.error) throw assignmentsResult.error;
    if (formulasResult.error) throw formulasResult.error;
    if (linksResult.error) throw linksResult.error;

    return {
      chapters: chapters?.length || 0,
      assignments: assignmentsResult.count || 0,
      formulas: formulasResult.count || 0,
      links: linksResult.count || 0,
    };
  }, [selectedReadyIds, sourceClassId, sourceSemesterId]);
  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  const resetAndClose = useCallback((nextOpen: boolean) => {
    if (importSubjectsFromClass.isPending) return;
    if (!nextOpen) {
      setFinalConfirmOpen(false);
      setSelectedSubjectIds(new Set());
    }
    onOpenChange(nextOpen);
  }, [importSubjectsFromClass.isPending, onOpenChange]);

  const handleSourceClassChange = useCallback((value: string) => {
    if (typeof performance !== "undefined") performance.mark("sipena-subject-import-source-selected");
    setSourceClassId(value);
  }, []);

  const runImport = async () => {
    const result = await importSubjectsFromClass.mutateAsync({
      target_class_id: targetClass.id,
      source_class_id: sourceClassId,
      subject_ids: selectedReadyIds,
      source_semester_id: includeStructure ? sourceSemesterId : null,
      target_semester_id: includeStructure ? targetSemester?.id : null,
      include_structure: includeStructure,
    });
    if (result.created > 0 || result.skipped > 0) resetAndClose(false);
  };

  const reviewImport = async () => {
    if (!includeStructure) {
      setStructureSummary(EMPTY_STRUCTURE_SUMMARY);
      setFinalConfirmOpen(true);
      return;
    }

    setStructureSummaryLoading(true);
    setStructureSummaryError(null);
    try {
      const summary = await queryClient.fetchQuery({
        queryKey: [
          "subject-import-structure-summary",
          sourceClassId,
          sourceSemesterId,
          selectedFingerprint,
        ],
        queryFn: loadStructureSummary,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
      });
      setStructureSummary(summary);
      setFinalConfirmOpen(true);
    } catch {
      setStructureSummaryError("Rincian struktur belum dapat dihitung. Periksa koneksi lalu coba lagi.");
    } finally {
      setStructureSummaryLoading(false);
    }
  };

  const noOtherYears = academicYears.length === 0;
  const noSourceClasses = !sourceClassesLoading && Boolean(sourceYearId && sourceClasses.length === 0);
  const allSubjectsExisting = previewRows.length > 0 && readyRows.length === 0;
  const canContinue = selectedReadyIds.length > 0
    && !structureSummaryLoading
    && (!includeStructure || (structureAvailable && structureAcknowledged));

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent
        ref={layoutRef}
        motionProfile="adaptive"
        className="max-h-[min(96dvh,54rem)] min-w-0 max-w-5xl overflow-x-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => titleRef.current?.focus());
        }}
      >
        <div className="min-w-0 px-4 pt-5 sm:px-6 sm:pt-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle ref={titleRef} tabIndex={-1} className="flex items-center gap-2 outline-none">
              <Copy className="h-5 w-5 text-primary" /> Import Mapel
            </DialogTitle>
            <DialogDescription>
              Ambil mapel dan KKM dari kelas lain. Mapel yang sudah ada di {targetClass.name} tidak akan diubah.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-w-0 space-y-4 px-4 pb-2 sm:px-6">
          <div className="grid gap-3 rounded-2xl border border-border bg-muted/20 p-3 md:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Tahun Ajaran</Label>
              <Select value={sourceYearId} onValueChange={setSourceYearId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih tahun" /></SelectTrigger>
                <SelectContent isEmpty={academicYears.length === 0} emptyLabel="Tidak ada pilihan Tahun Ajaran">
                  {academicYears.map((year) => <SelectItem key={year.id} value={year.id}>{year.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Semester</Label>
              <Select value={sourceSemesterId} onValueChange={(value) => { setSourceSemesterId(value); setSourceClassId(""); }}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Pilih semester" /></SelectTrigger>
                <SelectContent isEmpty={sourceSemesters.length === 0} emptyLabel="Tidak ada pilihan Semester">
                  {sourceSemesters.map((semester) => <SelectItem key={semester.id} value={semester.id}>{semester.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Kelas Sumber</Label>
              <Select value={sourceClassId} onValueChange={handleSourceClassChange} disabled={sourceClassesLoading || Boolean(sourceClassesError)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder={sourceClassesLoading ? "Memuat kelas..." : "Pilih kelas"} /></SelectTrigger>
                <SelectContent isEmpty={!sourceClassesLoading && sourceClasses.length === 0} emptyLabel="Tidak ada pilihan Kelas Sumber">
                  {sourceClasses.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {sourceClassesLoading ? (
            <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-border">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Menyiapkan kelas sumber...</span>
            </div>
          ) : sourceClassesError ? (
            <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-center text-sm">
              <p className="text-destructive">Daftar kelas sumber belum dapat dimuat.</p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refetchSourceClasses()}>Coba Lagi</Button>
            </div>
          ) : !sourceClassId ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              <School className="mx-auto mb-2 h-7 w-7" />
              {noOtherYears
                ? "Belum ada tahun ajaran yang dapat digunakan sebagai sumber."
                : noSourceClasses
                  ? "Tidak ada kelas lain pada tahun ajaran dan semester ini."
                  : "Pilih kelas sumber untuk melihat daftar mapel."}
            </div>
          ) : sourceSubjectsLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : previewRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Kelas sumber belum memiliki mata pelajaran.
            </div>
          ) : allSubjectsExisting ? (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
              Seluruh mapel dari kelas sumber sudah ada di kelas tujuan. KKM kelas tujuan tetap dipertahankan.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Pilih mapel yang akan diambil</p>
                  <p className="text-xs text-muted-foreground">{selectedReadyIds.length} dari {readyRows.length} mapel baru dipilih.</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="min-h-11 touch-manipulation" onClick={() => setSelectedSubjectIds(new Set(readyRows.map((row) => row.subject.id)))}>Pilih Semua</Button>
                  <Button type="button" variant="outline" size="sm" className="min-h-11 touch-manipulation" onClick={() => setSelectedSubjectIds(new Set())}>Hapus Pilihan</Button>
                </div>
              </div>

              <ResponsiveDataPreview
                rows={previewRows}
                profile={viewport.profile}
                mode={viewport.isPhone ? "cards" : "table"}
                getRowKey={(row) => row.subject.id}
                columns={[
                  {
                    id: "subject",
                    label: "Mata Pelajaran",
                    primary: true,
                    className: "w-[34%]",
                    render: (row) => (
                      <label className="flex min-h-11 cursor-pointer select-none items-center gap-3 touch-manipulation">
                        <Checkbox
                          checked={row.status === "ready" && selectedSubjectIds.has(row.subject.id)}
                          disabled={row.status !== "ready"}
                          onCheckedChange={() => toggleSubject(row.subject.id)}
                          aria-label={`Sertakan ${row.subject.name}`}
                        />
                        <span className="font-medium">{row.subject.name}</span>
                      </label>
                    ),
                  },
                  { id: "kkm", label: "KKM", className: "w-[14%]", cellClassName: "text-center", render: (row) => row.subject.kkm },
                  { id: "type", label: "Jenis", className: "w-[18%]", cellClassName: "text-center", render: (row) => row.subject.is_custom ? "Custom" : "Katalog" },
                  {
                    id: "status",
                    label: "Status",
                    className: "w-[34%]",
                    cellClassName: "text-center",
                    render: (row) => row.status === "ready"
                      ? <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">Siap diambil</Badge>
                      : <Badge variant="secondary">Sudah ada, dilewati</Badge>,
                  },
                ]}
              />

              <Separator />
              <div className="rounded-2xl border border-border p-3">
                <label className="flex min-h-11 cursor-pointer select-none items-start gap-3 touch-manipulation">
                  <Checkbox
                    checked={includeStructure}
                    disabled={!structureAvailable}
                    onCheckedChange={(checked) => {
                      setIncludeStructure(checked === true);
                      setStructureAcknowledged(false);
                    }}
                    aria-label="Sertakan struktur pembelajaran"
                  />
                  <span>
                    <span className="block text-sm font-semibold">Sertakan struktur pembelajaran</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      Salin BAB, tugas, rumus, pembulatan, dan buat link baru dari link sumber yang masih aktif. Nilai siswa tidak pernah disalin.
                    </span>
                  </span>
                </label>
                {!structureAvailable && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4" /> Struktur hanya dapat disalin bila semester sumber dan tujuan tersedia.
                  </p>
                )}
                {includeStructure && (
                  <div className="mt-3 space-y-3 rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Jumlah BAB, tugas, rumus, dan link dihitung satu kali saat Anda memilih Periksa & Import.
                    </p>
                    <label className="flex min-h-11 cursor-pointer select-none items-start gap-3 touch-manipulation">
                      <Checkbox checked={structureAcknowledged} onCheckedChange={(checked) => setStructureAcknowledged(checked === true)} />
                      <span className="text-xs leading-relaxed">Saya memahami struktur akan dibuat untuk semester tujuan dan tidak mencakup nilai siswa atau histori link lama.</span>
                    </label>
                  </div>
                )}
                {structureSummaryError ? <p className="mt-2 text-xs text-destructive">{structureSummaryError}</p> : null}
              </div>
            </>
          )}
        </div>

        <StudioActionFooter
          sticky
          helperText={`Kelas tujuan: ${targetClass.name}. KKM mapel yang sudah ada tidak akan ditimpa.`}
          actions={[
            <Button key="cancel" type="button" variant="outline" className="min-h-11 touch-manipulation" onClick={() => resetAndClose(false)}>Batal</Button>,
            <Button key="continue" type="button" className="min-h-11 touch-manipulation" disabled={!canContinue} onClick={() => void reviewImport()}>
              {structureSummaryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {structureSummaryLoading ? "Menghitung..." : "Periksa & Import"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>,
          ]}
        />
      </DialogContent>

      <AlertDialog open={finalConfirmOpen} onOpenChange={setFinalConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Import Mapel</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">{selectedReadyIds.length} mapel akan ditambahkan ke {targetClass.name}.</span>
              {includeStructure && (
                <span className="block rounded-xl bg-muted p-3 text-foreground">
                  Struktur: {structureSummary.chapters} BAB, {structureSummary.assignments} tugas, {structureSummary.formulas} rumus, dan {structureSummary.links} link baru.
                </span>
              )}
              <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Nilai siswa tidak akan disalin.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importSubjectsFromClass.isPending}>Kembali</AlertDialogCancel>
            <AlertDialogAction disabled={importSubjectsFromClass.isPending} onClick={(event) => { event.preventDefault(); void runImport(); }}>
              {importSubjectsFromClass.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Ya, Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
