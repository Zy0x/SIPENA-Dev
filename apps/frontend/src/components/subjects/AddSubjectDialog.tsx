import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ListPlus, Loader2, Plus, Search, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useSubjects } from "@/hooks/useSubjects";
import { DEFAULT_SUBJECT_GROUPS, type DefaultSubjectGroup } from "@/lib/defaultSubjects";
import { buildSubjectBatchPlan, normalizeSubjectName } from "@/lib/subjectBatch";
import { cn } from "@/lib/utils";

interface AddSubjectDialogProps {
  classId: string;
  className: string;
  defaultKkm?: number | null;
  trigger?: React.ReactNode;
  openOnMountKey?: string;
  onSuccess?: () => void;
}

interface BatchSubjectDraft {
  id: string;
  name: string;
  kkm: number;
  isCustom: boolean;
}

type AddMode = "single" | "batch";
type SubjectGroupFilter = "all" | DefaultSubjectGroup["id"];

export default function AddSubjectDialog({
  classId,
  className,
  defaultKkm,
  trigger,
  openOnMountKey,
  onSuccess,
}: AddSubjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AddMode>("single");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [customName, setCustomName] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [activeSubjectGroup, setActiveSubjectGroup] = useState<SubjectGroupFilter>("all");
  const [kkm, setKkm] = useState((defaultKkm ?? 70).toString());
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [batchSubjects, setBatchSubjects] = useState<BatchSubjectDraft[]>([]);
  const [batchCustomName, setBatchCustomName] = useState("");
  const openedKeysRef = useRef(new Set<string>());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { subjects, createSubject, createSubjectsBatch } = useSubjects(classId);
  const { warning } = useEnhancedToast();

  const effectiveDefaultKkm = defaultKkm ?? 70;
  const isCustom = selectedSubject === "Lainnya";
  const subjectName = isCustom ? customName : selectedSubject;
  const existingNames = useMemo(() => subjects.map((subject) => subject.name), [subjects]);
  const existingNormalizedNames = useMemo(
    () => new Set(existingNames.map(normalizeSubjectName)),
    [existingNames],
  );
  const subjectGroupOptions = useMemo(() => {
    const options = new Map<string, { name: string; groupIds: DefaultSubjectGroup["id"][]; labels: string[] }>();
    DEFAULT_SUBJECT_GROUPS.forEach((group) => {
      group.subjects.forEach((subject) => {
        const existing = options.get(subject);
        if (existing) {
          existing.groupIds.push(group.id);
          existing.labels.push(group.label);
        } else {
          options.set(subject, { name: subject, groupIds: [group.id], labels: [group.label] });
        }
      });
    });
    return Array.from(options.values());
  }, []);
  const filteredSubjectOptions = useMemo(() => {
    const normalizedSearch = subjectSearch.trim().toLowerCase();
    return subjectGroupOptions.filter((option) => {
      const matchesGroup = activeSubjectGroup === "all" || option.groupIds.includes(activeSubjectGroup);
      return matchesGroup && (!normalizedSearch || option.name.toLowerCase().includes(normalizedSearch));
    });
  }, [activeSubjectGroup, subjectGroupOptions, subjectSearch]);
  const batchPlan = useMemo(
    () => buildSubjectBatchPlan(batchSubjects, existingNames),
    [batchSubjects, existingNames],
  );
  const batchHasInvalid = batchPlan.some((subject) => subject.status !== "ready");

  useEffect(() => {
    if (open) setKkm(effectiveDefaultKkm.toString());
  }, [effectiveDefaultKkm, open]);

  useEffect(() => {
    if (!openOnMountKey || openedKeysRef.current.has(openOnMountKey)) return;
    openedKeysRef.current.add(openOnMountKey);
    setOpen(true);
  }, [openOnMountKey]);

  const checkDuplicate = (name: string) => existingNormalizedNames.has(normalizeSubjectName(name));
  const suggestAlternativeName = (name: string) => {
    let counter = 2;
    let suggestedName = `${name} ${counter}`;
    while (checkDuplicate(suggestedName)) {
      counter += 1;
      suggestedName = `${name} ${counter}`;
    }
    return suggestedName;
  };

  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value);
    setDuplicateWarning(null);
    if (value !== "Lainnya" && checkDuplicate(value)) {
      setDuplicateWarning(`Mata pelajaran "${value}" sudah ada di kelas ini.`);
    }
  };

  const handleSelectCustomSubject = () => {
    setSelectedSubject("Lainnya");
    setDuplicateWarning(null);
    if (!customName.trim() && subjectSearch.trim()) setCustomName(subjectSearch.trim());
  };

  const handleCustomNameChange = (value: string) => {
    setCustomName(value);
    setDuplicateWarning(value.trim() && checkDuplicate(value) ? `Mata pelajaran "${value.trim()}" sudah ada.` : null);
  };

  const handleUseSuggestion = () => {
    const suggestedName = suggestAlternativeName(isCustom ? customName : selectedSubject);
    setSelectedSubject("Lainnya");
    setCustomName(suggestedName);
    setDuplicateWarning(null);
  };

  const toggleBatchSubject = (name: string, isCustomSubject = false) => {
    const normalized = normalizeSubjectName(name);
    if (!normalized || existingNormalizedNames.has(normalized)) return;
    setBatchSubjects((current) => {
      const existing = current.find((subject) => normalizeSubjectName(subject.name) === normalized);
      if (existing) return current.filter((subject) => subject.id !== existing.id);
      return [...current, {
        id: crypto.randomUUID(),
        name: name.trim().replace(/\s+/g, " "),
        kkm: effectiveDefaultKkm,
        isCustom: isCustomSubject,
      }];
    });
  };

  const selectAllFilteredBatchSubjects = () => {
    setBatchSubjects((current) => {
      const selected = new Set(current.map((subject) => normalizeSubjectName(subject.name)));
      const additions = filteredSubjectOptions
        .filter((option) => {
          const normalized = normalizeSubjectName(option.name);
          return !selected.has(normalized) && !existingNormalizedNames.has(normalized);
        })
        .map((option) => ({
          id: crypto.randomUUID(),
          name: option.name,
          kkm: effectiveDefaultKkm,
          isCustom: false,
        }));
      return [...current, ...additions];
    });
  };

  const updateBatchKkm = (id: string, value: string) => {
    const parsed = Number(value);
    setBatchSubjects((current) => current.map((subject) => (
      subject.id === id ? { ...subject, kkm: value === "" ? Number.NaN : parsed } : subject
    )));
  };

  const addBatchCustomSubject = () => {
    const name = batchCustomName.trim().replace(/\s+/g, " ");
    if (!name) return;
    const normalized = normalizeSubjectName(name);
    if (existingNormalizedNames.has(normalized) || batchSubjects.some((subject) => normalizeSubjectName(subject.name) === normalized)) {
      warning("Mapel Sudah Ada", `"${name}" sudah ada di kelas atau daftar Batch.`);
      return;
    }
    toggleBatchSubject(name, true);
    setBatchCustomName("");
  };

  const resetDialog = () => {
    setMode("single");
    setSelectedSubject("");
    setCustomName("");
    setSubjectSearch("");
    setActiveSubjectGroup("all");
    setKkm(effectiveDefaultKkm.toString());
    setDuplicateWarning(null);
    setBatchSubjects([]);
    setBatchCustomName("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "batch") {
      if (batchSubjects.length === 0 || batchHasInvalid) return;
      const result = await createSubjectsBatch.mutateAsync({
        class_id: classId,
        source: "manual_batch",
        subjects: batchSubjects.map((subject) => ({
          name: subject.name,
          kkm: subject.kkm,
          is_custom: subject.isCustom,
        })),
      });
      if (result.created.length === 0) return;
    } else {
      if (!subjectName.trim()) return;
      if (checkDuplicate(subjectName)) {
        const suggestedName = suggestAlternativeName(subjectName);
        warning("Nama Sudah Ada", `"${subjectName}" sudah ada di kelas ini. Coba "${suggestedName}".`);
        setDuplicateWarning(`Mata pelajaran "${subjectName}" sudah ada. Coba gunakan nama seperti "${suggestedName}".`);
        return;
      }
      const kkmValue = Number(kkm);
      if (!Number.isInteger(kkmValue) || kkmValue < 0 || kkmValue > 100) return;
      await createSubject.mutateAsync({
        class_id: classId,
        name: subjectName.trim(),
        kkm: kkmValue,
        is_custom: isCustom,
      });
    }

    resetDialog();
    setOpen(false);
    onSuccess?.();
  };

  const isSaving = createSubject.isPending || createSubjectsBatch.isPending;
  const submitDisabled = mode === "batch"
    ? batchSubjects.length === 0 || batchHasInvalid || isSaving
    : !subjectName.trim() || Boolean(duplicateWarning) || isSaving;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetDialog();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Mapel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="max-h-[min(94dvh,50rem)] overflow-y-auto sm:max-w-[620px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => titleRef.current?.focus());
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">Tambah Mata Pelajaran</DialogTitle>
            <DialogDescription>
              Tambahkan satu atau beberapa mapel untuk kelas {className}. KKM awal mengikuti KKM kelas dan dapat disesuaikan.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={mode} onValueChange={(value) => setMode(value as AddMode)} className="mt-4">
            <TabsList className="grid h-14 w-full grid-cols-2" data-tour="subject-add-tabs">
              <TabsTrigger value="single" className="min-h-11 gap-2">
                <Plus className="h-4 w-4" /> Satuan
              </TabsTrigger>
              <TabsTrigger value="batch" className="min-h-11 gap-2">
                <ListPlus className="h-4 w-4" /> Batch
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="subject-search">Cari Mata Pelajaran</Label>
                <div className="sipena-search-field flex items-center gap-2 rounded-xl border border-input bg-background px-3">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <Input
                    id="subject-search"
                    value={subjectSearch}
                    onChange={(event) => setSubjectSearch(event.target.value)}
                    placeholder="Cari mapel..."
                    className="sipena-search-input h-10 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  <Button type="button" size="sm" variant={activeSubjectGroup === "all" ? "default" : "outline"} className="h-9 shrink-0 rounded-lg px-3 text-xs" onClick={() => setActiveSubjectGroup("all")}>Semua</Button>
                  {DEFAULT_SUBJECT_GROUPS.map((group) => (
                    <Button key={group.id} type="button" size="sm" variant={activeSubjectGroup === group.id ? "default" : "outline"} className="h-9 shrink-0 rounded-lg px-3 text-xs" onClick={() => setActiveSubjectGroup(group.id)}>{group.label}</Button>
                  ))}
                </div>
              </div>

              <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-2 scrollbar-thin" role="listbox" aria-label="Pilihan mata pelajaran">
                {filteredSubjectOptions.map((option) => {
                  const normalized = normalizeSubjectName(option.name);
                  const alreadyExists = existingNormalizedNames.has(normalized);
                  const isSelected = mode === "batch"
                    ? batchSubjects.some((subject) => normalizeSubjectName(subject.name) === normalized)
                    : selectedSubject === option.name;
                  return (
                    <button
                      key={option.name}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={alreadyExists}
                      data-selected={isSelected ? "true" : "false"}
                      data-touch-scroll-click-target="true"
                      onClick={() => mode === "batch" ? toggleBatchSubject(option.name) : handleSubjectChange(option.name)}
                      className={cn(
                        "flex min-h-11 w-full select-none items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "border-transparent hover:border-border hover:bg-muted/70",
                        alreadyExists && "cursor-not-allowed opacity-55",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-medium">{option.name}</span>
                        <span className="mt-0.5 flex flex-wrap gap-1">
                          {option.labels.map((label) => <span key={label} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{label}</span>)}
                          {alreadyExists ? <Badge variant="secondary" className="h-5 text-[10px]">Sudah ada</Badge> : null}
                        </span>
                      </span>
                      {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  );
                })}
                {filteredSubjectOptions.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Tidak ada mapel yang cocok. Tambahkan mapel custom.</p> : null}
              </div>
            </div>

            <TabsContent value="single" className="space-y-4">
              <Button type="button" variant={isCustom ? "default" : "outline"} className="h-11 w-full justify-start rounded-xl" onClick={handleSelectCustomSubject}>
                <Plus className="mr-2 h-4 w-4" /> Lainnya (Custom)
              </Button>
              {isCustom ? (
                <div className="grid gap-2">
                  <Label htmlFor="custom-name">Nama Mata Pelajaran *</Label>
                  <Input id="custom-name" placeholder="Masukkan nama mapel" value={customName} onChange={(event) => handleCustomNameChange(event.target.value)} />
                </div>
              ) : null}
              {duplicateWarning ? (
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="space-y-2">
                    <p className="text-sm text-amber-800 dark:text-amber-200">{duplicateWarning}</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleUseSuggestion}>Gunakan Nama yang Disarankan</Button>
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="kkm">KKM (Kriteria Ketuntasan Minimal)</Label>
                <Input id="kkm" type="number" min="0" max="100" step="1" value={kkm} onChange={(event) => setKkm(event.target.value)} />
                <p className="text-xs text-muted-foreground">Default KKM kelas: {effectiveDefaultKkm}.</p>
              </div>
            </TabsContent>

            <TabsContent value="batch" className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="h-10 text-xs" onClick={selectAllFilteredBatchSubjects}>Pilih Semua Hasil</Button>
                <Button type="button" variant="outline" className="h-10 text-xs" onClick={() => setBatchSubjects([])}>Hapus Pilihan</Button>
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <Label htmlFor="batch-custom-name">Tambah Mapel Custom</Label>
                <div className="mt-2 flex gap-2">
                  <Input id="batch-custom-name" value={batchCustomName} onChange={(event) => setBatchCustomName(event.target.value)} placeholder="Contoh: Robotika" />
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Tambahkan mapel custom ke Batch" onClick={addBatchCustomSubject}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="space-y-2" aria-live="polite">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Daftar Batch</p>
                  <Badge variant="secondary">{batchSubjects.length} mapel</Badge>
                </div>
                {batchSubjects.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Pilih mapel dari katalog atau tambahkan mapel custom.</p>
                ) : batchSubjects.map((subject) => (
                  <div key={subject.id} className="grid grid-cols-[minmax(0,1fr)_5rem_2.75rem] items-end gap-2 rounded-xl border border-border bg-background p-2.5">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">{subject.name}</p>
                      {subject.isCustom ? <Badge variant="outline" className="mt-1 text-[10px]">Custom</Badge> : null}
                    </div>
                    <div>
                      <Label htmlFor={`batch-kkm-${subject.id}`} className="text-[10px]">KKM</Label>
                      <Input id={`batch-kkm-${subject.id}`} type="number" min="0" max="100" step="1" value={Number.isNaN(subject.kkm) ? "" : subject.kkm} onChange={(event) => updateBatchKkm(subject.id, event.target.value)} className="mt-1 h-10 px-2 text-center" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-destructive" aria-label={`Hapus ${subject.name} dari Batch`} onClick={() => setBatchSubjects((current) => current.filter((item) => item.id !== subject.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              {batchHasInvalid ? <p className="text-xs text-destructive">Periksa nama mapel dan pastikan seluruh KKM berupa bilangan bulat 0-100.</p> : null}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button type="submit" disabled={submitDisabled}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan...</> : mode === "batch" ? `Tambahkan ${batchSubjects.length} Mapel` : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
