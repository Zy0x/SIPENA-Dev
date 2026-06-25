import { useState, useMemo, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Search,
  Loader2,
  ArrowUpDown,
  AlertCircle,
  Copy,
  School,
  GraduationCap,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useClasses } from "@/hooks/useClasses";
import { useSubjects, type Subject } from "@/hooks/useSubjects";
import AddSubjectDialog from "@/components/subjects/AddSubjectDialog";
import SubjectCard from "@/components/subjects/SubjectCard";
import ImportSubjectsDialog from "@/components/subjects/ImportSubjectsDialog";
import AddClassDialog from "@/components/classes/AddClassDialog";
import type { Class } from "@/hooks/useClasses";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProductTour, TourButton } from "@/components/ui/product-tour";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import gsap from "gsap";

type SortOption = "name-asc" | "name-desc" | "kkm-asc" | "kkm-desc";
const CREATE_CLASS_VALUE = "__create_class__";

export default function Subjects() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { classes: dbClasses, isLoading: classesLoading } = useClasses();
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const [isTourDummyActive, setIsTourDummyActive] = useState(false);
  const [tourDummyClass, setTourDummyClass] = useState<Class | null>(null);
  const [tourDummySubjects, setTourDummySubjects] = useState<Subject[]>([]);

  const dbSubjectsRef = useRef<Subject[]>([]);
  const subjectsLoadingRef = useRef(false);
  const preTourClassIdRef = useRef<string | null>(null);

  const initialClassId = searchParams.get("classId") || "";
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("name-asc");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [createdClass, setCreatedClass] = useState<Class | null>(null);

  const { subjects: dbSubjects, isLoading: subjectsLoading } = useSubjects(selectedClassId, true, false);

  useEffect(() => {
    dbSubjectsRef.current = dbSubjects;
    subjectsLoadingRef.current = subjectsLoading;
  }, [dbSubjects, subjectsLoading]);

  const classes = useMemo(() => {
    if (isTourDummyActive && tourDummyClass) {
      return dbClasses.length > 0 ? dbClasses : [tourDummyClass];
    }
    return dbClasses;
  }, [dbClasses, isTourDummyActive, tourDummyClass]);

  const subjects = useMemo(() => {
    if (isTourDummyActive && tourDummySubjects.length > 0) {
      return tourDummySubjects;
    }
    return dbSubjects;
  }, [dbSubjects, isTourDummyActive, tourDummySubjects]);

  const selectedClass = classes.find((c) => c.id === selectedClassId)
    || (createdClass?.id === selectedClassId ? createdClass : undefined);
  const hasSelectedClass = Boolean(selectedClassId && selectedClass);

  const filteredSubjects = useMemo(() => {
    let result = subjects;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((s) => s.name.toLowerCase().includes(query));
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "kkm-asc":
          return a.kkm - b.kkm;
        case "kkm-desc":
          return b.kkm - a.kkm;
        default:
          return 0;
      }
    });
    return result;
  }, [subjects, searchQuery, sortBy]);

  const isLoading = classesLoading || subjectsLoading;
  const addSubjectIntentKey =
    searchParams.get("action") === "add-subject" && selectedClassId
      ? `${selectedClassId}:add-subject`
      : undefined;

  const subjectsTourSteps = useMemo(() => {
    if (classes.length === 0) {
      return [
        {
          target: "[data-tour='subjects-no-classes']",
          title: "Buat Kelas Terlebih Dahulu",
          description: "Mata pelajaran selalu terhubung ke kelas. Gunakan tombol ini untuk membuat kelas, lalu kembali ke halaman Mata Pelajaran.",
        },
      ];
    }

    const baseSteps = [
      {
        target: "[data-tour='class-select']",
        title: "Pilih Kelas",
        description: "Pilih kelas tujuan. Daftar mapel, KKM, pencarian, dan tindakan di bawah akan mengikuti kelas ini.",
      },
      {
        target: "[data-tour='import-subject']",
        title: "Ambil Mapel dari Kelas Lain",
        description: "Salin mapel dan KKM dari kelas lain atau tahun ajaran terdahulu. Struktur BAB dan tugas dapat disertakan dengan konfirmasi terpisah.",
      },
      {
        target: "[data-tour='add-subject']",
        title: "Tambah Satuan atau Batch",
        description: "Tambahkan satu mapel atau gunakan mode Batch untuk memilih banyak mapel sekaligus dan mengatur KKM masing-masing.",
      },
      {
        target: "[data-tour='search-subject']",
        title: "Cari dan Urutkan",
        description: "Cari mapel berdasarkan nama, lalu urutkan berdasarkan nama atau KKM agar daftar lebih mudah diperiksa.",
      },
    ];

    if (subjects.length === 0) {
      return [
        ...baseSteps,
        {
          target: "[data-tour='subjects-empty-cta']",
          title: "Mulai Mengisi Mapel",
          description: "Kelas ini belum memiliki mapel. Gunakan tombol ini untuk membuka katalog dan memilih mode Satuan atau Batch.",
        },
      ];
    }

    return [
      ...baseSteps,
      {
        target: "[data-tour='subject-summary']",
        title: "Ringkasan Kelas",
        description: "Periksa jumlah mapel dan KKM dasar kelas sebelum mulai mengelola nilai.",
      },
      {
        target: "[data-tour='subject-card']",
        title: "Kartu Mata Pelajaran",
        description: "Setiap kartu menampilkan nama, KKM, dan status custom. Tekan kartu atau Input Nilai untuk mulai mengisi nilai.",
      },
      {
        target: "[data-tour='subject-card-actions']",
        title: "Bagikan, Edit, dan Hapus",
        description: "Gunakan tindakan ini untuk membuat link akses, memperbarui nama atau KKM, dan menghapus mapel dengan konfirmasi.",
      },
    ];
  }, [classes.length, subjects.length]);

  const setupFullDummyData = () => {
    setIsTourDummyActive(true);
    const now = new Date().toISOString();

    const dummyClass: Class = {
      id: "tour-dummy-class",
      user_id: "tour-user",
      academic_year_id: "tour-year",
      semester_id: "tour-semester",
      name: "Contoh Kelas VIIA",
      description: "Kelas contoh untuk panduan interaktif SIPENA.",
      class_kkm: 75,
      created_at: now,
      updated_at: now,
      student_count: 5,
    };
    setTourDummyClass(dummyClass);
    setSelectedClassId("tour-dummy-class");

    const dummySubs: Subject[] = [
      { id: "tour-sub-1", class_id: "tour-dummy-class", name: "Matematika", kkm: 75, created_at: now, updated_at: now, academic_year_id: "tour-year", user_id: "tour-user", is_custom: false },
      { id: "tour-sub-2", class_id: "tour-dummy-class", name: "IPA", kkm: 75, created_at: now, updated_at: now, academic_year_id: "tour-year", user_id: "tour-user", is_custom: false },
      { id: "tour-sub-3", class_id: "tour-dummy-class", name: "Bahasa Inggris", kkm: 70, created_at: now, updated_at: now, academic_year_id: "tour-year", user_id: "tour-user", is_custom: true },
    ];
    setTourDummySubjects(dummySubs);
  };

  const setupDummySubjects = (classId: string) => {
    setIsTourDummyActive(true);
    const now = new Date().toISOString();

    const dummySubs: Subject[] = [
      { id: "tour-sub-1", class_id: classId, name: "Matematika", kkm: 75, created_at: now, updated_at: now, academic_year_id: "tour-year", user_id: "tour-user", is_custom: false },
      { id: "tour-sub-2", class_id: classId, name: "IPA", kkm: 75, created_at: now, updated_at: now, academic_year_id: "tour-year", user_id: "tour-user", is_custom: false },
      { id: "tour-sub-3", class_id: classId, name: "Bahasa Inggris", kkm: 70, created_at: now, updated_at: now, academic_year_id: "tour-year", user_id: "tour-user", is_custom: true },
    ];
    setTourDummySubjects(dummySubs);
  };

  const prepareSubjectsTour = async () => {
    // Simpan pilihan kelas asal
    preTourClassIdRef.current = selectedClassId;

    let activeClassId = selectedClassId;
    if (!activeClassId) {
      if (classes.length > 0) {
        activeClassId = classes[0].id;
        setSelectedClassId(activeClassId);
        // Tunggu render React state & inisiasi query mata pelajaran
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      } else {
        // Database kosong kelasnya -> setup data tiruan penuh
        setupFullDummyData();
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        return;
      }
    }

    // Tunggu hingga loading mata pelajaran selesai
    let retries = 0;
    while (subjectsLoadingRef.current && retries < 15) {
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    // Cek apakah mata pelajaran kosong untuk kelas ini
    if (dbSubjectsRef.current.length === 0) {
      setupDummySubjects(activeClassId);
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
    }
  };

  const cleanupSubjectsTour = () => {
    setIsTourDummyActive(false);
    setTourDummyClass(null);
    setTourDummySubjects([]);

    // Kembalikan ke pilihan kelas asal sebelum tour dimulai
    if (preTourClassIdRef.current !== null) {
      setSelectedClassId(preTourClassIdRef.current);
      preTourClassIdRef.current = null;
    } else {
      if (selectedClassId === "tour-dummy-class") {
        setSelectedClassId("");
      }
    }
  };

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;
    gsap.fromTo(containerRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (createdClass && classes.some((item) => item.id === createdClass.id)) setCreatedClass(null);
  }, [classes, createdClass]);

  const handleClassChange = (value: string) => {
    if (value === CREATE_CLASS_VALUE) {
      setAddClassOpen(true);
      return;
    }
    setSelectedClassId(value);
  };

  const openImportDialog = () => {
    if (typeof performance !== "undefined") performance.mark("sipena-subject-import-triggered");
    setImportDialogOpen(true);
  };

  return (
    <>
      <div ref={containerRef} className="app-page">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] bg-primary/10">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold text-foreground sm:text-lg">
                Mata Pelajaran
              </h1>
              <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                Kelola mapel, KKM, dan akses input nilai per kelas
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <TourButton tourKey="subjects" onBeforeStart={prepareSubjectsTour} />
            {selectedClassId && selectedClass && (
              <>
                <Button type="button" variant="outline" className="h-9 gap-2" data-tour="import-subject" onClick={openImportDialog}>
                  <Copy className="h-4 w-4" />
                  <span className="hidden min-[390px]:inline">Import Mapel</span>
                  <span className="min-[390px]:hidden">Import</span>
                </Button>
                <div data-tour="add-subject">
                  <AddSubjectDialog
                    classId={selectedClassId}
                    className={selectedClass.name}
                    defaultKkm={selectedClass.class_kkm}
                    openOnMountKey={addSubjectIntentKey}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {!classesLoading && classes.length === 0 && (
          <div data-tour="subjects-no-classes" className="flex items-start gap-2.5 rounded-2xl border border-grade-warning/20 bg-grade-warning/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-grade-warning" />
            <div className="text-xs">
              <p className="font-medium text-grade-warning">Belum Ada Kelas</p>
              <p className="mt-0.5 text-muted-foreground">
                Buat kelas terlebih dahulu untuk menambahkan mata pelajaran.
              </p>
              <Button variant="outline" size="sm" onClick={() => navigate("/classes")} className="mt-2 h-8 rounded-xl text-xs">
                Buat Kelas
              </Button>
            </div>
          </div>
        )}

        {classes.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(22rem,36rem)_minmax(20rem,1fr)] lg:items-end">
              <div className="min-w-0" data-tour="class-select">
                <Label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <School className="h-4 w-4 text-primary" />
                  Kelas
                </Label>
                <Select value={selectedClassId} onValueChange={handleClassChange}>
                  <SelectTrigger className="h-11 rounded-xl text-sm font-medium">
                    <SelectValue placeholder="Pilih kelas..." />
                  </SelectTrigger>
                  <SelectContent isEmpty={!classesLoading && classes.length === 0} emptyLabel="Tidak ada pilihan Kelas">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-sm">
                        {cls.name} ({cls.student_count || 0} murid)
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={CREATE_CLASS_VALUE} className="min-h-11 font-medium text-primary">
                      <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Tambah Kelas Baru</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedClassId && (
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_8.5rem] gap-2" data-tour="search-subject">
                  <div className="min-w-0">
                    <Label htmlFor="subject-page-search" className="sr-only">Cari Mata Pelajaran</Label>
                    <div className="sipena-search-field h-11 min-h-11 rounded-xl px-3">
                      <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Input
                        id="subject-page-search"
                        placeholder="Cari mata pelajaran..."
                        className="sipena-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Label className="sr-only">Urutkan Mata Pelajaran</Label>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                      <SelectTrigger className="h-11 w-full rounded-xl px-2.5 text-xs" aria-label="Urutkan mata pelajaran">
                        <span className="flex min-w-0 items-center gap-1.5"><ArrowUpDown className="h-3.5 w-3.5 shrink-0" /><SelectValue /></span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc">A-Z</SelectItem>
                        <SelectItem value="name-desc">Z-A</SelectItem>
                        <SelectItem value="kkm-desc">KKM tertinggi</SelectItem>
                        <SelectItem value="kkm-asc">KKM terendah</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {selectedClassId && selectedClass && (
              <div data-tour="subject-summary" className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                <Badge variant="outline" className="rounded-full px-2.5 py-1">{selectedClass.name}</Badge>
                <Badge variant="secondary" className="rounded-full px-2.5 py-1">{subjects.length} mapel</Badge>
                <Badge variant="secondary" className="rounded-full px-2.5 py-1">KKM Kelas: {selectedClass.class_kkm ?? 70}</Badge>
              </div>
            )}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!isLoading && classes.length > 0 && !selectedClassId && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-muted/60">
              <GraduationCap className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Pilih Kelas</p>
            <p className="mt-1 text-xs text-muted-foreground">Pilih kelas di atas untuk melihat mata pelajaran</p>
          </div>
        )}

        {!isLoading && selectedClassId && subjects.length === 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div data-tour="subjects-empty-cta" className="flex flex-col items-center justify-center px-4 py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary/10">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-1 text-base font-semibold text-foreground">
                Belum Ada Mata Pelajaran
              </h3>
              <p className="mb-4 max-w-xs text-center text-xs text-muted-foreground">
                Tambahkan mata pelajaran untuk kelas {selectedClass?.name}.
              </p>
              <AddSubjectDialog
                classId={selectedClassId}
                className={selectedClass?.name || ""}
                defaultKkm={selectedClass?.class_kkm}
              />
            </div>
          </div>
        )}

        {!isLoading && filteredSubjects.length > 0 && (
          <div className="flex items-center gap-2 px-1 text-[10px] text-muted-foreground sm:text-xs">
            <BookOpen className="h-3 w-3 flex-shrink-0" />
            <span>Pilih Input Nilai untuk mengisi nilai, atau gunakan tombol Edit/Bagikan pada setiap mapel.</span>
          </div>
        )}

        {!isLoading && filteredSubjects.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-3">
            {filteredSubjects.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        )}

        {!isLoading && selectedClassId && subjects.length > 0 && filteredSubjects.length === 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="flex flex-col items-center justify-center px-4 py-12">
              <Search className="mb-3 h-10 w-10 text-muted-foreground" />
              <h3 className="mb-1 text-sm font-semibold text-foreground">
                Tidak Ditemukan
              </h3>
              <p className="text-center text-xs text-muted-foreground">
                Tidak ada mapel yang cocok dengan "{searchQuery}"
              </p>
            </div>
          </div>
        )}
      </div>

      <ProductTour steps={subjectsTourSteps} tourKey="subjects" onComplete={cleanupSubjectsTour} />
      {selectedClass && (
        <ImportSubjectsDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          targetClass={selectedClass}
          targetSubjects={subjects}
        />
      )}
      <AddClassDialog
        trigger={null}
        open={addClassOpen}
        onOpenChange={setAddClassOpen}
        onCreated={(newClass) => {
          setCreatedClass(newClass);
          setSelectedClassId(newClass.id);
        }}
      />
    </>
  );
}
