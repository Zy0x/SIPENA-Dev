import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import { useSubjects, DEFAULT_SUBJECTS } from "@/hooks/useSubjects";
import { useEnhancedToast } from "@/contexts/ToastContext";

interface AddSubjectDialogProps {
  classId: string;
  className: string;
  defaultKkm?: number | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export default function AddSubjectDialog({
  classId,
  className,
  defaultKkm,
  trigger,
  onSuccess,
}: AddSubjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [customName, setCustomName] = useState("");
  const [kkm, setKkm] = useState((defaultKkm ?? 70).toString());
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const { subjects, createSubject } = useSubjects(classId);
  const { warning } = useEnhancedToast();

  const isCustom = selectedSubject === "Lainnya";
  const subjectName = isCustom ? customName : selectedSubject;
  const effectiveDefaultKkm = defaultKkm ?? 70;

  useEffect(() => {
    if (open) {
      setKkm(effectiveDefaultKkm.toString());
    }
  }, [effectiveDefaultKkm, open]);

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
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tambah Mata Pelajaran</DialogTitle>
            <DialogDescription>
              Tambahkan mata pelajaran untuk kelas {className}. KKM mapel otomatis mengikuti KKM kelas sebagai nilai awal, tetapi tetap bisa Anda sesuaikan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subject-name">Mata Pelajaran *</Label>
              <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                <SelectTrigger id="subject-name">
                  <SelectValue placeholder="Pilih mata pelajaran" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_SUBJECTS.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                  <SelectItem value="Lainnya">Lainnya (Custom)</SelectItem>
                </SelectContent>
              </Select>
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
