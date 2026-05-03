import { useState, useMemo, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  School,
  Plus,
  Search,
  Loader2,
  Users,
  Camera,
  Upload,
  ChevronDown,
  AlertCircle,
  Target,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClasses } from "@/hooks/useClasses";
import AddClassDialog from "@/components/classes/AddClassDialog";
import ClassCard from "@/components/classes/ClassCard";
import ClassKkmSetupDialog from "@/components/classes/ClassKkmSetupDialog";
import ImportStudentsDialog from "@/components/classes/ImportStudentsDialog";
import OCRImportDialog from "@/components/import/OCRImportDialog";
import { ProductTour, TourButton, TourStep } from "@/components/ui/product-tour";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal } from "@/core/repositories/supabase-compat.repository";
import gsap from "gsap";

const classesTourSteps: TourStep[] = [
  {
    target: "[data-tour='add-class-btn']",
    title: "Tambah Kelas Baru",
    description: "Klik tombol ini untuk membuat kelas baru. Isi nama kelas dan deskripsi singkat.",
  },
  {
    target: "[data-tour='class-search']",
    title: "Cari Kelas",
    description: "Gunakan pencarian ini untuk menemukan kelas dengan cepat berdasarkan nama.",
  },
  {
    target: "[data-tour='class-card']",
    title: "Kartu Kelas",
    description: "Setiap kartu menampilkan info kelas, jumlah siswa, dan opsi untuk mengelola siswa.",
  },
];

export default function Classes() {
  const { classes, isLoading } = useClasses();
  const [searchQuery, setSearchQuery] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [showOCRImport, setShowOCRImport] = useState(false);
  const [showClassKkmGuide, setShowClassKkmGuide] = useState(false);
  const [selectedClassForImport, setSelectedClassForImport] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const { success: showSuccess, error: showError } = useEnhancedToast();

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return classes;
    const query = searchQuery.toLowerCase();
    return classes.filter(
      (cls) =>
        cls.name.toLowerCase().includes(query) ||
        cls.description?.toLowerCase().includes(query)
    );
  }, [classes, searchQuery]);

  const classesWithoutKkm = useMemo(() => (
    classes.filter((cls) => cls.class_kkm === null)
  ), [classes]);

  // GSAP entrance
  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;
    gsap.fromTo(containerRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!isLoading && classesWithoutKkm.length > 0) {
      setShowClassKkmGuide(true);
    }
  }, [classesWithoutKkm.length, isLoading]);

  const handleOpenImport = (classData?: { id: string; name: string }) => {
    if (classData) {
      setSelectedClassForImport(classData);
      setImportDialogOpen(true);
    }
  };

  return (
    <>
      <div ref={containerRef} className="app-page">
        {/* iOS-style Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-primary/10 flex items-center justify-center flex-shrink-0">
              <School className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
                Kelas & Siswa
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                Kelola daftar kelas dan data siswa
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 min-w-[44px]">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Import</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  if (classes.length > 0) {
                    handleOpenImport({ id: classes[0].id, name: classes[0].name });
                  }
                }} className="gap-2 min-h-[44px]">
                  <Upload className="w-4 h-4" />
                  Import dari Excel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowOCRImport(true)} className="gap-2 min-h-[44px]">
                  <Camera className="w-4 h-4" />
                  Import dari Foto (OCR)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TourButton tourKey="classes-tour" />
            <div data-tour="add-class-btn">
              <AddClassDialog />
            </div>
          </div>
        </div>

        {/* Search - iOS grouped card */}
        <div className="rounded-2xl bg-card border border-border/60 overflow-hidden" data-tour="class-search">
          <div className="flex items-center gap-3 p-3 sm:p-3.5">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Input
                placeholder="Cari kelas berdasarkan nama..."
                className="h-8 border-0 p-0 shadow-none text-sm font-medium focus-visible:ring-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {searchQuery && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {filteredClasses.length} hasil
              </span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && classes.length === 0 && (
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-[20px] bg-primary/10 flex items-center justify-center mb-4">
                <School className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Belum Ada Kelas
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                Buat kelas pertama Anda untuk mulai mengelola siswa dan nilai.
              </p>
              <AddClassDialog
                trigger={
                  <Button className="rounded-xl gap-1.5">
                    <Plus className="w-4 h-4" />
                    Buat Kelas Baru
                  </Button>
                }
              />
            </div>
          </div>
        )}

        {/* Info hint */}
        {!isLoading && classes.length > 0 && (
          <div className="flex items-center gap-2 px-1 text-[10px] sm:text-xs text-muted-foreground">
            <Users className="w-3 h-3 flex-shrink-0" />
            <span>Ketuk kartu kelas untuk melihat dan mengelola siswa di dalamnya.</span>
          </div>
        )}

        {!isLoading && classesWithoutKkm.length > 0 && (
          <div className="rounded-2xl border border-grade-warning/30 bg-grade-warning/5 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-grade-warning/15 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-grade-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">KKM kelas perlu dilengkapi</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {classesWithoutKkm.length} kelas belum memiliki KKM kelas. Nilai ini akan menjadi acuan ranking keseluruhan dan default KKM mapel baru.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowClassKkmGuide(true)}>
                <Target className="w-3.5 h-3.5" />
                Lengkapi
              </Button>
            </div>
          </div>
        )}

        {/* Classes Grid */}
        {!isLoading && filteredClasses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredClasses.map((cls, index) => (
              <div key={cls.id} data-tour={index === 0 ? "class-card" : undefined}>
                <ClassCard classData={cls} />
              </div>
            ))}
          </div>
        )}

        {/* No Search Results */}
        {!isLoading && classes.length > 0 && filteredClasses.length === 0 && (
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Search className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Tidak Ditemukan
              </h3>
              <p className="text-xs text-muted-foreground text-center">
                Tidak ada kelas yang cocok dengan "{searchQuery}"
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Import Dialog */}
      {selectedClassForImport && (
        <ImportStudentsDialog
          classId={selectedClassForImport.id}
          className={selectedClassForImport.name}
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
        />
      )}

      {/* OCR Import Dialog */}
      <OCRImportDialog
        open={showOCRImport}
        onOpenChange={setShowOCRImport}
        type="students"
        title="Import Siswa dari Foto"
        description="Foto daftar siswa lalu ketik data untuk di-import"
        onDataReady={async (rows) => {
          // Parse OCR rows into students and save
          try {
            const { data: { session } } = await supabaseExternal.auth.getSession();
            if (!session?.user?.id) {
              showError("Error", "Silakan login terlebih dahulu");
              return;
            }

            // If no classes exist, can't import
            if (classes.length === 0) {
              showError("Error", "Buat kelas terlebih dahulu sebelum import siswa");
              return;
            }

            // Use first class as default target
            const targetClass = classes[0];
            let imported = 0;
            for (const row of rows) {
              const name = row[1] || row[0] || "";
              const nisn = row[2] || row[1] || "";
              if (!name.trim()) continue;
              
              const { error } = await supabaseExternal.from("students").insert({
                class_id: targetClass.id,
                name: name.trim(),
                nisn: nisn.trim() || `OCR-${Date.now()}-${imported}`,
                user_id: session.user.id,
              });
              if (!error) imported++;
            }
            showSuccess("Berhasil", `${imported} siswa berhasil diimport ke ${targetClass.name}`);
          } catch (err) {
            showError("Error", "Gagal mengimport data siswa");
          }
        }}
      />

      {/* Product Tour */}
      <ProductTour steps={classesTourSteps} tourKey="classes-tour" />
      <ClassKkmSetupDialog
        classes={classesWithoutKkm}
        open={showClassKkmGuide && classesWithoutKkm.length > 0}
        onOpenChange={setShowClassKkmGuide}
      />
    </>
  );
}
