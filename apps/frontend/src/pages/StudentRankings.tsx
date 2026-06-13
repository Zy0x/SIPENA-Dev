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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useExportLoader } from "@/components/ExportLoaderOverlay";
import { useSignatureSettings } from "@/hooks/useSignatureSettings";
import { UnifiedExportStudio, type ExportColumnOption, type ExportColumnTypographyOption, type ExportStudioFormatOption } from "@/components/export/UnifiedExportStudio";
import { ExportPreviewRenderer } from "@/components/export/ExportPreviewRenderer";
import { buildRankingExportColumns, getDefaultSelectedColumns, buildRankingExportData } from "@/lib/rankingExportColumns";
import { getNaturalColumnWidthMmV2, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import { exportReport, type ExportColumn, type ExportConfig, type ReportPaperSize } from "@/lib/exportReports";
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
  const { showLoader, overlay: exportOverlay } = useExportLoader();
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);

  // Export column selection state
  const [exportColumns, setExportColumns] = useState<RankingColumn[]>([]);
  const [selectedExportColumnIds, setSelectedExportColumnIds] = useState<string[]>([]);

  // Initialize export columns when subjects change
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

  // Responsive rank badge with dynamic text sizing
  const getRankBadge = (rank: number) => {
    const baseClasses = "shrink-0 whitespace-nowrap";
    
    if (rank === 1) {
      return (
        <Badge className={cn(baseClasses, "bg-gradient-to-r from-amber-500 to-yellow-400 text-white gap-1 shadow-lg shadow-amber-500/30 text-[10px] sm:text-xs px-1.5 sm:px-2.5")}>
          <Crown className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
          <span className="truncate">Juara 1</span>
        </Badge>
      );
    }
    if (rank === 2) {
      return (
        <Badge className={cn(baseClasses, "bg-gradient-to-r from-gray-400 to-gray-300 text-gray-800 gap-1 shadow-lg shadow-gray-400/30 text-[10px] sm:text-xs px-1.5 sm:px-2.5")}>
          <Medal className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
          <span className="truncate">Juara 2</span>
        </Badge>
      );
    }
    if (rank === 3) {
      return (
        <Badge className={cn(baseClasses, "bg-gradient-to-r from-amber-700 to-amber-600 text-white gap-1 shadow-lg shadow-amber-700/30 text-[10px] sm:text-xs px-1.5 sm:px-2.5")}>
          <Award className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
          <span className="truncate">Juara 3</span>
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className={cn(baseClasses, "text-[10px] sm:text-xs px-1.5 sm:px-2")}>
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
    label: column.label,
    type: mapRankingColumnType(column),
  })), [mapRankingColumnType, selectedOverallColumns]);

  const compactRankingDocumentStyle = useMemo(
    () => buildCompactRankingDocumentStyle(documentStyle, overallExportColumns, paperSize),
    [documentStyle, overallExportColumns, paperSize],
  );

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
    compactRankingDocumentStyle,
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
        suggestedBodyAlignment: column.type === "name" || column.type === "status" ? "left" : "center",
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
    downloadPreviewPng: (quality: "hd" | "4k", fileName?: string) => Promise<void>;
  }) => {
    if (!overallExportConfig) return;
    const exportConfig: ExportConfig = {
      ...overallExportConfig,
      includeSignature: nextIncludeSignature && hasSignature,
      signature: buildExportSignature(nextSignatureConfig),
      paperSize: nextPaperSize,
      documentStyle: buildCompactRankingDocumentStyle(nextDocumentStyle ?? documentStyle, overallExportConfig.columns, nextPaperSize),
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
    await showLoader(fileName);

    if (formatId === "png-hd" || formatId === "png-4k") {
      await downloadPreviewPng(formatId === "png-4k" ? "4k" : "hd", fileName);
    } else {
      exportReport(formatId as "pdf" | "excel" | "csv", exportConfig);
    }

    toast({ title: "Ekspor berhasil", description: `File ${RANKING_EXPORT_FORMATS.find((item) => item.id === formatId)?.label || formatId.toUpperCase()} telah diunduh` });
  };

  return (
    <>
      <div className="app-page">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Button variant="ghost" size="icon" asChild className="shrink-0 h-8 w-8 sm:h-9 sm:w-9">
              <Link to="/reports">
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-foreground truncate">
                Ranking Siswa
              </h1>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground truncate">
                Peringkat keseluruhan berdasarkan mapel yang dipilih
              </p>
            </div>
          </div>
          
          {/* Semester Selector - Responsive */}
          <div className="flex justify-end sm:justify-start shrink-0">
            <RankingSemesterSelector
              value={semesterFilter}
              onChange={setSemesterFilter}
              showIndicator={false}
            />
          </div>
        </div>

        {/* Active Period Indicator - Responsive */}
        {activeYear && (
          <div className="flex items-center gap-2 text-xs sm:text-sm animate-fade-in overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary/5 border border-primary/10 shrink-0">
              {isCombinedView ? (
                <Layers className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
              ) : (
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-primary shrink-0" />
              )}
              <span className="text-muted-foreground text-[10px] sm:text-xs whitespace-nowrap">Data:</span>
              <Badge variant="secondary" className="font-medium text-[10px] sm:text-xs whitespace-nowrap">
                {activeYear.name} • {rankingPeriodShortLabel}
              </Badge>
            </div>
          </div>
        )}

        {/* Class Selection */}
        <Card className="animate-fade-in-up">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <Label className="text-xs mb-1.5 block">Pilih Kelas</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="h-9 sm:h-10 text-sm">
                    <School className="w-4 h-4 mr-2 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Pilih kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-sm">
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
            </div>
          </CardContent>
        </Card>

        {selectedClassId && (
          <div className="space-y-4">
            {gradesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : subjects.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>Belum ada mata pelajaran di kelas ini</p>
                </CardContent>
              </Card>
            ) : (
              <>
            <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-primary/5 via-background to-background">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1.5 rounded-full">
                        <Trophy className="h-3.5 w-3.5 text-primary" />
                        Ranking Keseluruhan
                      </Badge>
                      <Badge variant="outline" className="rounded-full">
                        {subjectScopeLabel}
                      </Badge>
                    </div>
                    <CardTitle className="text-base sm:text-lg">Peringkat gabungan satu kelas</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {subjectScopeDescription} Kelas {selectedClass?.name}.
                    </CardDescription>
                  </div>
                  <UnifiedExportStudio
                    title="Studio Ekspor Ranking Keseluruhan"
                    description="Pilih format ekspor ranking keseluruhan dan kelola signature dari satu panel yang sama."
                    triggerLabel="Ekspor"
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
                            documentStyle: buildCompactRankingDocumentStyle(previewDocumentStyle ?? documentStyle, overallExportConfig.columns, previewPaperSize),
                            autoFitOnePage: previewAutoFit ?? autoFitOnePage,
                          }}
                        />
                      );
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border bg-background/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Siswa</p>
                    <p className="text-lg font-bold">{overallRankings.length}</p>
                  </div>
                  <div className="rounded-lg border bg-background/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Mapel Aktif</p>
                    <p className="text-lg font-bold">{activeSubjectCount}</p>
                  </div>
                  <div className="rounded-lg border bg-background/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">KKM Kelas</p>
                    <p className="text-lg font-bold">{classKkm}</p>
                  </div>
                  <div className="rounded-lg border bg-background/80 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Periode</p>
                    <p className="truncate text-sm font-semibold">{rankingPeriodShortLabel}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
              {/* Subject Filter */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-sm sm:text-base">Mapel yang Dihitung</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        {subjectScopeDescription}
                      </CardDescription>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                      <Button
                        type="button"
                        variant={isAllSubjectsMode || areAllSubjectsSelected ? "default" : "outline"}
                        size="sm"
                        aria-pressed={isAllSubjectsMode || areAllSubjectsSelected}
                        onClick={selectAllSubjects}
                        className="h-9 text-xs touch-manipulation"
                      >
                        Semua Mapel
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label="Hapus semua pilihan mapel"
                        disabled={!hasExplicitSubjectSelection}
                        onClick={clearSubjectSelection}
                        className="h-9 gap-1.5 text-xs touch-manipulation"
                      >
                        <X className="h-3.5 w-3.5" />
                        Hapus Pilihan
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Cakupan ranking</span>
                    <Badge variant={isAllSubjectsMode ? "secondary" : "outline"} className="shrink-0 rounded-full">
                      {subjectScopeLabel}
                    </Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                            "sipena-ranking-subject-button h-auto min-h-12 justify-between gap-3 whitespace-normal break-words px-3 py-2 text-left touch-manipulation",
                            isSubjectActive
                              ? "border-primary bg-primary text-primary-foreground shadow-sm"
                              : "border-border bg-background text-foreground hover:border-primary/40",
                          )}
                        >
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold">{subject.name}</span>
                          <span className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                            isSubjectActive
                              ? "border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground"
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

              {/* Overall Ranking Table with Pagination */}
              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                        Ranking Keseluruhan
                      </CardTitle>
                      <CardDescription className="text-[10px] sm:text-xs">
                        {isAllSubjectsMode
                          ? "Semua mata pelajaran"
                          : `${selectedSubjectIds.length} mata pelajaran dipilih`}
                        {" • "}{overallRankings.length} siswa • KKM Kelas: {classKkm}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                  {gradesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <div className="divide-y sm:hidden">
                        {paginatedRankings.map((ranking) => {
                          const isPassing = ranking.overallAverage >= classKkm;
                          return (
                            <div key={ranking.student.id} className="flex items-center gap-3 px-4 py-3">
                              <div className="shrink-0">{getRankBadge(ranking.rank)}</div>
                              <div className="min-w-0 flex-1">
                                <p className="whitespace-normal break-words text-sm font-semibold leading-snug">
                                  {ranking.student.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  NISN {ranking.student.nisn || "-"}
                                </p>
                              </div>
                              <span className={cn(
                                "inline-flex min-w-14 shrink-0 justify-center rounded-full border px-2 py-1 text-xs font-bold",
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

                      <div className="hidden overflow-x-auto sm:block">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-16 text-[10px] sm:text-xs">Rank</TableHead>
                              <TableHead className="text-[10px] sm:text-xs">Nama</TableHead>
                              <TableHead className="text-[10px] sm:text-xs hidden sm:table-cell">NISN</TableHead>
                              <TableHead className="text-right text-[10px] sm:text-xs">Rata-rata</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedRankings.map((ranking) => (
                              <TableRow key={ranking.student.id} className="hover:bg-primary/5">
                                <TableCell className="py-2 sm:py-3">
                                  {getRankBadge(ranking.rank)}
                                </TableCell>
                                <TableCell className="max-w-[160px] whitespace-normal break-words py-2 text-xs font-semibold sm:max-w-none sm:py-3 sm:text-sm">
                                  {ranking.student.name}
                                </TableCell>
                                <TableCell className="text-xs sm:text-sm py-2 sm:py-3 hidden sm:table-cell">
                                  {ranking.student.nisn}
                                </TableCell>
                                <TableCell className="text-right py-2 sm:py-3">
                                  <span className={cn(
                                    "inline-flex min-w-14 justify-center rounded-full border px-2 py-1 text-xs font-bold sm:text-sm",
                                    ranking.overallAverage >= classKkm
                                      ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                                      : "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
                                  )}>
                                    {formatGrade(ranking.overallAverage)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination Controls */}
                      <PaginationControls
                        currentPage={safeCurrentPage}
                        totalPages={totalRankingPages}
                        totalItems={rankingTotalItems}
                        limit={pageLimit}
                        onPageChange={(p) => setCurrentPage(p)}
                        onLimitChange={(l) => { setPageLimit(l); setCurrentPage(1); }}
                        className="border-t border-border/30"
                      />
                    </>
                  )}
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
