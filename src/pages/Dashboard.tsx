import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  BookOpen,
  FileSpreadsheet,
  AlertCircle,
  ArrowRight,
  Calendar,
  BarChart3,
  Plus,
  User,
  Clock,
} from "lucide-react";
import { useClasses } from "@/hooks/useClasses";
import { useSubjects } from "@/hooks/useSubjects";
import { useAcademicYears } from "@/hooks/useAcademicYears";
import { useSemesters } from "@/hooks/useSemesters";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { useInputProgress } from "@/hooks/useInputProgress";
import { StudentPredictionCard } from "@/components/dashboard/StudentPredictionCard";
import { TopStudentsCarousel } from "@/components/dashboard/TopStudentsCarousel";
import { ProductTour, TourButton, TourStep } from "@/components/ui/product-tour";
import { ThemeSelectionDialog } from "@/components/onboarding/ThemeSelectionDialog";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

const dashboardTourSteps: TourStep[] = [
  {
    target: "[data-tour='stats-grid']",
    title: "Statistik Ringkas",
    description: "Lihat ringkasan cepat: jumlah kelas, mata pelajaran, siswa, dan progress input nilai.",
  },
  {
    target: "[data-tour='quick-actions']",
    title: "Akses Cepat",
    description: "Navigasi langsung ke fitur utama: Setup, Kelas, Input Nilai, dan Laporan.",
  },
  {
    target: "[data-tour='activity-log']",
    title: "Aktivitas Terakhir",
    description: "Pantau aktivitas terbaru seperti input nilai dan perubahan data.",
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { success } = useEnhancedToast();
  const { classes, isLoading: classesLoading } = useClasses();
  const { allSubjects, isLoading: subjectsLoading } = useSubjects();
  const { activeYear, isLoading: yearsLoading } = useAcademicYears();
  const { activeSemester, isLoading: semestersLoading } = useSemesters();
  const { activityLogs, isLoading: activityLoading } = useActivityLogs();
  const { data: inputProgress, isLoading: inputProgressLoading } = useInputProgress();
  const { needsOnboarding, createPreferences } = useUserPreferences();

  // Handle theme selection for new users (moved from Grades)
  const handleThemeSelection = useCallback(async (mode: "light" | "dark") => {
    await createPreferences(mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", mode);
    success("Tema berhasil disimpan!", `Mode ${mode === "dark" ? "gelap" : "terang"} akan digunakan.`);
  }, [createPreferences, success]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalStudents = classes.reduce((sum, cls) => sum + (cls.student_count || 0), 0);
    
    return [
      {
        label: "Kelas",
        value: classes.length.toString(),
        icon: Users,
        color: "text-primary",
        bgColor: "bg-primary/10",
      },
      {
        label: "Mapel",
        value: allSubjects.length.toString(),
        icon: BookOpen,
        color: "text-accent",
        bgColor: "bg-accent/10",
      },
      {
        label: "Siswa",
        value: totalStudents.toString(),
        icon: Users,
        color: "text-grade-pass",
        bgColor: "bg-grade-pass/10",
      },
      {
        label: "Input",
        value: `${inputProgress.percentage}%`,
        icon: FileSpreadsheet,
        color: inputProgress.percentage >= 75 
          ? "text-grade-pass" 
          : inputProgress.percentage >= 50 
            ? "text-grade-warning" 
            : "text-grade-fail",
        bgColor: inputProgress.percentage >= 75 
          ? "bg-grade-pass/10" 
          : inputProgress.percentage >= 50 
            ? "bg-grade-warning/10" 
            : "bg-grade-fail/10",
        hasProgress: true,
        progress: inputProgress.percentage,
      },
    ];
  }, [classes, allSubjects, inputProgress]);

  const quickActions = [
    {
      label: "Kelas",
      description: "Kelola siswa",
      icon: Plus,
      href: "/classes",
      color: "from-primary to-primary/80",
    },
    {
      label: "Mapel",
      description: "Mata Pelajaran",
      icon: BookOpen,
      href: "/subjects",
      color: "from-accent to-accent/80",
    },
    {
      label: "Nilai",
      description: "Input nilai",
      icon: FileSpreadsheet,
      href: "/grades",
      color: "from-grade-pass to-grade-pass/80",
    },
    {
      label: "Presensi",
      description: "Kelola kehadiran",
      icon: Calendar,
      href: "/attendance",
      color: "from-grade-warning to-grade-warning/80",
    },
    {
      label: "Ranking",
      description: "Peringkat siswa",
      icon: BarChart3,
      href: "/reports/rankings",
      color: "from-[hsl(var(--highlight-moon))] to-[hsl(var(--highlight-moon)/0.8)]",
    },
    {
      label: "Laporan",
      description: "Ekspor rapor",
      icon: User,
      href: "/reports",
      color: "from-destructive to-destructive/80",
    },
  ];

  const isLoading = classesLoading || subjectsLoading || yearsLoading || semestersLoading;
  const needsSetup = !activeYear || !activeSemester;
  const hasNoClasses = !classesLoading && classes.length === 0;

  return (
    <>
      <div className="app-page">
        {/* Welcome Section */}
        <div className="animate-fade-in flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground truncate">
              Halo, {user?.user_metadata?.full_name?.split(' ')[0] || "Guru"}! 👋
            </h1>
            {activeYear && activeSemester && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                {activeYear.name} - {activeSemester.name}
              </p>
            )}
          </div>
          <TourButton tourKey="dashboard-tour" />
        </div>

        {/* Setup Alert - Now directs to sidebar/settings */}
        {needsSetup && (
          <Card className="border-grade-warning/50 bg-grade-warning/5 animate-fade-in-up">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-grade-warning/20 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-grade-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-xs sm:text-sm">Langkah Pertama</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Buat tahun ajaran dari menu sidebar (klik ikon kalender)
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Classes Alert */}
        {!needsSetup && hasNoClasses && (
          <Card className="border-primary/50 bg-primary/5 animate-fade-in-up">
            <CardContent className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground text-xs sm:text-sm">Buat Kelas</h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  Tambahkan kelas dan siswa
                </p>
              </div>
              <Button size="sm" onClick={() => navigate("/classes")} className="text-xs">
                Buat
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-1" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div 
          className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:gap-4 animate-fade-in-up delay-100"
          data-tour="stats-grid"
        >
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="border border-border shadow-sm">
                <CardContent className="p-2 sm:p-3 lg:p-4">
                  <div className="flex flex-col items-center sm:flex-row sm:justify-between">
                    <div className="w-full space-y-2">
                      <Skeleton className="h-2.5 w-10" />
                      <Skeleton className="h-6 w-14" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
          stats.map((stat, index) => (
            <Card key={index} className="relative overflow-hidden border border-border shadow-sm">
              <CardContent className="p-2 sm:p-3 lg:p-4">
                <div className="flex flex-col items-center sm:flex-row sm:justify-between">
                  <div className="text-center sm:text-left w-full">
                    <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
                    <p className="text-base sm:text-lg lg:text-2xl font-bold text-foreground">{stat.value}</p>
                    {stat.hasProgress && (
                      <Progress 
                        value={stat.progress} 
                        className="h-1 mt-1"
                      />
                    )}
                  </div>
                  <div className={`hidden sm:flex w-8 h-8 lg:w-10 lg:h-10 rounded-xl ${stat.bgColor} items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`w-4 h-4 lg:w-5 lg:h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
          )}
        </div>

        {/* Quick Actions */}
        <div className="animate-fade-in-up delay-200" data-tour="quick-actions">
          <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            {quickActions.map((action, index) => (
              <Card
                key={index}
                className="group cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden border border-border"
                onClick={() => navigate(action.href)}
              >
                <CardContent className="p-0">
                  <div className={`h-1 sm:h-1.5 bg-gradient-to-r ${action.color}`} />
                  <div className="p-2.5 sm:p-3 lg:p-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className={`w-8 h-8 sm:w-9 sm:h-9 lg:w-10 lg:h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                        <action.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground text-xs sm:text-sm group-hover:text-primary transition-colors truncate">
                          {action.label}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate hidden sm:block">{action.description}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Classes Overview - Compact */}
        {classes.length > 0 && (
          <div className="animate-fade-in-up delay-300">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h2 className="text-xs sm:text-sm font-semibold text-foreground">Kelas Anda</h2>
              <Button variant="ghost" size="sm" onClick={() => navigate("/classes")} className="text-[10px] sm:text-xs h-6 sm:h-7">
                Semua
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 sm:gap-2">
              {classes.slice(0, 4).map((cls) => (
                <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer border border-border" onClick={() => navigate("/classes")}>
                  <CardContent className="p-2 sm:p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground text-xs sm:text-sm truncate">{cls.name}</h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          {cls.student_count || 0} siswa
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Activity, Prediction & Ranking Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 animate-fade-in-up delay-400">
          {/* AI Prediction Card */}
          <StudentPredictionCard />

          {/* Top 10 Ranking - Now with carousel */}
          <TopStudentsCarousel limit={10} rotationInterval={8000} />

          {/* Recent Activity */}
          <Card data-tour="activity-log" className="border border-border shadow-sm">
            <CardHeader className="pb-2 p-3 sm:p-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  Aktivitas Terakhir
                </CardTitle>
                {!activityLoading && activityLogs.length > 0 && (
                  <span className="text-[9px] text-muted-foreground/60">auto-refresh 15s</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-2 sm:p-4 sm:pt-2">
              {activityLoading ? (
                <div className="space-y-2 py-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 sm:p-2">
                      <Skeleton className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2 w-16" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted flex items-center justify-center mb-2 sm:mb-3">
                    <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Belum ada aktivitas</p>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 mt-1">Aktivitas akan muncul saat Anda mulai menggunakan SIPENA</p>
                </div>
              ) : (
              <ScrollArea className="h-[240px] sm:h-[280px]">
                <div className="space-y-1 sm:space-y-1.5 pr-2">
                  {activityLogs.map((log) => {
                    const getActionIcon = (entityType: string) => {
                      if (entityType === "grade" || entityType === "grades") return FileSpreadsheet;
                      if (entityType === "attendance") return Users;
                      if (entityType === "class" || entityType === "student") return Users;
                      if (entityType === "subject") return BookOpen;
                      return User;
                    };
                    const ActionIcon = getActionIcon(log.entity_type);
                    
                    // Build more descriptive action text
                    const getDetailedAction = () => {
                      const parts: string[] = [];
                      parts.push(log.action);
                      if (log.entity_name) {
                        const entityLabel = log.entity_type === "subject" ? "mapel" 
                          : log.entity_type === "class" ? "kelas"
                          : log.entity_type === "student" ? "siswa"
                          : log.entity_type === "grade" || log.entity_type === "grades" ? "nilai"
                          : log.entity_type === "attendance" ? "presensi"
                          : "";
                        parts.push(entityLabel ? `${entityLabel} ${log.entity_name}` : log.entity_name);
                      }
                      return parts.join(" ");
                    };
                    
                    return (
                        <div key={log.id} className="flex items-start gap-2 p-1.5 sm:p-2 rounded-lg hover:bg-muted/50 transition-colors">
                         <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                           log.actor_type === "guest" ? "bg-accent/20 text-accent" : "bg-primary/10 text-primary"
                         }`}>
                           <ActionIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                         </div>
                         <div className="flex-1 min-w-0">
                           <p className="text-[10px] sm:text-xs leading-relaxed break-words">
                             <span className="font-semibold text-foreground">{log.actor_name || "Anda"}</span>
                             <span className="text-muted-foreground"> {getDetailedAction()}</span>
                           </p>
                           <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                             <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                             <span className="truncate">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: id })}</span>
                           </p>
                         </div>
                       </div>
                    );
                  })}
                </div>
              </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Product Tour */}
      <ProductTour steps={dashboardTourSteps} tourKey="dashboard-tour" />

      {/* Theme Selection Dialog for new users - shown on first visit */}
      <ThemeSelectionDialog
        isOpen={needsOnboarding}
        onSelect={handleThemeSelection}
      />
    </>
  );
}
