import { RankingMuridIcon } from "@/components/ui/animated-icons";
import { useState, useMemo, useEffect, useCallback } from "react";

import { PaginationControls } from "@/components/rankings/PaginationControls";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useClasses } from "@/hooks/useClasses";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { Link } from "react-router-dom";
import { RankingSemesterSelector, useRankingSemesterFilter } from "@/components/reports/RankingSemesterSelector";
import { useStudentRankings } from "@/hooks/useStudentRankings";
import {
  Trophy,
  Medal,
  Award,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Crown,
  ArrowLeft,
  School,
  Loader2,
  Calendar,
  Layers,
  Check,
  X,
  Users,
  BookOpen,
  GraduationCap,
  Filter,
  TrendingUp,
  ChevronRight,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExportLoader } from "@/components/ExportLoaderOverlay";
import type { ExportProgressReporter } from "@/lib/exportProgress";
import { useSignatureSettings } from "@/hooks/useSignatureSettings";
import { UnifiedExportStudio, type ExportColumnOption, type ExportColumnTypographyOption, type ExportStudioFormatOption } from "@/components/export/UnifiedExportStudio";
import { ExportPreviewRenderer } from "@/components/export/ExportPreviewRenderer";
import { buildRankingExportColumns, getDefaultSelectedColumns, buildRankingExportData, getRankingExportColumnLabel } from "@/lib/rankingExportColumns";
import { getNaturalColumnWidthMmV2, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import { exportReportWithProgress, type ExportColumn, type ExportConfig, type ReportPaperSize } from "@/lib/exportReports";
import type { RankingColumn } from "@/components/rankings/RankingColumnSelector";
import { buildCompactRankingDocumentStyle, createDefaultRankingDocumentStyle } from "@/lib/rankingExportLayout";

const RANKING_EXPORT_FORMATS: ExportStudioFormatOption[] = [
  {
    id: "pdf",
    label: "PDF",
    description: "Dokumen ranking siap dibagikan atau dicetak.",
    icon: FileText,
    badge: "Preview aktif",
    previewMode: "pdf",
  },
  {
    id: "excel",
    label: "Excel",
    description: "File spreadsheet untuk olah data ranking.",
    icon: FileSpreadsheet,
    previewMode: null,
  },
  {
    id: "csv",
    label: "CSV",
    description: "Format data ringan untuk integrasi lanjutan.",
    icon: FileSpreadsheet,
    previewMode: null,
  },
  {
    id: "png-hd",
    label: "PNG HD",
    description: "Snapshot ranking resolusi tinggi.",
    icon: ImageIcon,
    badge: "HD",
    previewMode: "png",
  },
  {
    id: "png-4k",
    label: "PNG 4K Ultra HD",
    description: "Snapshot ranking dengan kualitas paling tajam.",
    icon: ImageIcon,
    badge: "4K",
    previewMode: "png",
  },
];

export default function StudentRankings() {
  const { toast } = useEnhancedToast();
  const { classes } = useClasses();
  const { runWithLoader, overlay: exportOverlay } = useExportLoader();
  const { activeYear } = useAcademicYear();
  const { semesterFilter, setSemesterFilter, isCombinedView } = useRankingSemesterFilter();
  const rankingPeriodLabel = isCombinedView ? "Ranking Tahunan / Semua Semester" : `Semester ${semesterFilter}`;
  const rankingPeriodShortLabel = isCombinedView ? "Ranking Tahunan" : `Sem ${semesterFilter}`;
  
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel" | "csv" | "png-hd" | "png-4k">("pdf");
  const [paperSize, setPaperSize] = useState<ReportPaperSize>("a4");
  const [documentStyle, setDocumentStyle] = useState<ReportDocumentStyle>(() => createDefaultRankingDocumentStyle());
  const [autoFitOnePage, setAutoFitOnePage] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(false);
  const {
    signatureConfig,
    hasSignature,
    isLoading: signatureLoading,
    isSaving: signatureSaving,
    saveSignature,
  } = useSignatureSettings();

  useEffect(() => {
    if (!signatureLoading) setIncludeSignature(hasSignature);
  }, [hasSignature, signatureLoading]);
  const { subjects, overallRankings, isLoading: gradesLoading } = useStudentRankings({
    classId: selectedClassId,
    semesterFilter,
    overallSubjectIds: selectedSubjectIds,
  });

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const classKkm = selectedClass?.class_kkm ?? 75;
  const isAllSubjectsMode = selectedSubjectIds.length === 0;
  const hasExplicitSubjectSelection = selectedSubjectIds.length > 0;
  const areAllSubjectsSelected = subjects.length > 0 && selectedSubjectIds.length === subjects.length;
  const activeSubjectCount = isAllSubjectsMode ? subjects.length : selectedSubjectIds.length;
  const subjectScopeLabel = isAllSubjectsMode || areAllSubjectsSelected
    ? `Semua ${subjects.length} mapel`
    : `${selectedSubjectIds.length}/${subjects.length} mapel`;
  const subjectScopeDescription = isAllSubjectsMode || areAllSubjectsSelected
    ? "Ranking memakai seluruh mata pelajaran kelas ini."
    : "Ranking hanya memakai mata pelajaran yang dipilih.";

  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);

  const [exportColumns, setExportColumns] = useState<RankingColumn[]>([]);
  const [selectedExportColumnIds, setSelectedExportColumnIds] = useState<string[]>([]);

  useEffect(() => {
    const newColumns = buildRankingExportColumns(subjects);
    setExportColumns(newColumns);
    setSelectedExportColumnIds(getDefaultSelectedColumns(newColumns));
  }, [subjects]);

  useEffect(() => {
    setSelectedSubjectIds([]);
    setCurrentPage(1);
  }, [selectedClassId, semesterFilter]);

  const toggleSubjectSelection = (subjectId: string) => {
    setSelectedSubjectIds((prev) => {
      if (prev.length === 0) return [subjectId];

      const next = prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId];

      return next;
    });
    setCurrentPage(1);
  };

  const selectAllSubjects = () => {
    setSelectedSubjectIds(subjects.map((subject) => subject.id));
    setCurrentPage(1);
  };

  const clearSubjectSelection = () => {
    setSelectedSubjectIds([]);
    setCurrentPage(1);
  };

  const getRankBadge = (rank: number) => {
    const baseClasses = "shrink-0 whitespace-nowrap transition-all duration-200";
    
    if (rank === 1) {
      return (
        <Badge className={cn(baseClasses, "bg-gradient-to-r from-amber-500 to-yellow-400 text-white gap-1 shadow-md shadow-amber-500/20 px-1.5 sm:px-2.5 py-0.5 sm:py-1")}>
          <Crown className="w-3 h-3 shrink-0" />
          <span className="hidden sm:inline text-xs">Juara 1</span>
          <span className="sm:hidden text-[10px] font-bold">1</span>
        </Badge>
      );
    }
    if (rank === 2) {
      return (
        <Badge className={cn(baseClasses, "bg-gradient-to-r from-gray-400 to-gray-300 text-gray-800 gap-1 shadow-md shadow-gray-400/20 px-1.5 sm:px-2.5 py-0.5 sm:py-1")}>
          <Medal className="w-3 h-3 shrink-0" />
          <span className="hidden sm:inline text-xs">Juara 2</span>
          <span className="sm:hidden text-[10px] font-bold">2</span>
        </Badge>
      );
    }
    if (rank === 3) {
      return (
        <Badge className={cn(baseClasses, "bg-gradient-to-r from-amber-700 to-amber-600 text-white gap-1 shadow-md shadow-amber-700/20 px-1.5 sm:px-2.5 py-0.5 sm:py-1")}>
          <Award className="w-3 h-3 shrink-0" />
          <span className="hidden sm:inline text-xs">Juara 3</span>
          <span className="sm:hidden text-[10px] font-bold">3</span>
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={cn(baseClasses, "text-[10px] sm:text-xs px-2 py-0.5 sm:py-1 text-muted-foreground border-muted-foreground/30")}>
        #{rank}
      </Badge>
    );
  };

  const formatGrade = (value: number): string => {
    return Math.round(value * 10) / 10 + "";
  };

  const buildExportSignature = useCallback((config: typeof signatureConfig) => ({
    city: config.city,
    signers: config.signers,
    useCustomDate: config.useCustomDate,
    customDate: config.customDate,
    fontSize: config.fontSize,
    showSignatureLine: config.showSignatureLine,
    signatureLinePosition: config.signatureLinePosition,
    signatureLineWidth: config.signatureLineWidth,
    signatureSpacing: config.signatureSpacing,
    signatureAlignment: config.signatureAlignment,
    signatureOffsetX: config.signatureOffsetX,
    signatureOffsetY: config.signatureOffsetY,
    placementMode: config.placementMode,
    signaturePreset: config.signaturePreset,
    manualXPercent: config.manualXPercent,
    manualYPercent: config.manualYPercent,
    snapToGrid: config.snapToGrid,
    gridSizeMm: config.gridSizeMm,
    lockSignaturePosition: config.lockSignaturePosition,
    showDebugGuides: config.showDebugGuides,
  }), []);

  const mapRankingColumnType = useCallback((column: RankingColumn): ExportColumn["type"] => {
    if (column.id === "rank") return "index";
    if (column.id === "name") return "name";
    if (column.id === "nisn") return "nisn";
    if (column.id === "status") return "status";
    if (column.id === "average") return "grandAvg";
    return "assignment";
  }, []);

  const buildMetaGroups = useCallback((items: {
    left?: Array<{ label: string; value: string | number }>;
    center?: Array<{ label: string; value: string | number }>;
    right?: Array<{ label: string; value: string | number }>;
  }) => ([
    { align: "left" as const, items: items.left ?? [] },
    { align: "center" as const, items: items.center ?? [] },
    { align: "right" as const, items: items.right ?? [] },
  ].filter((group) => group.items.length > 0)), []);

  const selectedOverallColumns = useMemo(() => {
    const subjectsToUse = selectedSubjectIds.length > 0 ? new Set(selectedSubjectIds) : null;

    return exportColumns.filter((column) => {
      if (!selectedExportColumnIds.includes(column.id)) return false;
      if (column.category !== "grades" || !subjectsToUse) return true;
      return !!column.subjectId && subjectsToUse.has(column.subjectId);
    });
  }, [exportColumns, selectedExportColumnIds, selectedSubjectIds]);

  const overallExportColumns = useMemo<ExportColumn[]>(() => selectedOverallColumns.map((column) => ({
    key: column.key,
    label: getRankingExportColumnLabel(column),
    type: mapRankingColumnType(column),
  })), [mapRankingColumnType, selectedOverallColumns]);

  const overallExportConfig = useMemo<ExportConfig | null>(() => {
    if (!selectedClass) return null;
    const subjectsToUse = selectedSubjectIds.length > 0
      ? subjects.filter((subject) => selectedSubjectIds.includes(subject.id))
      : subjects;
    const exportColumnsToUse = selectedSubjectIds.length > 0
      ? exportColumns.filter((column) => column.category !== "grades" || !column.subjectId || selectedSubjectIds.includes(column.subjectId))
      : exportColumns;
    const selectedColumnIdsToUse = selectedExportColumnIds.filter((columnId) =>
      exportColumnsToUse.some((column) => column.id === columnId)
    );
    const data = buildRankingExportData(
      overallRankings,
      exportColumnsToUse,
      selectedColumnIdsToUse,
      classKkm,
      formatGrade,
    );
    const compactRankingDocumentStyle = buildCompactRankingDocumentStyle(
      documentStyle,
      overallExportColumns,
      paperSize,
      data,
    );

    return {
      className: selectedClass.name,
      subjectName: "Ranking Keseluruhan",
      kkm: classKkm,
      periodLabel: rankingPeriodLabel,
      isCombinedView,
      columns: overallExportColumns,
      headerGroups: [{ label: "Ranking Keseluruhan", colSpan: overallExportColumns.length }],
      chapterGroups: [],
      data,
      dateStr: new Date().toLocaleDateString("id-ID"),
      studentCount: overallRankings.length,
      chapterCount: 0,
      assignmentCount: subjectsToUse.length,
      includeSignature: includeSignature && hasSignature,
      signature: buildExportSignature(signatureConfig),
      paperSize,
      documentStyle: compactRankingDocumentStyle,
      autoFitOnePage,
      documentTitle: "RANKING KESELURUHAN SISWA",
      continuationTitle: "Lanjutan Ranking Keseluruhan Siswa",
      metaGroups: buildMetaGroups({
        left: [
          { label: "Kelas", value: selectedClass.name },
          { label: "Tahun Ajaran", value: activeYear?.name ?? "-" },
        ],
        center: [
          { label: "Mapel", value: subjectsToUse.length },
          { label: "Periode", value: rankingPeriodLabel },
        ],
        right: [
          { label: "Tanggal", value: new Date().toLocaleDateString("id-ID") },
          { label: "Jumlah Siswa", value: overallRankings.length },
        ],
      }),
      fileBaseName: `Ranking_Keseluruhan_${selectedClass.name}`,
    };
  }, [
    activeYear?.name,
    autoFitOnePage,
    buildExportSignature,
    buildMetaGroups,
    classKkm,
    documentStyle,
    exportColumns,
    hasSignature,
    includeSignature,
    isCombinedView,
    overallRankings,
    overallExportColumns,
    paperSize,
    rankingPeriodLabel,
    selectedClass,
    selectedExportColumnIds,
    selectedSubjectIds,
    signatureConfig,
    subjects,
  ]);

  const overallColumnOptions = useMemo<ExportColumnOption[]>(() => exportColumns.map((column) => ({
    key: column.id,
    label: column.label,
    description: column.description,
    checked: selectedExportColumnIds.includes(column.id),
  })), [exportColumns, selectedExportColumnIds]);

  const handleOverallColumnOptionChange = useCallback((key: string, checked: boolean) => {
    setSelectedExportColumnIds((prev) => {
      const column = exportColumns.find((item) => item.id === key);
      if (!column) return prev;
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      if (column.required) {
        return prev;
      }
      return prev.filter((item) => item !== key);
    });
  }, [exportColumns]);

  const buildColumnTypographyOptions = useCallback((config: ExportConfig | null): ExportColumnTypographyOption[] => {
    if (!config) return [];
    return config.columns.map((column) => {
      const values = config.data
        .map((row) => row[column.key])
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));
      const sampleValue = values.find((value) => value.trim().length > 0) || "";
      const maxValueLength = values.reduce((max, value) => Math.max(max, value.length), 0);
      const styleForColumn = (config.documentStyle ?? documentStyle) as ReportDocumentStyle;
      const compactWidth = styleForColumn.columnFontOverrides[column.key]?.widthMm;
      return {
        key: column.key,
        label: column.label,
        description: `Kontrol tipografi dan layout untuk kolom ${column.label}.`,
        type: column.type,
        sampleValue,
        headerLength: column.label.length,
        maxValueLength,
        suggestedHeaderFontSize: Number(documentStyle.tableHeaderFontSize.toFixed(2)),
        suggestedBodyFontSize: Number(documentStyle.tableBodyFontSize.toFixed(2)),
        suggestedWidthMm: Number((compactWidth ?? getNaturalColumnWidthMmV2(column, styleForColumn)).toFixed(2)),
        suggestedHeaderAlignment: "center",
        suggestedBodyAlignment: column.type === "name" ? "left" : "center",
      };
    });
  }, [documentStyle]);

  const overallColumnTypographyOptions = useMemo(() => buildColumnTypographyOptions(overallExportConfig), [buildColumnTypographyOptions, overallExportConfig]);

  const rankingTotalItems = overallRankings.length;
  const isShowingAllRankings = pageLimit === -1 || pageLimit >= rankingTotalItems;
  const effectivePageLimit = isShowingAllRankings ? Math.max(rankingTotalItems, 1) : pageLimit;
  const totalRankingPages = isShowingAllRankings
    ? 1
    : Math.max(1, Math.ceil(rankingTotalItems / effectivePageLimit));
  const safeCurrentPage = isShowingAllRankings ? 1 : Math.min(currentPage, totalRankingPages);
  const paginatedRankings = useMemo(() => {
    if (isShowingAllRankings) return overallRankings;
    const startIdx = (safeCurrentPage - 1) * effectivePageLimit;
    return overallRankings.slice(startIdx, startIdx + effectivePageLimit);
  }, [effectivePageLimit, isShowingAllRankings, overallRankings, safeCurrentPage]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) setCurrentPage(safeCurrentPage);
  }, [currentPage, safeCurrentPage]);

  const exportOverallRanking = async ({
    formatId,
    includeSignature: nextIncludeSignature,
    signatureConfig: nextSignatureConfig,
    paperSize: nextPaperSize,
    documentStyle: nextDocumentStyle,
    autoFitOnePage: nextAutoFitOnePage,
    downloadPreviewPng,
  }: {
    formatId: string;
    includeSignature: boolean;
    signatureConfig: typeof signatureConfig;
    paperSize: ReportPaperSize;
    documentStyle?: ReportDocumentStyle;
    autoFitOnePage?: boolean;
    downloadPreviewPng: (quality: "hd" | "4k", fileName?: string, progress?: ExportProgressReporter) => Promise<void>;
  }) => {
    if (!overallExportConfig) return;
    const exportConfig: ExportConfig = {
      ...overallExportConfig,
      includeSignature: nextIncludeSignature && hasSignature,
      signature: buildExportSignature(nextSignatureConfig),
      paperSize: nextPaperSize,
      documentStyle: buildCompactRankingDocumentStyle(
        nextDocumentStyle ?? documentStyle,
        overallExportConfig.columns,
        nextPaperSize,
        overallExportConfig.data,
      ),
      autoFitOnePage: nextAutoFitOnePage ?? autoFitOnePage,
    };
    const fileBaseName = exportConfig.fileBaseName?.replace(/\s+/g, "_") || "Ranking_Keseluruhan";
    const fileName = formatId === "pdf"
      ? `${fileBaseName}.pdf`
      : formatId === "excel"
        ? `${fileBaseName}.xlsx`
        : formatId === "csv"
          ? `${fileBaseName}.csv`
          : `${fileBaseName}.png`;
    await runWithLoader(fileName, async (progress) => {
      if (formatId === "png-hd" || formatId === "png-4k") {
        await downloadPreviewPng(formatId === "png-4k" ? "4k" : "hd", fileName, progress);
        return;
      }
      await exportReportWithProgress(formatId as "pdf" | "excel" | "csv", exportConfig, progress);
    });

    toast({ title: "Ekspor berhasil", description: `File ${RANKING_EXPORT_FORMATS.find((item) => item.id === formatId)?.label || formatId.toUpperCase()} telah diunduh` });
  };

  const podiumEntries = useMemo(() => [
    overallRankings.find((r) => r.rank === 2) ?? null,
    overallRankings.find((r) => r.rank === 1) ?? null,
    overallRankings.find((r) => r.rank === 3) ?? null,
  ], [overallRankings]);

  const hasTopThree = overallRankings.length >= 1;

  return (
    <>
      <div className="app-page">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="animate-fade-in space-y-2">
          {/* Breadcrumb row */}
          <nav aria-label="breadcrumb" className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground overflow-x-auto scrollbar-none">
            <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0">
              <Home className="w-3 h-3" />
              <span className="hidden sm:inline">Beranda</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
            <Link to="/reports" className="hover:text-foreground transition-colors shrink-0 truncate max-w-[80px] sm:max-w-none">
              Laporan
            </Link>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
            <span className="font-medium text-foreground shrink-0">Ranking Siswa</span>
          </nav>

          {/* Title + Semester row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button variant="ghost" size="icon" asChild className="shrink-0 h-8 w-8">
                <Link to="/reports" aria-label="Kembali ke Laporan">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
              </Button>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-[10px] bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
                  <RankingMuridIcon  className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-amber-500" / />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg font-bold text-foreground leading-tight">Ranking Siswa</h1>
                  <p className="text-[11px] sm:text-xs text-muted-foreground truncate">
                    {activeYear ? `${activeYear.name} · ${rankingPeriodShortLabel}` : "Peringkat keseluruhan siswa per kelas"}
                  </p>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <RankingSemesterSelector
                value={semesterFilter}
                onChange={setSemesterFilter}
                showIndicator={false}
              />
            </div>
          </div>
        </div>

        {/* ── Kelas Selection Card ─────────────────────────────────────────── */}
        <Card className="animate-fade-in-up border-border">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 min-w-0">
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Pilih Kelas</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="h-10 text-sm">
                    <School className="w-4 h-4 mr-2 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="— Pilih kelas untuk melihat ranking —" />
                  </SelectTrigger>
                  <SelectContent isEmpty={classes.length === 0} emptyLabel="Tidak ada pilihan Kelas">
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-sm">
                        <span className="font-medium">{cls.name}</span>
                        {cls.student_count ? (
                          <span className="text-muted-foreground ml-2 text-xs">
                            · {cls.student_count} murid
                          </span>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClassId && !gradesLoading && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">{overallRankings.length}</span>
                    <span className="text-[11px] text-muted-foreground">murid</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">{activeSubjectCount}</span>
                    <span className="text-[11px] text-muted-foreground">mapel</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 border border-border">
                    <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-foreground">KKM {classKkm}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Content Area ────────────────────────────────────────────────── */}
        {selectedClassId && (
          <div className="space-y-4">
            {gradesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
              </div>
            ) : subjects.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Belum ada mata pelajaran</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tambahkan mata pelajaran ke kelas ini di halaman Mata Pelajaran terlebih dahulu.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/subjects">
                      Kelola Mata Pelajaran
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* ── Export + Meta Header Card ───────────────────────────── */}
                <Card className="overflow-hidden border-amber-200/60 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/60 via-background to-background dark:from-amber-950/20">
                  <div className="h-[3px] bg-gradient-to-r from-amber-500 to-orange-400 w-full" />
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <RankingMuridIcon  className="h-4 w-4 text-amber-500" / />
                            <span className="text-sm font-bold text-foreground">Ranking Keseluruhan</span>
                          </div>
                          <Badge variant="outline" className="rounded-full text-[11px]">
                            {subjectScopeLabel}
                          </Badge>
                          <Badge
                            variant="secondary"
                            className="rounded-full text-[11px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                          >
                            {rankingPeriodShortLabel}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {subjectScopeDescription} Kelas{" "}
                          <span className="font-semibold text-foreground">{selectedClass?.name}</span>.
                        </p>
                      </div>
                      <UnifiedExportStudio
                        title="Studio Ekspor Ranking Keseluruhan"
                        description="Pilih format ekspor ranking keseluruhan dan kelola signature dari satu panel yang sama."
                        triggerLabel="Ekspor Ranking"
                        triggerClassName="h-9 gap-2 text-xs shrink-0"
                        formats={RANKING_EXPORT_FORMATS}
                        selectedFormat={exportFormat}
                        onFormatChange={(value) => setExportFormat(value as typeof exportFormat)}
                        onExport={exportOverallRanking}
                        includeSignature={includeSignature}
                        onIncludeSignatureChange={setIncludeSignature}
                        signatureConfig={signatureConfig}
                        hasSignature={hasSignature}
                        isLoading={signatureLoading}
                        isSaving={signatureSaving}
                        onSaveSignature={saveSignature}
                        paperSize={paperSize}
                        onPaperSizeChange={setPaperSize}
                        documentStyle={documentStyle}
                        onDocumentStyleChange={setDocumentStyle}
                        autoFitOnePage={autoFitOnePage}
                        onAutoFitOnePageChange={setAutoFitOnePage}
                        showAutoFitPreset
                        columnOptions={overallColumnOptions}
                        onColumnOptionChange={handleOverallColumnOptionChange}
                        columnCount={selectedOverallColumns.length}
                        columnTypographyOptions={overallColumnTypographyOptions}
                        renderPreview={({ previewFormat, draft, setDraft, previewDate, includeSignature: previewIncludeSignature, paperSize: previewPaperSize, documentStyle: previewDocumentStyle, autoFitOnePage: previewAutoFit, liveEditMode, highlightTarget, onHighlightTargetHoverChange, onHighlightTargetSelect }) => {
                          if (!overallExportConfig) return null;
                          return (
                            <ExportPreviewRenderer
                              previewFormat={previewFormat}
                              draft={draft}
                              setDraft={setDraft}
                              previewDate={previewDate}
                              liveEditMode={liveEditMode}
                              highlightTarget={highlightTarget}
                              onHighlightTargetHoverChange={onHighlightTargetHoverChange}
                              onHighlightTargetSelect={onHighlightTargetSelect}
                              previewData={{
                                ...overallExportConfig,
                                includeSignature: previewIncludeSignature && hasSignature,
                                signature: buildExportSignature(draft),
                                paperSize: previewPaperSize,
                                documentStyle: buildCompactRankingDocumentStyle(
                                  previewDocumentStyle ?? documentStyle,
                                  overallExportConfig.columns,
                                  previewPaperSize,
                                  overallExportConfig.data,
                                ),
                                autoFitOnePage: previewAutoFit ?? autoFitOnePage,
                              }}
                            />
                          );
                        }}
                      />
                    </div>
                  </CardHeader>

                  {/* ── Podium Top 3 ───────────────────────────────────────── */}
                  {hasTopThree && overallRankings.length >= 1 && (
                    <CardContent className="pb-5">
                      <div className="flex items-end justify-center gap-2 sm:gap-4 mt-1">
                        {/* Rank 2 */}
                        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[120px]">
                          {podiumEntries[0] ? (
                            <>
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-400 to-gray-300 flex items-center justify-center shadow-md">
                                <Medal className="w-5 h-5 text-white" />
                              </div>
                              <p className="text-[11px] font-semibold text-foreground text-center leading-tight px-1 line-clamp-2 break-words w-full">
                                {podiumEntries[0].student.name}
                              </p>
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                                {formatGrade(podiumEntries[0].overallAverage)}
                              </span>
                              <div className="w-full h-16 bg-gradient-to-b from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-t-lg flex items-center justify-center">
                                <span className="text-lg font-black text-gray-500 dark:text-gray-400">2</span>
                              </div>
                            </>
                          ) : <div className="w-full h-16 bg-muted/30 rounded-t-lg" />}
                        </div>

                        {/* Rank 1 */}
                        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[140px]">
                          {podiumEntries[1] ? (
                            <>
                              <Crown className="w-5 h-5 text-amber-400" />
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-300 flex items-center justify-center shadow-lg shadow-amber-400/30">
                                <RankingMuridIcon  className="w-6 h-6 text-white" / />
                              </div>
                              <p className="text-[11px] font-bold text-foreground text-center leading-tight px-1 line-clamp-2 break-words w-full">
                                {podiumEntries[1].student.name}
                              </p>
                              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                {formatGrade(podiumEntries[1].overallAverage)}
                              </span>
                              <div className="w-full h-24 bg-gradient-to-b from-amber-200 to-amber-100 dark:from-amber-900/60 dark:to-amber-900/30 rounded-t-lg flex items-center justify-center">
                                <span className="text-2xl font-black text-amber-500 dark:text-amber-400">1</span>
                              </div>
                            </>
                          ) : <div className="w-full h-24 bg-muted/30 rounded-t-lg" />}
                        </div>

                        {/* Rank 3 */}
                        <div className="flex flex-col items-center gap-1.5 flex-1 max-w-[120px]">
                          {podiumEntries[2] ? (
                            <>
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-700 to-amber-600 flex items-center justify-center shadow-md">
                                <Award className="w-5 h-5 text-white" />
                              </div>
                              <p className="text-[11px] font-semibold text-foreground text-center leading-tight px-1 line-clamp-2 break-words w-full">
                                {podiumEntries[2].student.name}
                              </p>
                              <span className="text-xs font-bold text-amber-700 dark:text-amber-500 tabular-nums">
                                {formatGrade(podiumEntries[2].overallAverage)}
                              </span>
                              <div className="w-full h-12 bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/20 rounded-t-lg flex items-center justify-center">
                                <span className="text-base font-black text-amber-600 dark:text-amber-500">3</span>
                              </div>
                            </>
                          ) : <div className="w-full h-12 bg-muted/30 rounded-t-lg" />}
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>

                {/* ── Filter Mapel Card ─────────────────────────────────────── */}
                <Card className="border-border">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-sm sm:text-base">Mapel yang Dihitung</CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            Peringkat gabungan satu kelas. {subjectScopeDescription}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          type="button"
                          variant={isAllSubjectsMode || areAllSubjectsSelected ? "default" : "outline"}
                          size="sm"
                          aria-pressed={isAllSubjectsMode || areAllSubjectsSelected}
                          onClick={selectAllSubjects}
                          className="h-8 text-xs px-3 touch-manipulation"
                        >
                          Semua
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label="Hapus semua pilihan mapel"
                          disabled={!hasExplicitSubjectSelection}
                          onClick={clearSubjectSelection}
                          className="h-8 gap-1.5 text-xs px-3 touch-manipulation"
                        >
                          <X className="h-3 w-3" />
                          Hapus Pilihan
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Cakupan ranking saat ini</span>
                      <Badge
                        variant={isAllSubjectsMode ? "secondary" : "outline"}
                        className="shrink-0 rounded-full text-[11px]"
                      >
                        {subjectScopeLabel}
                      </Badge>
                    </div>

                    {/* Mobile: horizontal scroll chips */}
                    <div className="flex gap-2 overflow-x-auto pb-1 sm:hidden scrollbar-none -mx-1 px-1">
                      {subjects.map((subject) => {
                        const isSubjectActive = selectedSubjectIds.includes(subject.id);
                        return (
                          <button
                            key={subject.id}
                            type="button"
                            aria-pressed={isSubjectActive}
                            onClick={() => toggleSubjectSelection(subject.id)}
                            className={cn(
                              "sipena-ranking-subject-button flex-shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12px] font-medium whitespace-nowrap touch-manipulation transition-colors",
                              isSubjectActive
                                ? "bg-primary border-primary -foreground shadow-sm"
                                : "bg-background border-border text-foreground hover:border-primary/50",
                            )}
                          >
                            {isSubjectActive && <Check className="w-3 h-3 shrink-0" />}
                            <span>{subject.name}</span>
                            <span className={cn(
                              "text-[10px] opacity-75",
                              isSubjectActive ? "-foreground" : "text-muted-foreground"
                            )}>
                              {subject.kkm}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Desktop: grid */}
                    <div className="hidden sm:grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {subjects.map((subject) => {
                        const isSubjectActive = selectedSubjectIds.includes(subject.id);
                        return (
                          <Button
                            key={subject.id}
                            type="button"
                            variant={isSubjectActive ? "default" : "outline"}
                            aria-pressed={isSubjectActive}
                            data-selected={isSubjectActive}
                            onClick={() => toggleSubjectSelection(subject.id)}
                            className={cn(
                              "sipena-ranking-subject-button h-auto min-h-[44px] justify-between gap-3 whitespace-normal break-words px-3 py-2 text-left touch-manipulation",
                              isSubjectActive
                                ? "border-primary bg-primary -foreground shadow-sm"
                                : "border-border bg-background text-foreground hover:border-primary/40",
                            )}
                          >
                            <span className="min-w-0 flex-1 break-words text-sm font-semibold">{subject.name}</span>
                            <span className={cn(
                              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                              isSubjectActive
                                ? "border-primary-foreground/30 bg-primary-foreground/15 -foreground"
                                : "border-border bg-muted text-muted-foreground",
                            )}>
                              {isSubjectActive && <Check className="h-3 w-3" />}
                              KKM {subject.kkm}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* ── Ranking Table ────────────────────────────────────────── */}
                <Card className="border-border">
                  <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 " />
                          Daftar Ranking Lengkap
                        </CardTitle>
                        <CardDescription className="text-[10px] sm:text-xs mt-0.5">
                          {isAllSubjectsMode
                            ? `Semua ${subjects.length} mata pelajaran`
                            : `${selectedSubjectIds.length} dari ${subjects.length} mata pelajaran dipilih`}
                          {" · "}
                          <span className="font-medium text-foreground">{overallRankings.length} murid</span>
                          {" · KKM "}
                          <span className="font-medium text-foreground">{classKkm}</span>
                        </CardDescription>
                      </div>
                      {overallRankings.length > 0 && (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400" />
                            Lulus KKM
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400" />
                            Belum KKM
                          </div>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 sm:px-6">
                    {/* Mobile list view */}
                    <div className="divide-y sm:hidden">
                      {paginatedRankings.map((ranking) => {
                        const isPassing = ranking.overallAverage >= classKkm;
                        const isTop3 = ranking.rank <= 3;
                        return (
                          <div
                            key={ranking.student.id}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 transition-colors",
                              isTop3 && "bg-amber-50/60 dark:bg-amber-950/20"
                            )}
                          >
                            <div className="shrink-0 w-10 flex items-center justify-start">{getRankBadge(ranking.rank)}</div>
                            <div className="min-w-0 flex-1">
                              <p className={cn(
                                "whitespace-normal break-words text-sm leading-snug",
                                isTop3 ? "font-bold text-foreground" : "font-semibold text-foreground"
                              )}>
                                {ranking.student.name}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                NISN {ranking.student.nisn || "—"}
                              </p>
                            </div>
                            <span className={cn(
                              "inline-flex min-w-[3rem] shrink-0 justify-center rounded-full border px-2 py-1 text-xs font-bold tabular-nums",
                              isPassing
                                ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                                : "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                            )}>
                              {formatGrade(ranking.overallAverage)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden overflow-x-auto sm:block">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[72px] text-[11px] font-semibold">Rank</TableHead>
                            <TableHead className="text-[11px] font-semibold">Nama Siswa</TableHead>
                            <TableHead className="text-[11px] font-semibold hidden md:table-cell">NISN</TableHead>
                            <TableHead className="text-right text-[11px] font-semibold">Rata-rata</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedRankings.map((ranking) => {
                            const isPassing = ranking.overallAverage >= classKkm;
                            const isTop3 = ranking.rank <= 3;
                            return (
                              <TableRow
                                key={ranking.student.id}
                                className={cn(
                                  "transition-colors",
                                  isTop3
                                    ? "bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
                                    : "hover:bg-primary/5"
                                )}
                              >
                                <TableCell className="py-2.5">
                                  {getRankBadge(ranking.rank)}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "max-w-[180px] whitespace-normal break-words py-2.5 sm:max-w-none",
                                    isTop3 ? "text-sm font-bold" : "text-sm font-medium"
                                  )}
                                >
                                  {ranking.student.name}
                                </TableCell>
                                <TableCell className="py-2.5 text-xs text-muted-foreground hidden md:table-cell">
                                  {ranking.student.nisn || "—"}
                                </TableCell>
                                <TableCell className="text-right py-2.5">
                                  <span className={cn(
                                    "inline-flex min-w-[3rem] justify-center rounded-full border px-2.5 py-1 text-xs font-bold tabular-nums",
                                    isPassing
                                      ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                                      : "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                                  )}>
                                    {formatGrade(ranking.overallAverage)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    <PaginationControls
                      currentPage={safeCurrentPage}
                      totalPages={totalRankingPages}
                      totalItems={rankingTotalItems}
                      limit={pageLimit}
                      onPageChange={(p) => setCurrentPage(p)}
                      onLimitChange={(l) => { setPageLimit(l); setCurrentPage(1); }}
                      className="border-t border-border/30"
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
      {exportOverlay}
    </>
  );
}
