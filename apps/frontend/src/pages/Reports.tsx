import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, type Variants } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Trophy,
  FileSpreadsheet,
  ArrowRight,
  Users,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  Clock,
  Share2,
  FileText,
  Download,
  ChevronRight,
} from "lucide-react";
import { useClasses } from "@/hooks/useClasses";
import { useSubjects } from "@/hooks/useSubjects";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { useInputProgress } from "@/hooks/useInputProgress";
import { cn } from "@/lib/utils";

// ─── Animation variants ─────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconClass: string;
  bgClass: string;
  isLoading: boolean;
  suffix?: string;
}

interface ReportEntry {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  accentClass: string;
  accentBg: string;
  iconColorClass: string;
  badge?: { label: string; variant: "default" | "secondary" | "outline" };
  capabilities: Array<{ icon: React.ElementType; label: string }>;
  cta: string;
}

// ─── Report definitions ──────────────────────────────────────────────────────

const REPORTS: ReportEntry[] = [
  {
    id: "grades",
    title: "Laporan Nilai",
    description:
      "Rekap nilai per kelas dan mata pelajaran mencakup nilai tugas per BAB, STS, SAS, dan nilai akhir rapor. Siap diekspor ke PDF atau Excel.",
    icon: FileSpreadsheet,
    href: "/reports/grades",
    accentClass: "from-primary to-primary/70",
    accentBg: "bg-primary/8",
    iconColorClass: "text-primary",
    capabilities: [
      { icon: BookOpen, label: "Nilai per BAB & Tugas" },
      { icon: FileText, label: "STS & SAS" },
      { icon: GraduationCap, label: "Nilai Rapor" },
      { icon: Download, label: "Ekspor PDF / Excel" },
    ],
    cta: "Lihat Laporan Nilai",
  },
  {
    id: "rankings",
    title: "Ranking Siswa",
    description:
      "Peringkat siswa berdasarkan nilai rata-rata per mata pelajaran maupun keseluruhan kelas. Tampilkan visualisasi podium dan ekspor daftar ranking.",
    icon: Trophy,
    href: "/reports/rankings",
    accentClass: "from-amber-500 to-orange-400",
    accentBg: "bg-amber-500/8",
    iconColorClass: "text-amber-500",
    capabilities: [
      { icon: Trophy, label: "Ranking per Mata Pelajaran" },
      { icon: Users, label: "Ranking Keseluruhan Kelas" },
      { icon: BarChart3, label: "Visualisasi Podium" },
      { icon: Download, label: "Ekspor Ranking" },
    ],
    cta: "Lihat Ranking Siswa",
  },
  {
    id: "portal",
    title: "Portal Orang Tua",
    description:
      "Buat tautan khusus untuk orang tua/wali melihat perkembangan akademik siswa. Kustomisasi data yang ditampilkan dan bagikan via link atau QR Code.",
    icon: Share2,
    href: "/reports/portal",
    accentClass: "from-emerald-500 to-teal-400",
    accentBg: "bg-emerald-500/8",
    iconColorClass: "text-emerald-500",
    badge: { label: "Aktif", variant: "secondary" },
    capabilities: [
      { icon: Share2, label: "Link & QR Code" },
      { icon: FileText, label: "Nilai & Presensi" },
      { icon: Trophy, label: "Ranking Kelas" },
      { icon: Users, label: "Kustomisasi Data" },
    ],
    cta: "Kelola Portal Orang Tua",
  },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ stat }: { stat: StatItem }) {
  const Icon = stat.icon;
  return (
    <div className="flex items-center gap-3 py-3 px-4 rounded-xl border border-border bg-card">
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", stat.bgClass)}>
        <Icon className={cn("w-4 h-4", stat.iconClass)} />
      </div>
      <div className="min-w-0">
        {stat.isLoading ? (
          <Skeleton className="h-5 w-10 mb-0.5" />
        ) : (
          <p className="text-base font-bold text-foreground leading-tight">
            {stat.value}
            {stat.suffix && <span className="text-xs font-medium text-muted-foreground ml-0.5">{stat.suffix}</span>}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground truncate">{stat.label}</p>
      </div>
    </div>
  );
}

function ProgressBar({ percentage }: { percentage: number }) {
  const color =
    percentage >= 75
      ? "bg-grade-pass"
      : percentage >= 40
      ? "bg-grade-warning"
      : "bg-grade-fail";

  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
      />
    </div>
  );
}

function ReportCard({
  report,
  progressData,
}: {
  report: ReportEntry;
  progressData?: { classes: number; subjects: number; students: number };
}) {
  const Icon = report.icon;

  return (
    <Link to={report.href} className="block group" aria-label={`Buka ${report.title}`}>
      <Card
        className={cn(
          "h-full border border-border bg-card overflow-hidden",
          "hover:border-primary/30 hover:shadow-lg transition-all duration-250"
        )}
      >
        {/* Accent top bar */}
        <div className={cn("h-[3px] bg-gradient-to-r w-full", report.accentClass)} />

        <CardContent className="p-5 flex flex-col gap-4 h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  "bg-gradient-to-br",
                  report.accentClass,
                  "shadow-sm group-hover:scale-105 transition-transform duration-200"
                )}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {report.title}
                </h2>
                {report.badge && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 mt-0.5">
                    {report.badge.label}
                  </Badge>
                )}
              </div>
            </div>
            <ArrowRight
              className={cn(
                "w-4 h-4 text-muted-foreground/50 shrink-0 mt-0.5",
                "group-hover:text-primary group-hover:translate-x-1 transition-all duration-200"
              )}
            />
          </div>

          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">{report.description}</p>

          {/* Capabilities list */}
          <div className="grid grid-cols-2 gap-1.5">
            {report.capabilities.map((cap) => {
              const CapIcon = cap.icon;
              return (
                <div key={cap.label} className="flex items-center gap-1.5 min-w-0">
                  <CapIcon className={cn("w-3 h-3 shrink-0", report.iconColorClass)} />
                  <span className="text-[11px] text-muted-foreground truncate">{cap.label}</span>
                </div>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-border/60" />

          {/* CTA footer */}
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-xs font-semibold transition-colors duration-200",
                report.iconColorClass,
                "group-hover:opacity-80"
              )}
            >
              {report.cta}
            </span>
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 transition-all duration-200",
                report.iconColorClass,
                "group-hover:translate-x-0.5"
              )}
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const { classes, isLoading: classesLoading } = useClasses();
  const { allSubjects, isLoading: subjectsLoading } = useSubjects();
  const { activeYear, activeSemester } = useAcademicYear();
  const { data: progress, isLoading: progressLoading } = useInputProgress();

  const totalStudents = useMemo(
    () => classes.reduce((sum, cls) => sum + (cls.student_count || 0), 0),
    [classes]
  );

  const isDataLoading = classesLoading || subjectsLoading || progressLoading;

  const stats: StatItem[] = [
    {
      label: "Kelas aktif",
      value: classes.length,
      icon: GraduationCap,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      isLoading: classesLoading,
    },
    {
      label: "Mata pelajaran",
      value: allSubjects.length,
      icon: BookOpen,
      iconClass: "text-accent",
      bgClass: "bg-accent/10",
      isLoading: subjectsLoading,
    },
    {
      label: "Total murid",
      value: totalStudents,
      icon: Users,
      iconClass: "text-grade-pass",
      bgClass: "bg-grade-pass/10",
      isLoading: classesLoading,
    },
    {
      label: "Input nilai",
      value: progress.percentage,
      suffix: "%",
      icon: progress.percentage >= 75 ? CheckCircle2 : Clock,
      iconClass:
        progress.percentage >= 75
          ? "text-grade-pass"
          : progress.percentage >= 40
          ? "text-grade-warning"
          : "text-grade-fail",
      bgClass:
        progress.percentage >= 75
          ? "bg-grade-pass/10"
          : progress.percentage >= 40
          ? "bg-grade-warning/10"
          : "bg-grade-fail/10",
      isLoading: progressLoading,
    },
  ];

  const contextLine =
    activeYear && activeSemester
      ? `${activeYear.name} · ${activeSemester.name}`
      : activeYear
      ? activeYear.name
      : "Tahun ajaran belum dikonfigurasi";

  return (
    <>
      <div className="app-page app-page-readable">
        {/* ── Page Header ───────────────────────────────────────────────── */}
        <PageHeader
          icon={<BarChart3 className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />}
          title="Laporan"
          subtitle={contextLine}
          breadcrumbs={[{ label: "Laporan" }]}
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-5"
        >
          {/* ── Stats Bar ─────────────────────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {stats.map((stat) => (
                <StatCard key={stat.label} stat={stat} />
              ))}
            </div>

            {/* Progress bar for input nilai */}
            {!isDataLoading && (
              <div className="mt-3 px-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    Progress input nilai semester ini
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      progress.percentage >= 75
                        ? "text-grade-pass"
                        : progress.percentage >= 40
                        ? "text-grade-warning"
                        : "text-grade-fail"
                    )}
                  >
                    {progress.totalEntered} / {progress.totalExpected} entri
                  </span>
                </div>
                <ProgressBar percentage={progress.percentage} />
              </div>
            )}
          </motion.div>

          {/* ── Section label ─────────────────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pilih Jenis Laporan
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </motion.div>

          {/* ── Report Cards ──────────────────────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {/* Laporan Nilai + Ranking side by side on desktop */}
            <ReportCard
              report={REPORTS[0]}
              progressData={{
                classes: classes.length,
                subjects: allSubjects.length,
                students: totalStudents,
              }}
            />
            <ReportCard
              report={REPORTS[1]}
              progressData={{
                classes: classes.length,
                subjects: allSubjects.length,
                students: totalStudents,
              }}
            />
          </motion.div>

          {/* Portal Orang Tua — full width with horizontal layout on desktop */}
          <motion.div variants={itemVariants}>
            <Link
              to="/reports/portal"
              className="block group"
              aria-label="Buka Portal Orang Tua"
            >
              <Card className="border border-border bg-card hover:border-emerald-500/30 hover:shadow-lg transition-all duration-250 overflow-hidden">
                <div className="h-[3px] bg-gradient-to-r from-emerald-500 to-teal-400 w-full" />
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    {/* Icon + title */}
                    <div className="flex items-center gap-3 sm:w-[220px] shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200">
                        <Share2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                          Portal Orang Tua
                        </h2>
                        <span className="text-[10px] text-muted-foreground">
                          Bagikan perkembangan siswa
                        </span>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      Buat tautan khusus bagi orang tua/wali untuk memantau nilai, presensi, dan
                      ranking siswa secara mandiri. Bagikan via link langsung atau QR Code, dengan
                      pilihan data yang dapat dikustomisasi.
                    </p>

                    {/* Capabilities + CTA */}
                    <div className="flex flex-col gap-2.5 sm:items-end sm:shrink-0 sm:w-[160px]">
                      <div className="flex flex-wrap sm:flex-col gap-1.5">
                        {REPORTS[2].capabilities.map((cap) => {
                          const CapIcon = cap.icon;
                          return (
                            <div key={cap.label} className="flex items-center gap-1.5">
                              <CapIcon className="w-3 h-3 shrink-0 text-emerald-500" />
                              <span className="text-[11px] text-muted-foreground">{cap.label}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:opacity-80 transition-opacity">
                        Kelola Portal
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>

          {/* ── Tips strip ────────────────────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-dashed border-border bg-muted/30">
              <Download className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Tip: Ekspor laporan</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  Semua laporan dapat diekspor ke <strong>PDF</strong> atau <strong>Excel</strong>.
                  Pastikan data nilai semester sudah lengkap sebelum mengekspor rapor resmi.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}
