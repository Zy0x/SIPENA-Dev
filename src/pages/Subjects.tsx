import { useState, useMemo, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Search,
  Loader2,
  ArrowUpDown,
  AlertCircle,
  School,
  GraduationCap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClasses } from "@/hooks/useClasses";
import { useSubjects } from "@/hooks/useSubjects";
import AddSubjectDialog from "@/components/subjects/AddSubjectDialog";
import SubjectCard from "@/components/subjects/SubjectCard";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProductTour, TourButton } from "@/components/ui/product-tour";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import gsap from "gsap";
import { cn } from "@/lib/utils";

type SortOption = "name-asc" | "name-desc" | "kkm-asc" | "kkm-desc";

const subjectsTourSteps = [
  {
    target: "[data-tour='class-select']",
    title: "Pilih Kelas",
    description: "Pilih kelas untuk melihat dan mengelola mata pelajaran di kelas tersebut.",
  },
  {
    target: "[data-tour='add-subject']",
    title: "Tambah Mata Pelajaran",
    description: "Klik tombol ini untuk menambahkan mata pelajaran baru beserta KKM-nya.",
  },
  {
    target: "[data-tour='search-subject']",
    title: "Cari & Urutkan",
    description: "Gunakan pencarian dan pengurutan untuk menemukan mata pelajaran dengan cepat.",
  },
];

export default function Subjects() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { classes, isLoading: classesLoading } = useClasses();
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const initialClassId = searchParams.get("classId") || "";
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  
  const { subjects, isLoading: subjectsLoading } = useSubjects(selectedClassId);
  const selectedClass = classes.find(c => c.id === selectedClassId);

  const filteredSubjects = useMemo(() => {
    let result = subjects;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(query));
    }
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "kkm-asc": return a.kkm - b.kkm;
        case "kkm-desc": return b.kkm - a.kkm;
        default: return 0;
      }
    });
    return result;
  }, [subjects, searchQuery, sortBy]);

  const isLoading = classesLoading || subjectsLoading;

  // GSAP entrance
  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;
    gsap.fromTo(containerRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
  }, [prefersReducedMotion]);

  return (
    <>
      <div ref={containerRef} className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-4">
        {/* iOS-style Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-primary/10 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
                Mata Pelajaran
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                Kelola mata pelajaran, KKM per mapel, dan default KKM dari kelas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <TourButton tourKey="subjects" />
            {selectedClassId && selectedClass && (
              <div data-tour="add-subject">
                <AddSubjectDialog classId={selectedClassId} className={selectedClass.name} defaultKkm={selectedClass.class_kkm} />
              </div>
            )}
          </div>
        </div>

        {/* No Classes Alert */}
        {!classesLoading && classes.length === 0 && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-grade-warning/5 border border-grade-warning/20">
            <AlertCircle className="w-4 h-4 text-grade-warning flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-grade-warning">Belum Ada Kelas</p>
              <p className="text-muted-foreground mt-0.5">
                Buat kelas terlebih dahulu untuk menambahkan mata pelajaran.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/classes")} className="mt-2 rounded-xl text-xs h-8">
                Buat Kelas
              </Button>
            </div>
          </div>
        )}

        {/* Class & Search Selection - iOS grouped card */}
        {classes.length > 0 && (
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden divide-y divide-border/40">
            {/* Class selector */}
            <div className="flex items-center gap-3 p-3 sm:p-3.5" data-tour="class-select">
              <School className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-[10px] text-muted-foreground">Kelas</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="h-7 border-0 p-0 shadow-none text-sm font-medium focus:ring-0">
                    <SelectValue placeholder="Pilih kelas..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-sm">
                        {cls.name} ({cls.student_count || 0} siswa)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Search & Sort */}
            {selectedClassId && (
              <div className="flex items-center gap-2 p-3 sm:p-3.5" data-tour="search-subject">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder="Cari mata pelajaran..."
                    className="h-7 border-0 p-0 shadow-none text-sm focus-visible:ring-0"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-24 h-7 text-xs border-0 shadow-none">
                    <ArrowUpDown className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">A-Z</SelectItem>
                    <SelectItem value="name-desc">Z-A</SelectItem>
                    <SelectItem value="kkm-desc">KKM ↑</SelectItem>
                    <SelectItem value="kkm-asc">KKM ↓</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Empty State - No Class Selected */}
        {!isLoading && classes.length > 0 && !selectedClassId && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-[20px] bg-muted/60 flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Pilih Kelas</p>
            <p className="text-xs text-muted-foreground mt-1">Pilih kelas di atas untuk melihat mata pelajaran</p>
          </div>
        )}

        {/* Empty State - No Subjects */}
        {!isLoading && selectedClassId && subjects.length === 0 && (
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-[20px] bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Belum Ada Mata Pelajaran
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                Tambahkan mata pelajaran untuk kelas {selectedClass?.name}.
              </p>
              <AddSubjectDialog classId={selectedClassId} className={selectedClass?.name || ""} defaultKkm={selectedClass?.class_kkm} />
            </div>
          </div>
        )}

        {/* Info hint */}
        {!isLoading && filteredSubjects.length > 0 && (
          <div className="flex items-center gap-2 px-1 text-[10px] sm:text-xs text-muted-foreground">
            <BookOpen className="w-3 h-3 flex-shrink-0" />
            <span>Ketuk kartu mata pelajaran untuk masuk ke halaman input nilai.</span>
          </div>
        )}

        {/* Subjects Grid */}
        {!isLoading && filteredSubjects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSubjects.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        )}

        {/* No Search Results */}
        {!isLoading && selectedClassId && subjects.length > 0 && filteredSubjects.length === 0 && (
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Search className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Tidak Ditemukan
              </h3>
              <p className="text-xs text-muted-foreground text-center">
                Tidak ada mapel yang cocok dengan "{searchQuery}"
              </p>
            </div>
          </div>
        )}
      </div>

      <ProductTour steps={subjectsTourSteps} tourKey="subjects" />
    </>
  );
}
