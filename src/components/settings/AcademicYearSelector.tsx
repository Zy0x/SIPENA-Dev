import { useState } from "react";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Calendar,
  Plus,
  Trash2,
  Check,
  Loader2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

export function AcademicYearSelector() {
  const {
    activeYear,
    academicYears,
    semesters,
    activeSemester,
    isLoading,
    isSwitching,
    switchYear,
    switchSemester,
    createYear,
    deleteYear,
  } = useAcademicYear();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newYearName, setNewYearName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Generate suggested year name
  const generateSuggestedName = () => {
    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const startYear = month >= 6 ? currentYear : currentYear - 1;
    return `${startYear}/${startYear + 1}`;
  };

  // Handle create new year
  const handleCreateYear = async () => {
    if (!newYearName.trim()) return;
    
    setIsCreating(true);
    try {
      await createYear(newYearName.trim(), true);
      setNewYearName("");
      setShowCreateForm(false);
    } catch (error) {
      // Error handled in context
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete year
  const handleDeleteYear = async () => {
    if (!yearToDelete) return;
    
    setIsDeleting(true);
    try {
      await deleteYear(yearToDelete);
      setYearToDelete(null);
    } catch (error) {
      // Error handled in context
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle year switch
  const handleYearSwitch = async (yearId: string) => {
    if (yearId === activeYear?.id || isSwitching) return;
    
    try {
      await switchYear(yearId);
    } catch (error) {
      // Error handled in context
    }
  };

  // Handle semester switch
  const handleSemesterSwitch = async (semesterId: string) => {
    if (semesterId === activeSemester?.id || isSwitching) return;
    
    try {
      await switchSemester(semesterId);
    } catch (error) {
      // Error handled in context
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Get semesters for active year
  const activeYearSemesters = semesters.filter(s => s.academic_year_id === activeYear?.id);

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <div className="text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Isolasi Data per Tahun Ajaran</p>
          <p>
            Semua data (kelas, mata pelajaran, nilai) akan difilter berdasarkan tahun ajaran yang aktif. 
            Saat berganti tahun ajaran, Anda akan melihat data yang berbeda.
          </p>
        </div>
      </div>

      {/* Current Selection Display */}
      {activeYear && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tahun Ajaran Aktif</p>
                <p className="font-semibold text-foreground">{activeYear.name}</p>
              </div>
            </div>
            {activeSemester && (
              <Badge variant="secondary" className="text-xs">
                {activeSemester.name}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Year Selector */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Pilih Tahun Ajaran</Label>
        <div className="flex gap-2">
          <Select
            value={activeYear?.id || ""}
            onValueChange={handleYearSwitch}
            disabled={isSwitching || academicYears.length === 0}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Pilih tahun ajaran...">
                {isSwitching ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Memproses...
                  </span>
                ) : (
                  activeYear?.name || "Pilih tahun ajaran..."
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{year.name}</span>
                    {year.id === activeYear?.id && (
                      <Check className="w-4 h-4 text-primary ml-2" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setNewYearName(generateSuggestedName());
              setShowCreateForm(true);
            }}
            disabled={isSwitching}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Semester Selector (if year selected) */}
      {activeYear && activeYearSemesters.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Pilih Semester</Label>
          <Select
            value={activeSemester?.id || ""}
            onValueChange={handleSemesterSwitch}
            disabled={isSwitching}
          >
            <SelectTrigger>
              <SelectValue placeholder="Pilih semester...">
                {activeSemester?.name || "Pilih semester..."}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {activeYearSemesters.map((semester) => (
                <SelectItem key={semester.id} value={semester.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{semester.name}</span>
                    {semester.id === activeSemester?.id && (
                      <Check className="w-4 h-4 text-primary ml-2" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Separator />

      {/* Year List with Delete */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Daftar Tahun Ajaran</Label>
        
        {academicYears.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Belum ada tahun ajaran</p>
            <p className="text-xs">Buat tahun ajaran pertama Anda</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
            <AnimatePresence mode="popLayout">
              {academicYears.map((year) => (
                <motion.div
                  key={year.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    year.id === activeYear?.id
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/30 border-transparent hover:border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className={cn(
                      "w-4 h-4",
                      year.id === activeYear?.id ? "text-primary" : "text-muted-foreground"
                    )} />
                    <div>
                      <p className={cn(
                        "text-sm font-medium",
                        year.id === activeYear?.id && "text-primary"
                      )}>
                        {year.name}
                      </p>
                      {year.id === activeYear?.id && (
                        <p className="text-xs text-primary">Aktif</p>
                      )}
                    </div>
                  </div>
                  
                  {year.id !== activeYear?.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setYearToDelete(year.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Create Year Form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">Buat Tahun Ajaran Baru</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-year-name" className="text-xs">
                  Nama Tahun Ajaran
                </Label>
                <Input
                  id="new-year-name"
                  value={newYearName}
                  onChange={(e) => setNewYearName(e.target.value)}
                  placeholder="Contoh: 2025/2026"
                  disabled={isCreating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateYear();
                  }}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewYearName("");
                  }}
                  disabled={isCreating}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateYear}
                  disabled={isCreating || !newYearName.trim()}
                  className="flex-1 gap-2"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Membuat...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Buat & Aktifkan
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!yearToDelete} onOpenChange={() => setYearToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Hapus Tahun Ajaran?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus tahun ajaran{" "}
              <strong>{yearToDelete && academicYears.find(y => y.id === yearToDelete)?.name}</strong>{" "}
              beserta semua data terkait (kelas, mata pelajaran, nilai, dll). 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteYear}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Hapus Permanen
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default AcademicYearSelector;
