import { KelasIcon } from "@/components/ui/animated-icons";
import { useState, useMemo, useRef, useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
  ShieldCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClasses } from "@/hooks/useClasses";
import type { Class } from "@/hooks/useClasses";
import { useSubjects } from "@/hooks/useSubjects";
import { useStudents } from "@/hooks/useStudents";
import AddClassDialog from "@/components/classes/AddClassDialog";
import ClassCard from "@/components/classes/ClassCard";
import GuestClassCard from "@/components/classes/GuestClassCard";
import ClassKkmSetupDialog from "@/components/classes/ClassKkmSetupDialog";
import ImportClassesStudentsDialog from "@/components/classes/ImportClassesStudentsDialog";
import OCRImportDialog from "@/components/import/OCRImportDialog";
import { ProductTour, TourButton, TourStep } from "@/components/ui/product-tour";
import { useAdaptiveMotion } from "@/hooks/useAdaptiveMotion";
import { useGuestAccesses } from "@/hooks/useGuestAccesses";
import gsap from "gsap";

const classesTourSteps: TourStep[] = [
  {
    target: "[data-tour='add-class-btn']",
    title: "Buat Kelas Baru",
    description: "Mulai dari sini! Anda bisa membuat kelas secara manual, lengkap dengan deskripsi dan standar KKM kelas sebagai acuan nilai.",
  },
  {
    target: "[data-tour='class-import-menu']",
    title: "Import Data Massal",
    description: "Punya banyak data? Gunakan fitur Import via Excel agar lebih cepat. Tersedia juga fitur canggih Import Murid dari Foto (OCR)!",
  },
  {
    target: "[data-tour='class-search']",
    title: "Cari dengan Cepat",
    description: "Jika daftar kelas Anda mulai penuh, cukup ketik nama atau deskripsinya di sini untuk menemukan kelas dalam sekejap.",
  },
  {
    target: "[data-tour='class-kkm-alert']",
    title: "Pengingat Pintar KKM",
    description: "SIPENA otomatis mengingatkan Anda jika ada kelas yang belum diatur KKM-nya, sehingga sistem bisa menghitung ranking dan nilai dengan sangat akurat.",
  },
  {
    target: "[data-tour='class-card']",
    title: "Kartu Kelas",
    description: "Ini adalah wujud representasi kelas Anda! Menampilkan rangkuman ringkas seperti jumlah murid, KKM yang berlaku, serta deskripsi kelas.",
  },
  {
    target: "[data-tour='class-card-actions']",
    title: "Akses Cepat",
    description: "Gunakan jalan pintas ini untuk langsung melompat mengelola data spesifik seperti daftar Murid, Mata Pelajaran, hingga pengisian Nilai kelas tersebut.",
  },
  {
    target: "[data-tour='class-card-menu']",
    title: "Menu Lanjutan",
    description: "Ingin mengubah nama kelas, menduplikasi, atau menghapusnya? Temukan semua opsi pengaturan tersebut di balik menu titik tiga ini.",
  },
];

export default function Classes() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { classes, isLoading } = useClasses();
  const { allSubjects, isLoading: subjectsLoading } = useSubjects();
  const { activeGuestClasses, inactiveGuestClasses, isLoading: guestAccessLoading, touchGuestAccess } = useGuestAccesses();
  const [searchQuery, setSearchQuery] = useState("");
  const [isTourDummyActive, setIsTourDummyActive] = useState(false);
  const [tourDummyClasses, setTourDummyClasses] = useState<Class[]>([]);
  const preTourSearchQueryRef = useRef("");
  const [classImportDialogOpen, setClassImportDialogOpen] = useState(false);
  const [showOCRImport, setShowOCRImport] = useState(false);
  const [ocrTargetClassId, setOcrTargetClassId] = useState("");
  const [ocrAddClassOpen, setOcrAddClassOpen] = useState(false);
  const [ocrCreatedClass, setOcrCreatedClass] = useState<Class | null>(null);
  const [showClassKkmGuide, setShowClassKkmGuide] = useState(false);
  const prefersReducedMotion = useAdaptiveMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const { students: ocrTargetStudents, createStudentsBatch } = useStudents(ocrTargetClassId);
  const accessFilter = searchParams.get("view") === "guest"
    ? "guest"
    : searchParams.get("view") === "owner"
      ? "owner"
      : "all";

  const setAccessFilter = (nextFilter: "all" | "owner" | "guest") => {
    const next = new URLSearchParams(searchParams);
    if (nextFilter === "all") {
      next.delete("view");
    } else {
      next.set("view", nextFilter);
    }
    setSearchParams(next, { replace: true });
  };

  const ocrClassOptions = useMemo(() => {
    if (!ocrCreatedClass || classes.some((item) => item.id === ocrCreatedClass.id)) return classes;
    return [...classes, ocrCreatedClass];
  }, [classes, ocrCreatedClass]);

  useEffect(() => {
    if (ocrCreatedClass && classes.some((item) => item.id === ocrCreatedClass.id)) {
      setOcrCreatedClass(null);
    }
  }, [classes, ocrCreatedClass]);

  const displayClasses = useMemo(() => {
    if (isTourDummyActive && tourDummyClasses.length > 0) {
      if (classes.length === 0) {
        return tourDummyClasses;
      }
      return [...classes, ...tourDummyClasses];
    }
    return classes;
  }, [classes, isTourDummyActive, tourDummyClasses]);

  const filteredClasses = useMemo(() => {
    if (!searchQuery.trim()) return displayClasses;
    const query = searchQuery.toLowerCase();
    return displayClasses.filter(
      (cls) =>
        cls.name.toLowerCase().includes(query) ||
        cls.description?.toLowerCase().includes(query)
    );
  }, [displayClasses, searchQuery]);

  const filteredGuestClasses = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return activeGuestClasses;
    return activeGuestClasses.filter((access) => (
      access.name.toLowerCase().includes(query) ||
      access.description?.toLowerCase().includes(query) ||
      access.ownerName?.toLowerCase().includes(query) ||
      access.ownerEmail?.toLowerCase().includes(query) ||
      access.subjects.some((subject) => subject.name.toLowerCase().includes(query))
    ));
  }, [activeGuestClasses, searchQuery]);

  const showOwnerClasses = accessFilter === "all" || accessFilter === "owner";
  const showGuestClasses = accessFilter === "all" || accessFilter === "guest";
  const visibleOwnerCount = showOwnerClasses ? filteredClasses.length : 0;
  const visibleGuestCount = showGuestClasses ? filteredGuestClasses.length : 0;
  const hasAnyClassShortcut = displayClasses.length > 0 || activeGuestClasses.length > 0;

  const classesWithoutKkm = useMemo(() => (
    displayClasses.filter((cls) => cls.class_kkm === null)
  ), [displayClasses]);

  const subjectCountByClassId = useMemo(() => {
    const counts = new Map<string, number>();
    allSubjects.forEach((subject) => {
      counts.set(subject.class_id, (counts.get(subject.class_id) || 0) + 1);
    });
    return counts;
  }, [allSubjects]);

  // GSAP entrance
  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;
    gsap.fromTo(containerRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!isLoading && classesWithoutKkm.length > 0 && !isTourDummyActive) {
      setShowClassKkmGuide(true);
    }
  }, [classesWithoutKkm.length, isLoading, isTourDummyActive]);

  const prepareClassesTour = () => {
    preTourSearchQueryRef.current = searchQuery;
    setSearchQuery("");

    const now = new Date().toISOString();
    const hasNoClasses = classes.length === 0;
    const hasNoNullKkmClasses = classes.length > 0 && !classes.some(cls => cls.class_kkm === null);

    if (hasNoClasses) {
      setIsTourDummyActive(true);
      setTourDummyClasses([
        {
          id: "tour-dummy-class-1",
          user_id: "tour-preview",
          academic_year_id: null,
          semester_id: null,
          name: "Contoh Kelas VIIA",
          description: "Kelas percontohan untuk panduan dengan KKM dasar telah terkonfigurasi dengan baik.",
          class_kkm: 75,
          created_at: now,
          updated_at: now,
          student_count: 32,
        },
        {
          id: "tour-dummy-class-2",
          user_id: "tour-preview",
          academic_year_id: null,
          semester_id: null,
          name: "Kelas 7B - Reguler",
          description: "Kelas contoh tanpa KKM dasar untuk menunjukkan fitur peringatan KKM.",
          class_kkm: null,
          created_at: now,
          updated_at: now,
          student_count: 18,
        }
      ]);
    } else if (hasNoNullKkmClasses) {
      setIsTourDummyActive(true);
      setTourDummyClasses([
        {
          id: "tour-dummy-class-null-kkm",
          user_id: "tour-preview",
          academic_year_id: null,
          semester_id: null,
          name: "Contoh Kelas KKM Kosong (Dummy)",
          description: "Kelas contoh sementara tanpa KKM untuk menunjukkan fitur peringatan KKM.",
          class_kkm: null,
          created_at: now,
          updated_at: now,
          student_count: 15,
        }
      ]);
    }
  };

  const cleanupClassesTour = () => {
    setIsTourDummyActive(false);
    setTourDummyClasses([]);
    if (preTourSearchQueryRef.current !== undefined) {
      setSearchQuery(preTourSearchQueryRef.current);
      preTourSearchQueryRef.current = "";
    }
  };

  const navigate = useNavigate();

  useEffect(() => {
    // Only trigger if location state explicitly asks for it
    if ((location.state as any)?.startTour) {
      // Clear state via React Router so it doesn't retrigger on refresh
      navigate(location.pathname, { replace: true, state: {} });
      setTimeout(() => {
        prepareClassesTour(); // Inject dummy data
        // Wait for React to render the dummy classes
        setTimeout(() => {
          import("@/components/ui/product-tour").then(({ triggerTour }) => {
            triggerTour("classes-tour");
          });
        }, 200);
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  return (
    <>
      <div ref={containerRef} className="app-page">
        {/* iOS-style Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-primary/10 flex items-center justify-center flex-shrink-0">
              <KelasIcon  className="w-[18px] h-[18px] sm:w-5 sm:h-5 " />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-foreground">
                Kelas & Murid
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Kelola daftar kelas dan data murid
              </p>
            </div>
          </div>
          <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-1.5 sm:flex sm:justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 min-w-[44px] gap-1.5 text-xs" data-tour="class-import-menu">
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Import</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[min(15rem,calc(100vw-1.5rem))]">
                <DropdownMenuItem onClick={() => setClassImportDialogOpen(true)} className="gap-2 min-h-[44px]">
                  <Upload className="w-4 h-4" />
                  Import Kelas & Murid
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowOCRImport(true)} className="gap-2 min-h-[44px]">
                  <Camera className="w-4 h-4" />
                  Import Murid dari Foto (OCR) <Badge className="ml-auto bg-amber-500 text-amber-950">BETA</Badge>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <TourButton tourKey="classes-tour" onBeforeStart={prepareClassesTour} />
            <div className="min-w-0" data-tour="add-class-btn">
              <AddClassDialog
                trigger={
                  <Button className="h-9 w-full min-w-0 gap-1.5 px-3 text-xs sm:w-auto sm:px-4 sm:text-sm">
                    <Plus className="h-4 w-4" />
                    <span className="truncate">Tambah Kelas</span>
                  </Button>
                }
              />
            </div>
          </div>
        </div>

        {/* Search - iOS grouped card */}
        <div className="sipena-search-field" data-tour="class-search">
          <Search className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <Input
            placeholder="Cari kelas berdasarkan nama..."
            className="sipena-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <span className="whitespace-nowrap text-[10px] text-muted-foreground">
              {filteredClasses.length} hasil
            </span>
          )}
        </div>

        {/* Loading State */}
        {(isLoading || guestAccessLoading) && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin " />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !guestAccessLoading && displayClasses.length === 0 && activeGuestClasses.length === 0 && (
          <div className="rounded-2xl bg-card border border-border/60 overflow-hidden">
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-16 h-16 rounded-[20px] bg-primary/10 flex items-center justify-center mb-4">
                <KelasIcon  className="w-8 h-8 " />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                Belum Ada Kelas
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-xs mb-4">
                Buat kelas pertama Anda untuk mulai mengelola murid dan nilai.
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

        {!isLoading && !guestAccessLoading && hasAnyClassShortcut && (
          <Tabs
            value={accessFilter}
            onValueChange={(value) => setAccessFilter(value as "all" | "owner" | "guest")}
            className="w-full sm:w-auto"
            data-tour="class-access-filter"
          >
            <TabsList className="grid h-11 w-full grid-cols-3 p-1 sm:inline-grid sm:w-auto">
              {([
                ["all", "Semua", displayClasses.length + activeGuestClasses.length],
                ["owner", "Kelas Saya", displayClasses.length],
                ["guest", "Guru Tamu", activeGuestClasses.length],
              ] as const).map(([value, label, count]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="min-w-0 gap-1 px-2 text-xs sm:min-w-[7.5rem] sm:px-3"
                >
                  {value === "guest" && <ShieldCheck className="h-3.5 w-3.5" />}
                  <span className="truncate">{label}</span>
                  <span className="rounded-full bg-current/10 px-1.5 text-[10px] tabular-nums">
                    {count}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
        {/* Info hint */}
        {!isLoading && !guestAccessLoading && hasAnyClassShortcut && (
          <div className="flex items-center gap-2 px-1 text-[10px] sm:text-xs text-muted-foreground">
            <Users className="w-3 h-3 flex-shrink-0" />
            <span>Gunakan tombol di kartu kelas untuk membuka detail, murid, mapel, atau nilai. Badge Guru Tamu berarti data tetap milik guru pemilik.</span>
          </div>
        )}

        {!isLoading && classesWithoutKkm.length > 0 && (
          <div className="rounded-2xl border border-grade-warning/30 bg-grade-warning/5 p-3 sm:p-4" data-tour="class-kkm-alert">
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
        {!isLoading && !guestAccessLoading && (visibleOwnerCount + visibleGuestCount) > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {showOwnerClasses && filteredClasses.map((cls, index) => (
                <div key={cls.id} data-tour={index === 0 ? "class-card" : undefined}>
                  <ClassCard
                    classData={cls}
                    subjectCount={subjectCountByClassId.get(cls.id) || 0}
                    isSubjectCountLoading={subjectsLoading}
                  />
                </div>
              ))}
            {showGuestClasses && filteredGuestClasses.map((access) => (
              <GuestClassCard
                key={`guest-${access.id}`}
                access={access}
                onTouchAccess={(sharedLinkId) => touchGuestAccess.mutate(sharedLinkId)}
              />
            ))}
          </div>
        )}

        {!isLoading && !guestAccessLoading && accessFilter === "guest" && activeGuestClasses.length === 0 && (
          <div className="rounded-2xl border border-dashed border-sky-300/70 bg-sky-50/50 p-6 text-center dark:border-sky-400/30 dark:bg-sky-950/20">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10">
              <ShieldCheck className="h-6 w-6 text-sky-600" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">Belum ada akses guru tamu</h3>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Buka link yang dibagikan guru lain untuk menambahkan akses. Setelah tersimpan, kelas dan mapel tamu akan muncul di sini.
            </p>
          </div>
        )}

        {!isLoading && !guestAccessLoading && accessFilter === "guest" && inactiveGuestClasses.length > 0 && activeGuestClasses.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground">
            Ada {inactiveGuestClasses.length} akses lama yang sudah dicabut atau kedaluwarsa. Minta link baru ke guru pemilik untuk membuka kembali akses.
          </div>
        )}

        {/* No Search Results */}
        {!isLoading && !guestAccessLoading && hasAnyClassShortcut && (visibleOwnerCount + visibleGuestCount) === 0 && (
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

      <ImportClassesStudentsDialog
        open={classImportDialogOpen}
        onOpenChange={setClassImportDialogOpen}
        existingClasses={classes}
      />

      {/* OCR Import Dialog */}
      <OCRImportDialog
        open={showOCRImport}
        onOpenChange={setShowOCRImport}
        type="students"
        title="Import Murid dari Foto"
        description="Baca daftar murid dari maksimal 5 foto, periksa hasilnya, lalu simpan ke kelas tujuan."
        availableClasses={ocrClassOptions.map((item) => ({ id: item.id, name: item.name }))}
        targetClassId={ocrTargetClassId}
        onTargetClassIdChange={setOcrTargetClassId}
        onRequestCreateClass={() => setOcrAddClassOpen(true)}
        context={{
          kind: "students",
          targetClassId: ocrTargetClassId,
          targetClassName: ocrClassOptions.find((item) => item.id === ocrTargetClassId)?.name,
          students: ocrTargetStudents.map((student) => ({ id: student.id, name: student.name, nisn: student.nisn })),
        }}
        onConfirmImport={async (plan) => {
          const nameIndex = plan.columns.findIndex((column) => column.semantic === "student_name");
          const nisnIndex = plan.columns.findIndex((column) => column.semantic === "nisn");
          const readyRows = plan.rows.filter((row) => row.included && !row.issues.some((issue) => issue.severity === "error" || issue.code === "STUDENT_EXISTS"));
          const inputs = readyRows.map((row) => ({
            class_id: ocrTargetClassId,
            name: row.values[nameIndex]?.trim() || "",
            nisn: row.values[nisnIndex]?.trim() || "",
          })).filter((row) => row.class_id && row.name && row.nisn);

          if (inputs.length) await createStudentsBatch.mutateAsync(inputs);
          const skipped = plan.rows.length - inputs.length;
          return {
            success: inputs.length,
            skipped,
            failed: 0,
            message: `${inputs.length} murid disimpan ke ${ocrClassOptions.find((item) => item.id === ocrTargetClassId)?.name || "kelas tujuan"}.`,
          };
        }}
      />
      <AddClassDialog
        trigger={null}
        open={ocrAddClassOpen}
        onOpenChange={setOcrAddClassOpen}
        onCreated={(createdClass) => {
          setOcrCreatedClass(createdClass);
          setOcrTargetClassId(createdClass.id);
        }}
      />

      {/* Product Tour */}
      <ProductTour steps={classesTourSteps} tourKey="classes-tour" onComplete={cleanupClassesTour} />
      <ClassKkmSetupDialog
        classes={classesWithoutKkm}
        open={showClassKkmGuide && classesWithoutKkm.length > 0}
        onOpenChange={setShowClassKkmGuide}
      />
    </>
  );
}
