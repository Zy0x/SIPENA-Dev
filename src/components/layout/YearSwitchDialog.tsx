import { useState, useEffect } from "react";
import { 
  Calendar, 
  AlertTriangle, 
  Loader2, 
  Plus, 
  Trash2, 
  Check, 
  GraduationCap, 
  Layers, 
  AlertCircle, 
  ChevronDown,
  MoreVertical,
  BookOpen,
  Users,
  Power,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { SemesterToggle } from "./SemesterToggle";

interface YearSwitchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetYearId?: string | null;
  onComplete?: () => void;
}

type DialogMode = "list" | "confirm" | "create";

interface SemesterToCreate {
  sem1: boolean;
  sem2: boolean;
  activeSemester: 1 | 2;
}

export function YearSwitchDialog({
  open,
  onOpenChange,
  targetYearId,
  onComplete,
}: YearSwitchDialogProps) {
  const {
    activeYear,
    academicYears,
    switchYear,
    createYear,
    createSemester,
    deleteYear,
    deleteSemesterData,
    isSwitching,
    getYearById,
    semestersForActiveYear,
    semesters,
    activeSemester,
    switchSemester,
  } = useAcademicYear();

  const queryClient = useQueryClient();

  // =====================================================================
  // STATE DEFINITIONS
  // =====================================================================
  const [mode, setMode] = useState<DialogMode>("list");
  const [newYearName, setNewYearName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [yearToDelete, setYearToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Semester selection for new year
  const [semesterConfig, setSemesterConfig] = useState<SemesterToCreate>({
    sem1: true,
    sem2: true,
    activeSemester: 1,
  });

  // Semester deletion states with deactivation option
  const [semesterToDelete, setSemesterToDelete] = useState<{ 
    id: string; 
    number: number; 
    yearId: string;
    yearName: string;
    isOnlySemester: boolean; // Track if this is the only semester
    otherSemesterId?: string; // ID of the other semester to switch to
  } | null>(null);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<1 | 2 | 3>(1); // Added step 3 for single semester warning
  const [isDeletingSemester, setIsDeletingSemester] = useState(false);
  const [shouldDeactivateSemester, setShouldDeactivateSemester] = useState(false);

  // =====================================================================
  // EFFECTS
  // =====================================================================
  
  // Auto-switch to confirm mode if targetYearId is provided
  useEffect(() => {
    if (open && targetYearId && targetYearId !== activeYear?.id) {
      setMode("confirm");
    } else if (open && !targetYearId) {
      setMode("list");
    }
  }, [open, targetYearId, activeYear?.id]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setMode("list");
      setNewYearName("");
      setIsCreating(false);
      setYearToDelete(null);
      setSemesterConfig({ sem1: true, sem2: true, activeSemester: 1 });
      setSemesterToDelete(null);
      setDeleteConfirmStep(1);
      setIsDeletingSemester(false);
      setShouldDeactivateSemester(false);
    }
  }, [open]);

  // =====================================================================
  // HELPER FUNCTIONS
  // =====================================================================
  
  // Get target year info
  const targetYear = targetYearId ? getYearById(targetYearId) : null;

  // Get semesters for a specific year
  const getSemestersForYear = (yearId: string) => {
    return semesters.filter(s => s.academic_year_id === yearId);
  };

  // Generate suggested year name based on existing years and current date
  const generateSuggestedName = () => {
    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const baseStartYear = month >= 6 ? currentYear : currentYear - 1;
    
    const existingYearNames = academicYears.map(y => y.name);
    
    for (let offset = 0; offset <= 5; offset++) {
      const candidateStartYear = baseStartYear + offset;
      const candidateName = `${candidateStartYear}/${candidateStartYear + 1}`;
      if (!existingYearNames.includes(candidateName)) {
        return candidateName;
      }
    }
    
    return `${baseStartYear}/${baseStartYear + 1}`;
  };

  // Get list of suggested years
  const getSuggestedYears = () => {
    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const baseStartYear = month >= 6 ? currentYear : currentYear - 1;
    const existingYearNames = academicYears.map(y => y.name);
    
    const suggestions: string[] = [];
    for (let offset = -1; offset <= 3; offset++) {
      const candidateStartYear = baseStartYear + offset;
      const candidateName = `${candidateStartYear}/${candidateStartYear + 1}`;
      if (!existingYearNames.includes(candidateName)) {
        suggestions.push(candidateName);
      }
      if (suggestions.length >= 3) break;
    }
    return suggestions;
  };

  // =====================================================================
  // ACTION HANDLERS
  // =====================================================================
  
  // Handle year switch confirmation
  const handleConfirmSwitch = async () => {
    if (!targetYearId) return;
    
    try {
      await switchYear(targetYearId);
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      // Error handled in context
    }
  };

  // Handle create new year WITH selected semesters
  const handleCreateYear = async () => {
    if (!newYearName.trim()) return;
    if (!semesterConfig.sem1 && !semesterConfig.sem2) return;
    
    setIsCreating(true);
    try {
      const newYear = await createYear(newYearName.trim(), true);
      
      if (semesterConfig.sem1) {
        await createSemester(newYear.id, 1, semesterConfig.activeSemester === 1);
      }
      if (semesterConfig.sem2) {
        await createSemester(newYear.id, 2, semesterConfig.activeSemester === 2);
      }
      
      setNewYearName("");
      setMode("list");
      
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
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

  // =====================================================================
  // SEMESTER DELETION HANDLERS WITH IMPROVED DEACTIVATION LOGIC
  // =====================================================================
  
  const handleDeleteSemesterData = async () => {
    if (!semesterToDelete) {
      console.error("[YearSwitchDialog] ❌ semesterToDelete is NULL!");
      return;
    }
    
    console.log("================================================================");
    console.log("[YearSwitchDialog] DELETE SEMESTER BUTTON CLICKED");
    console.log("[YearSwitchDialog] Current Step:", deleteConfirmStep);
    console.log("[YearSwitchDialog] Semester:", semesterToDelete);
    console.log("[YearSwitchDialog] Should Deactivate:", shouldDeactivateSemester);
    console.log("[YearSwitchDialog] Is Only Semester:", semesterToDelete.isOnlySemester);
    console.log("================================================================");
    
    // STEP 1: First confirmation - check if only semester + deactivate
    if (deleteConfirmStep === 1) {
      console.log("[YearSwitchDialog] ✅ Step 1 - Checking conditions");
      
      // If this is the ONLY semester AND user wants to deactivate it
      if (semesterToDelete.isOnlySemester && shouldDeactivateSemester) {
        console.log("[YearSwitchDialog] ⚠️ ONLY SEMESTER + DEACTIVATE - Moving to Step 3 (Year deletion warning)");
        setDeleteConfirmStep(3);
        return;
      }
      
      // Otherwise, proceed to step 2 (normal confirmation)
      console.log("[YearSwitchDialog] ✅ Moving to Step 2 (Final Confirmation)");
      setDeleteConfirmStep(2);
      return;
    }
    
    // STEP 3: Special case - only semester with deactivation (will delete year)
    if (deleteConfirmStep === 3) {
      console.log("================================================================");
      console.log("[YearSwitchDialog] 🔥 STEP 3 - DELETING ENTIRE YEAR (only semester)");
      console.log("================================================================");
      
      setIsDeletingSemester(true);
      
      try {
        // Delete the entire year since it's the only semester
        await deleteYear(semesterToDelete.yearId);
        
        console.log("[YearSwitchDialog] ✅ Year deleted successfully!");
        
        setSemesterToDelete(null);
        setDeleteConfirmStep(1);
        setIsDeletingSemester(false);
        setShouldDeactivateSemester(false);
        
      } catch (error) {
        console.error("[YearSwitchDialog] ❌ Year deletion failed:", error);
        setIsDeletingSemester(false);
        setSemesterToDelete(null);
        setDeleteConfirmStep(1);
        setShouldDeactivateSemester(false);
      }
      
      return;
    }
    
    // STEP 2: Final confirmation - EXECUTE DELETION
    console.log("================================================================");
    console.log("[YearSwitchDialog] 🔥 STEP 2 - EXECUTING DELETION NOW");
    console.log("[YearSwitchDialog] Semester ID:", semesterToDelete.id);
    console.log("[YearSwitchDialog] Semester Number:", semesterToDelete.number);
    console.log("[YearSwitchDialog] Will Deactivate:", shouldDeactivateSemester);
    console.log("================================================================");
    
    setIsDeletingSemester(true);
    
    try {
      console.log("[YearSwitchDialog] Calling deleteSemesterData from context...");
      
      // Delete semester data (grades, chapters, assignments, etc)
      await deleteSemesterData(semesterToDelete.id, semesterToDelete.number);
      
      console.log("[YearSwitchDialog] ✅ Data deletion completed successfully!");
      
      // CRITICAL: If user chose to DEACTIVATE (delete semester record from DB)
      if (shouldDeactivateSemester) {
        console.log("[YearSwitchDialog] 🗑️ DEACTIVATE CHECKED - Deleting semester record from database");
        
        // Switch to other semester FIRST (if available)
        if (semesterToDelete.otherSemesterId) {
          console.log("[YearSwitchDialog] 🔄 Switching to other semester before deletion:", semesterToDelete.otherSemesterId);
          await switchSemester(semesterToDelete.otherSemesterId);
          console.log("[YearSwitchDialog] ✅ Switched to other semester successfully!");
        }
        
        // NOW delete the semester record from database
        console.log("[YearSwitchDialog] 🔥 Deleting semester record from semesters table...");
        const { error: deleteSemesterError } = await supabase
          .from("semesters")
          .delete()
          .eq("id", semesterToDelete.id);
        
        if (deleteSemesterError) {
          console.error("[YearSwitchDialog] ❌ Failed to delete semester record:", deleteSemesterError);
          throw deleteSemesterError;
        }
        
        console.log("[YearSwitchDialog] ✅ Semester record deleted from database!");
        
        // Invalidate semester queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ["semesters"] });
      }
      
      setSemesterToDelete(null);
      setDeleteConfirmStep(1);
      setIsDeletingSemester(false);
      setShouldDeactivateSemester(false);
      
    } catch (error) {
      console.error("[YearSwitchDialog] ❌ Deletion failed:", error);
      
      setIsDeletingSemester(false);
      setSemesterToDelete(null);
      setDeleteConfirmStep(1);
      setShouldDeactivateSemester(false);
    }
  };

  const cancelSemesterDeletion = () => {
    console.log("================================================================");
    console.log("[YearSwitchDialog] ❌ DELETION CANCELLED BY USER");
    console.log("[YearSwitchDialog] Was at step:", deleteConfirmStep);
    console.log("================================================================");
    
    setSemesterToDelete(null);
    setDeleteConfirmStep(1);
    setIsDeletingSemester(false);
    setShouldDeactivateSemester(false);
  };

  // =====================================================================
  // RENDER
  // =====================================================================
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {/* CONFIRM SWITCH MODE */}
            {mode === "confirm" && targetYear && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Ganti Tahun Ajaran?
                  </DialogTitle>
                  <DialogDescription className="text-left">
                    Anda akan beralih dari <strong>{activeYear?.name}</strong> ke{" "}
                    <strong>{targetYear.name}</strong>.
                  </DialogDescription>
                </DialogHeader>

                <div className="my-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Perhatian:</strong> Semua data yang ditampilkan akan berubah
                    sesuai dengan tahun ajaran yang dipilih. Data dari tahun ajaran
                    sebelumnya tetap tersimpan dan dapat diakses kembali.
                  </p>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMode("list");
                      onComplete?.();
                    }}
                    disabled={isSwitching}
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleConfirmSwitch}
                    disabled={isSwitching}
                    className="gap-2"
                  >
                    {isSwitching ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Memproses...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Ya, Ganti
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

            {/* LIST MODE */}
            {mode === "list" && (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Kelola Tahun Ajaran & Semester
                  </DialogTitle>
                  <DialogDescription>
                    Atur periode akademik untuk mengelola data
                  </DialogDescription>
                </DialogHeader>

                <div className="my-4 space-y-3">
                  <div className="space-y-2 max-h-[350px] overflow-y-auto">
                    {academicYears.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Belum ada tahun ajaran</p>
                        <p className="text-sm">Buat tahun ajaran pertama Anda</p>
                      </div>
                    ) : (
                      academicYears.map((year) => {
                        const yearSemesters = getSemestersForYear(year.id);
                        const isActive = year.id === activeYear?.id;
                        
                        return (
                          <div
                            key={year.id}
                            className={cn(
                              "p-3 rounded-lg border-2 transition-all",
                              isActive
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground/30"
                            )}
                          >
                            {/* Year Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                  isActive ? "bg-primary text-primary-foreground" : "bg-muted"
                                )}>
                                  <Calendar className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={cn(
                                      "font-semibold truncate",
                                      isActive && "text-primary"
                                    )}>
                                      {year.name}
                                    </p>
                                    {isActive && (
                                      <Badge variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                                        Aktif
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {yearSemesters.length} semester
                                  </p>
                                </div>
                              </div>

                              {/* Action Menu */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {/* Add missing semester option */}
                                  {yearSemesters.length < 2 && (
                                    <>
                                      {!yearSemesters.find(s => s.number === 1) && (
                                        <DropdownMenuItem
                                          onClick={async () => {
                                            try {
                                              await createSemester(year.id, 1, false);
                                            } catch (e) {
                                              console.error("Failed to create semester:", e);
                                            }
                                          }}
                                          className="cursor-pointer text-primary focus:text-primary"
                                        >
                                          <Plus className="w-4 h-4 mr-2" />
                                          Buat Semester 1
                                        </DropdownMenuItem>
                                      )}
                                      {!yearSemesters.find(s => s.number === 2) && (
                                        <DropdownMenuItem
                                          onClick={async () => {
                                            try {
                                              await createSemester(year.id, 2, false);
                                            } catch (e) {
                                              console.error("Failed to create semester:", e);
                                            }
                                          }}
                                          className="cursor-pointer text-primary focus:text-primary"
                                        >
                                          <Plus className="w-4 h-4 mr-2" />
                                          Buat Semester 2
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                    </>
                                  )}

                                  {!isActive && (
                                    <>
                                      <DropdownMenuItem
                                        onClick={async () => {
                                          await switchYear(year.id);
                                          onOpenChange(false);
                                        }}
                                        disabled={isSwitching}
                                        className="cursor-pointer"
                                      >
                                        <Check className="w-4 h-4 mr-2 text-primary" />
                                        Aktifkan Tahun Ini
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  
                                  {/* Delete semester options */}
                                  {yearSemesters.map(sem => {
                                    const isOnlySemester = yearSemesters.length === 1;
                                    const otherSemester = yearSemesters.find(s => s.id !== sem.id);
                                    
                                    return (
                                      <DropdownMenuItem
                                        key={sem.id}
                                        onClick={() => {
                                          const semesterInfo = {
                                            id: sem.id,
                                            number: sem.number,
                                            yearId: year.id,
                                            yearName: year.name,
                                            isOnlySemester,
                                            otherSemesterId: otherSemester?.id,
                                          };
                                          
                                          console.log("================================================================");
                                          console.log("[YearSwitchDialog] 🗑️ DELETE SEMESTER MENU CLICKED");
                                          console.log("[YearSwitchDialog] Semester Info:", semesterInfo);
                                          console.log("================================================================");
                                          
                                          setSemesterToDelete(semesterInfo);
                                          setDeleteConfirmStep(1);
                                          setShouldDeactivateSemester(false);
                                        }}
                                        className="cursor-pointer text-amber-600 dark:text-amber-400 focus:text-amber-600"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Hapus Data Sem {sem.number}
                                      </DropdownMenuItem>
                                    );
                                  })}
                                  
                                  {yearSemesters.length > 0 && <DropdownMenuSeparator />}
                                  
                                  {/* Delete year */}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      onOpenChange(false);
                                      setTimeout(() => setYearToDelete(year.id), 200);
                                    }}
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Hapus Tahun Ajaran
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Semester Toggle for Active Year */}
                            {isActive && yearSemesters.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-border/50">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Semester Aktif:</span>
                                  </div>
                                  <SemesterToggle size="sm" />
                                </div>
                              </div>
                            )}

                            {/* Semester Badges for Non-active Year */}
                            {!isActive && yearSemesters.length > 0 && (
                              <div className="mt-2 flex gap-1.5">
                                {yearSemesters.map(sem => (
                                  <Badge 
                                    key={sem.id} 
                                    variant="outline" 
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    Semester {sem.number}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="w-full sm:w-auto"
                  >
                    Tutup
                  </Button>
                  <Button
                    onClick={() => {
                      setNewYearName(generateSuggestedName());
                      setSemesterConfig({ sem1: true, sem2: true, activeSemester: 1 });
                      setMode("create");
                    }}
                    className="w-full sm:w-auto gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Buat Tahun Ajaran Baru
                  </Button>
                </DialogFooter>
              </motion.div>
            )}

            {/* CREATE MODE */}
            {mode === "create" && (
              <motion.div
                key="create"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5 text-primary" />
                    Buat Tahun Ajaran Baru
                  </DialogTitle>
                  <DialogDescription>
                    Masukkan nama tahun ajaran dan pilih semester yang akan dibuat
                  </DialogDescription>
                </DialogHeader>

                <div className="my-4 space-y-4">
                  {/* Year Name Input */}
                  <div className="space-y-2">
                    <Label htmlFor="year-name">Nama Tahun Ajaran</Label>
                    <Input
                      id="year-name"
                      value={newYearName}
                      onChange={(e) => setNewYearName(e.target.value)}
                      placeholder="2025/2026"
                      disabled={isCreating}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (semesterConfig.sem1 || semesterConfig.sem2)) {
                          handleCreateYear();
                        }
                      }}
                    />
                  </div>

                  {/* Quick suggestion chips */}
                  {getSuggestedYears().length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Saran Tahun Ajaran:</Label>
                      <div className="flex flex-wrap gap-2">
                        {getSuggestedYears().map((suggestion) => (
                          <Button
                            key={suggestion}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-7 text-xs border-2 transition-all",
                              newYearName === suggestion
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/50"
                            )}
                            onClick={() => setNewYearName(suggestion)}
                            disabled={isCreating}
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Semester Selection */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      Pilih Semester yang Akan Dibuat
                    </Label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        className={cn(
                          "p-3 rounded-lg border-2 cursor-pointer transition-all",
                          semesterConfig.sem1
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/30"
                        )}
                        onClick={() => setSemesterConfig(prev => ({
                          ...prev,
                          sem1: !prev.sem1,
                          activeSemester: !prev.sem1 ? 1 : (prev.sem2 ? 2 : 1)
                        }))}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={semesterConfig.sem1} 
                            onCheckedChange={() => {}}
                            className="pointer-events-none"
                          />
                          <div>
                            <p className="font-medium text-sm">Semester 1</p>
                            <p className="text-xs text-muted-foreground">Ganjil</p>
                          </div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "p-3 rounded-lg border-2 cursor-pointer transition-all",
                          semesterConfig.sem2
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-primary/30"
                        )}
                        onClick={() => setSemesterConfig(prev => ({
                          ...prev,
                          sem2: !prev.sem2,
                          activeSemester: !prev.sem2 ? 2 : (prev.sem1 ? 1 : 2)
                        }))}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            checked={semesterConfig.sem2}
                            onCheckedChange={() => {}}
                            className="pointer-events-none"
                          />
                          <div>
                            <p className="font-medium text-sm">Semester 2</p>
                            <p className="text-xs text-muted-foreground">Genap</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active semester selection */}
                    {(semesterConfig.sem1 || semesterConfig.sem2) && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Semester yang Diaktifkan:</Label>
                        <div className="flex gap-2">
                          {semesterConfig.sem1 && (
                            <Button
                              variant={semesterConfig.activeSemester === 1 ? "default" : "outline"}
                              size="sm"
                              className="h-8 px-4 text-xs font-medium border-2 min-w-[90px] whitespace-nowrap"
                              onClick={() => setSemesterConfig(prev => ({ ...prev, activeSemester: 1 }))}
                            >
                              {semesterConfig.activeSemester === 1 && <Check className="w-3 h-3 mr-1.5 shrink-0" />}
                              <span>Sem 1</span>
                            </Button>
                          )}
                          {semesterConfig.sem2 && (
                            <Button
                              variant={semesterConfig.activeSemester === 2 ? "default" : "outline"}
                              size="sm"
                              className="h-8 px-4 text-xs font-medium border-2 min-w-[90px] whitespace-nowrap"
                              onClick={() => setSemesterConfig(prev => ({ ...prev, activeSemester: 2 }))}
                            >
                              {semesterConfig.activeSemester === 2 && <Check className="w-3 h-3 mr-1.5 shrink-0" />}
                              <span>Sem 2</span>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Validation message */}
                    {!semesterConfig.sem1 && !semesterConfig.sem2 && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Pilih minimal satu semester
                      </p>
                    )}
                  </div>
                </div>

                <DialogFooter className="flex gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setMode("list")}
                    disabled={isCreating}
                  >
                    Kembali
                  </Button>
                  <Button
                    onClick={handleCreateYear}
                    disabled={isCreating || !newYearName.trim() || (!semesterConfig.sem1 && !semesterConfig.sem2)}
                    className="gap-2"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Membuat...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Buat & Aktifkan
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* DELETE YEAR CONFIRMATION DIALOG */}
      {/* ================================================================= */}
      <AlertDialog open={!!yearToDelete} onOpenChange={() => setYearToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Hapus Tahun Ajaran?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Anda akan menghapus tahun ajaran{" "}
                <strong>{yearToDelete && getYearById(yearToDelete)?.name}</strong>.
              </p>
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                <p className="font-semibold text-destructive mb-1.5">⚠️ Semua data berikut akan DIHAPUS PERMANEN:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li className="flex items-center gap-1.5"><Users className="w-3 h-3 inline" /> Kelas & Siswa</li>
                  <li className="flex items-center gap-1.5"><BookOpen className="w-3 h-3 inline" /> Mata Pelajaran</li>
                  <li className="flex items-center gap-1.5"><Layers className="w-3 h-3 inline" /> Nilai, Tugas, BAB, Presensi</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                Tindakan ini tidak dapat dibatalkan.
              </p>
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
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menghapus...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Hapus Permanen
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================================================================= */}
      {/* DELETE SEMESTER CONFIRMATION DIALOG - IMPROVED WITH 3 STEPS */}
      {/* ================================================================= */}
      <AlertDialog 
        open={!!semesterToDelete} 
        onOpenChange={(open) => {
          if (!open) {
            cancelSemesterDeletion();
          }
        }}
      >
        <AlertDialogContent className="max-w-md sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {deleteConfirmStep === 1 ? (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                  <span className="line-clamp-2">Hapus Data Semester {semesterToDelete?.number}?</span>
                </>
              ) : deleteConfirmStep === 2 ? (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <span className="line-clamp-2">⚠️ KONFIRMASI AKHIR ⚠️</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <span className="line-clamp-2">⚠️ PERINGATAN: Akan Menghapus Tahun Ajaran</span>
                </>
              )}
            </AlertDialogTitle>
            
            <AlertDialogDescription className="space-y-3 text-sm">
              {deleteConfirmStep === 1 ? (
                <>
                  <p className="leading-relaxed">
                    Anda akan menghapus <strong>semua data nilai, tugas, BAB, dan presensi</strong> yang 
                    terkait dengan <strong>Semester {semesterToDelete?.number}</strong> di tahun ajaran{" "}
                    <strong>{semesterToDelete?.yearName}</strong>.
                  </p>
                  
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="font-medium text-foreground mb-1 text-xs sm:text-sm">✅ Yang TETAP tersimpan:</p>
                    <ul className="list-disc list-inside text-muted-foreground space-y-0.5 text-xs sm:text-sm">
                      <li>Data kelas dan siswa</li>
                      <li>Data mata pelajaran</li>
                      <li>Pengaturan tahun ajaran</li>
                    </ul>
                  </div>

                  {/* CHECKBOX UNTUK DEACTIVATE SEMESTER */}
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="deactivate-semester"
                        checked={shouldDeactivateSemester}
                        onCheckedChange={(checked) => setShouldDeactivateSemester(checked === true)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <label
                          htmlFor="deactivate-semester"
                          className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100 cursor-pointer flex items-center gap-2"
                        >
                          <Power className="w-4 h-4 shrink-0" />
                          <span className="line-clamp-2">Hapus semester dari sistem (bisa dibuat ulang nanti)</span>
                        </label>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
                          {semesterToDelete?.isOnlySemester ? (
                            <span className="font-semibold">⚠️ Ini adalah satu-satunya semester. Jika dihapus, seluruh tahun ajaran akan terhapus.</span>
                          ) : (
                            <>
                              Semester akan dihapus dari database dan tombol switch semester untuk semester ini akan hilang. 
                              Anda bisa membuat semester ini lagi nanti lewat menu titik tiga (•••).
                              {semesterToDelete?.otherSemesterId && 
                                " Akan otomatis beralih ke semester lainnya."}
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              ) : deleteConfirmStep === 2 ? (
                <>
                  <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive">
                    <p className="text-destructive font-bold text-center mb-2 text-sm sm:text-base">
                      🚨 INI ADALAH LANGKAH TERAKHIR 🚨
                    </p>
                    <p className="text-center mb-3 text-xs sm:text-sm leading-relaxed">
                      Semua nilai, tugas, BAB, dan presensi <strong>Semester {semesterToDelete?.number}</strong> akan{" "}
                      <strong className="text-destructive">DIHAPUS PERMANEN</strong>
                    </p>
                    {shouldDeactivateSemester && !semesterToDelete?.isOnlySemester && (
                      <div className="mt-3 pt-3 border-t border-destructive/30">
                        <p className="text-center text-xs sm:text-sm">
                          <Power className="w-4 h-4 inline mr-1" />
                          Semester akan <strong className="text-destructive">DIHAPUS DARI SISTEM</strong> dan bisa dibuat ulang nanti
                          {semesterToDelete?.otherSemesterId && " (akan beralih ke semester lainnya)"}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground text-center leading-relaxed">
                    {shouldDeactivateSemester 
                      ? "Semester akan dihapus dari database dan dapat dibuat ulang seperti semester baru."
                      : "Data akan dihapus, tetapi semester tetap ada dan bisa diisi ulang."}
                  </p>
                </>
              ) : (
                <>
                  {/* STEP 3: Only semester warning */}
                  <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive">
                    <p className="text-destructive font-bold text-center mb-3 text-sm sm:text-base">
                      🚨 PERINGATAN KRITIS 🚨
                    </p>
                    <div className="space-y-3 text-xs sm:text-sm">
                      <p className="leading-relaxed">
                        <strong>Semester {semesterToDelete?.number}</strong> adalah <strong className="text-destructive">SATU-SATUNYA</strong> semester 
                        di tahun ajaran <strong>{semesterToDelete?.yearName}</strong>.
                      </p>
                      <p className="leading-relaxed">
                        Karena Anda memilih untuk <strong className="text-destructive">menonaktifkan semester ini</strong>, 
                        maka <strong className="text-destructive">SELURUH TAHUN AJARAN</strong> beserta semua datanya akan dihapus:
                      </p>
                      <ul className="list-disc list-inside space-y-1 bg-white/50 dark:bg-black/20 p-3 rounded">
                        <li className="flex items-start gap-2">
                          <span className="shrink-0">•</span>
                          <span>Semua kelas dan siswa</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="shrink-0">•</span>
                          <span>Semua mata pelajaran</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="shrink-0">•</span>
                          <span>Semua nilai, tugas, BAB, dan presensi</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="shrink-0">•</span>
                          <span>Tahun ajaran {semesterToDelete?.yearName} itu sendiri</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-center font-semibold text-destructive leading-relaxed">
                    Apakah Anda YAKIN ingin menghapus SELURUH tahun ajaran ini?
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel 
              disabled={isDeletingSemester}
              onClick={cancelSemesterDeletion}
              className="w-full sm:w-auto"
            >
              Batal
            </AlertDialogCancel>
            
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                console.log("[YearSwitchDialog] AlertDialogAction CLICKED - Step:", deleteConfirmStep);
                handleDeleteSemesterData();
              }}
              disabled={isDeletingSemester}
              className={cn(
                "gap-2 w-full sm:w-auto",
                deleteConfirmStep === 1 
                  ? "bg-amber-500 text-white hover:bg-amber-600" 
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              )}
            >
              {isDeletingSemester ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span className="truncate">Menghapus...</span>
                </>
              ) : deleteConfirmStep === 1 ? (
                <>
                  <span className="truncate">Lanjutkan</span>
                  <ChevronDown className="h-4 w-4 rotate-[-90deg] shrink-0" />
                </>
              ) : deleteConfirmStep === 3 ? (
                <>
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Ya, Hapus Tahun Ajaran</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Ya, Hapus{shouldDeactivateSemester ? ' & Nonaktifkan' : ''} Sekarang</span>
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default YearSwitchDialog;