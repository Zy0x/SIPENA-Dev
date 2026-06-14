import { useEffect, useMemo, useRef, useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Loader2, AlertCircle, Search, Check } from "lucide-react";
import { useSubjects } from "@/hooks/useSubjects";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { DEFAULT_SUBJECT_GROUPS, type DefaultSubjectGroup } from "@/lib/defaultSubjects";
import { cn } from "@/lib/utils";

interface AddSubjectDialogProps {
  classId: string;
  className: string;
  defaultKkm?: number | null;
  trigger?: React.ReactNode;
  openOnMountKey?: string;
  onSuccess?: () => void;
}

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
  const openedKeysRef = useRef(new Set<string>());
  const [selectedSubject, setSelectedSubject] = useState("");
  const [customName, setCustomName] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [activeSubjectGroup, setActiveSubjectGroup] = useState<SubjectGroupFilter>("all");
  const [kkm, setKkm] = useState((defaultKkm ?? 70).toString());
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const { subjects, createSubject } = useSubjects(classId);
  const { warning } = useEnhancedToast();

  const isCustom = selectedSubject === "Lainnya";
  const subjectName = isCustom ? customName : selectedSubject;
  const effectiveDefaultKkm = defaultKkm ?? 70;
  const subjectGroupOptions = useMemo(() => {
    const options = new Map<string, { name: string; groupIds: DefaultSubjectGroup["id"][]; labels: string[] }>();

    DEFAULT_SUBJECT_GROUPS.forEach((group) => {
      group.subjects.forEach((subject) => {
        const existing = options.get(subject);
        if (existing) {
          existing.groupIds.push(group.id);
          existing.labels.push(group.label);
          return;
        }

        options.set(subject, {
          name: subject,
          groupIds: [group.id],
          labels: [group.label],
        });
      });
    });

    return Array.from(options.values());
  }, []);

  const filteredSubjectOptions = useMemo(() => {
    const normalizedSearch = subjectSearch.trim().toLowerCase();

    return subjectGroupOptions.filter((option) => {
      const matchesGroup = activeSubjectGroup === "all" || option.groupIds.includes(activeSubjectGroup);
      const matchesSearch = !normalizedSearch || option.name.toLowerCase().includes(normalizedSearch);
      return matchesGroup && matchesSearch;
    });
  }, [activeSubjectGroup, subjectGroupOptions, subjectSearch]);

  useEffect(() => {
    if (open) {
      setKkm(effectiveDefaultKkm.toString());
    }
  }, [effectiveDefaultKkm, open]);

  useEffect(() => {
    if (!openOnMountKey || openedKeysRef.current.has(openOnMountKey)) return;
    openedKeysRef.current.add(openOnMountKey);
    setOpen(true);
  }, [openOnMountKey]);

  // Check for duplicate subject name
  const checkDuplicate = (name: string): boolean => {
    const normalizedName = name.trim().toLowerCase();
    const existingSubject = subjects.find(
      s => s.name.toLowerCase() === normalizedName
    );
    return !!existingSubject;
  };

  // Suggest alternative name
  const suggestAlternativeName = (name: string): string => {
    let counter = 2;
    let suggestedName = `${name} ${counter}`;
    
    while (subjects.some(s => s.name.toLowerCase() === suggestedName.toLowerCase())) {
      counter++;
      suggestedName = `${name} ${counter}`;
    }
    
    return suggestedName;
  };

  const handleSubjectChange = (value: string) => {
    setSelectedSubject(value);
    setDuplicateWarning(null);
    
    if (value !== "Lainnya" && checkDuplicate(value)) {
      const suggestedName = suggestAlternativeName(value);
      setDuplicateWarning(
        `Mata pelajaran "${value}" sudah ada di kelas ini. Coba gunakan nama berbeda seperti "${suggestedName}".`
      );
    }
  };

  const handleSelectCustomSubject = () => {
    setSelectedSubject("Lainnya");
    setDuplicateWarning(null);
    if (!customName.trim() && subjectSearch.trim()) {
      setCustomName(subjectSearch.trim());
    }
  };

  const handleCustomNameChange = (value: string) => {
    setCustomName(value);
    setDuplicateWarning(null);
    
    if (value.trim() && checkDuplicate(value)) {
      const suggestedName = suggestAlternativeName(value);
      setDuplicateWarning(
        `Mata pelajaran "${value}" sudah ada. Coba gunakan nama berbeda seperti "${suggestedName}".`
      );
    }
  };

  const handleUseSuggestion = () => {
    const currentName = isCustom ? customName : selectedSubject;
    const suggestedName = suggestAlternativeName(currentName);
    
    if (isCustom) {
      setCustomName(suggestedName);
    } else {
      setSelectedSubject("Lainnya");
      setCustomName(suggestedName);
    }
    setDuplicateWarning(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subjectName.trim()) return;

    // Final duplicate check
    if (checkDuplicate(subjectName)) {
      const suggestedName = suggestAlternativeName(subjectName);
      warning(
        "Nama Sudah Ada",
        `"${subjectName}" sudah ada di kelas ini. Coba "${suggestedName}".`
      );
      setDuplicateWarning(
        `Mata pelajaran "${subjectName}" sudah ada. Coba gunakan nama seperti "${suggestedName}".`
      );
      return;
    }

    const kkmValue = parseInt(kkm);
    if (isNaN(kkmValue) || kkmValue < 0 || kkmValue > 100) return;

    await createSubject.mutateAsync({
      class_id: classId,
      name: subjectName.trim(),
      kkm: kkmValue,
      is_custom: isCustom,
    });

    setSelectedSubject("");
    setCustomName("");
    setKkm(effectiveDefaultKkm.toString());
    setDuplicateWarning(null);
    setOpen(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setDuplicateWarning(null);
        setSubjectSearch("");
        setActiveSubjectGroup("all");
      }
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Mapel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[min(92dvh,46rem)] overflow-y-auto sm:max-w-[540px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tambah Mata Pelajaran</DialogTitle>
            <DialogDescription>
              Tambahkan mata pelajaran untuk kelas {className}. KKM mapel otomatis mengikuti KKM kelas sebagai nilai awal, tetapi tetap bisa Anda sesuaikan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subject-search">Mata Pelajaran *</Label>
              <div className="rounded-xl border border-border bg-card p-2">
                <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3">
                  <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <Input
                    id="subject-search"
                    value={subjectSearch}
                    onChange={(event) => setSubjectSearch(event.target.value)}
                    placeholder="Cari mapel..."
                    className="h-9 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>

                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={activeSubjectGroup === "all" ? "default" : "outline"}
                    className="h-8 flex-shrink-0 rounded-lg px-3 text-xs"
                    onClick={() => setActiveSubjectGroup("all")}
                  >
                    Semua
                  </Button>
                  {DEFAULT_SUBJECT_GROUPS.map((group) => (
                    <Button
                      key={group.id}
                      type="button"
                      size="sm"
                      variant={activeSubjectGroup === group.id ? "default" : "outline"}
                      className="h-8 flex-shrink-0 rounded-lg px-3 text-xs"
                      onClick={() => setActiveSubjectGroup(group.id)}
                    >
                      {group.label}
                    </Button>
                  ))}
                </div>

                <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1 scrollbar-thin" role="listbox" aria-label="Pilihan mata pelajaran">
                  {filteredSubjectOptions.map((option) => {
                    const isSelected = selectedSubject === option.name;

                    return (
                      <button
                        key={option.name}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSubjectChange(option.name)}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-transparent hover:border-border hover:bg-muted/70",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{option.name}</span>
                          <span className="mt-0.5 flex flex-wrap gap-1">
                            {option.labels.map((label) => (
                              <span key={label} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {label}
                              </span>
                            ))}
                          </span>
                        </span>
                        {isSelected ? <Check className="h-4 w-4 flex-shrink-0" /> : null}
                      </button>
                    );
                  })}

                  {filteredSubjectOptions.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      Tidak ada mapel yang cocok. Gunakan mapel custom.
                    </div>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant={isCustom ? "default" : "outline"}
                  className="mt-2 w-full justify-start rounded-lg"
                  onClick={handleSelectCustomSubject}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Lainnya (Custom)
                </Button>
              </div>
            </div>

            {isCustom && (
              <div className="grid gap-2">
                <Label htmlFor="custom-name">Nama Mata Pelajaran *</Label>
                <Input
                  id="custom-name"
                  placeholder="Masukkan nama mapel"
                  value={customName}
                  onChange={(e) => handleCustomNameChange(e.target.value)}
                  autoFocus
                />
              </div>
            )}

            {/* Duplicate Warning */}
            {duplicateWarning && (
              <Alert className="animate-fade-in border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="space-y-2">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">{duplicateWarning}</p>
                  <Button 
                    type="button"
                    variant="outline" 
                    size="sm"
                    onClick={handleUseSuggestion}
                    className="mt-2"
                  >
                    Gunakan Nama yang Disarankan
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="kkm">KKM (Kriteria Ketuntasan Minimal)</Label>
              <Input
                id="kkm"
                type="number"
                min="0"
                max="100"
                placeholder={effectiveDefaultKkm.toString()}
                value={kkm}
                onChange={(e) => setKkm(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Default mengikuti KKM kelas ({effectiveDefaultKkm}). Anda tetap bisa mengubah KKM mapel ini secara khusus.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!subjectName.trim() || createSubject.isPending || !!duplicateWarning}
            >
              {createSubject.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
