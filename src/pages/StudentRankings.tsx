import { useState, useMemo, useRef, useEffect, useCallback } from "react";

import { PaginationControls } from "@/components/rankings/PaginationControls";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Crown,
  TrendingUp,
  Star,
  ArrowLeft,
  School,
  ChevronLeft,
  ChevronRight,
  Users,
  Sparkles,
  Loader2,
  Play,
  Pause,
  Calendar,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useExportLoader } from "@/components/ExportLoaderOverlay";
import { useSignatureSettings } from "@/hooks/useSignatureSettings";
import { UnifiedExportStudio, type ExportColumnOption, type ExportColumnTypographyOption, type ExportStudioFormatOption } from "@/components/export/UnifiedExportStudio";
import { ExportPreviewRenderer } from "@/components/export/ExportPreviewRenderer";
import { buildRankingExportColumns, getDefaultSelectedColumns, buildRankingExportData } from "@/lib/rankingExportColumns";
import { createDefaultReportDocumentStyle, getNaturalColumnWidthMmV2, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import { exportReport, type ExportColumn, type ExportConfig, type ReportPaperSize } from "@/lib/exportReports";
import type { RankingColumn } from "@/components/rankings/RankingColumnSelector";

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
  
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel" | "csv" | "png-hd" | "png-4k">("pdf");
  const [paperSize, setPaperSize] = useState<ReportPaperSize>("a4");
  const [documentStyle, setDocumentStyle] = useState<ReportDocumentStyle>(() => createDefaultReportDocumentStyle());
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
  const { subjects, overallRankings, getSubjectRanking, isLoading: gradesLoading } = useStudentRankings({
    classId: selectedClassId,
    semesterFilter,
    overallSubjectIds: selectedSubjectIds,
  });

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const classKkm = selectedClass?.class_kkm ?? 75;

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
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const selectAllSubjects = () => {
    setSelectedSubjectIds(subjects.map((s) => s.id));
  };

  const clearSubjectSelection = () => {
    setSelectedSubjectIds([]);
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
    if (value === 0) return "-";
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

  const buildSubjectExportConfig = useCallback((
    subjectId: string,
    overrides?: {
      paperSize?: ReportPaperSize;
      documentStyle?: ReportDocumentStyle;
      autoFitOnePage?: boolean;
      includeSignature?: boolean;
      signatureConfig?: typeof signatureConfig;
    },
  ): ExportConfig | null => {
    const subject = subjects.find((item) => item.id === subjectId);
    if (!subject || !selectedClass) return null;

    const rankings = getSubjectRanking(subjectId);
    const columns: ExportColumn[] = [
      { key: "Peringkat", label: "Peringkat", type: "index" },
      { key: "Nama", label: "Nama", type: "name" },
      { key: "NISN", label: "NISN", type: "nisn" },
      { key: "Nilai Rata-rata", label: "Nilai Rata-Rata", type: "grandAvg" },
      { key: "Status", label: "Status", type: "status" },
    ];

    const data = rankings.map((ranking) => ({
      Peringkat: ranking.rank,
      Nama: ranking.student.name,
      NISN: ranking.student.nisn,
      "Nilai Rata-rata": formatGrade(ranking.overallAverage),
      Status: ranking.overallAverage >= subject.kkm ? "Lulus" : "Belum Lulus",
    }));

    return {
      className: selectedClass.name,
      subjectName: subject.name,
      kkm: subject.kkm,
      periodLabel: isCombinedView ? "Semua Semester" : `Semester ${semesterFilter}`,
      isCombinedView,
      columns,
      headerGroups: [{ label: "Ranking", colSpan: columns.length }],
      chapterGroups: [],
      data,
      dateStr: new Date().toLocaleDateString("id-ID"),
      studentCount: rankings.length,
      chapterCount: 0,
      assignmentCount: 0,
      includeSignature: overrides?.includeSignature ?? (includeSignature && hasSignature),
      signature: overrides?.signatureConfig ? buildExportSignature(overrides.signatureConfig) : buildExportSignature(signatureConfig),
      paperSize: overrides?.paperSize ?? paperSize,
      documentStyle: overrides?.documentStyle ?? documentStyle,
      autoFitOnePage: overrides?.autoFitOnePage ?? autoFitOnePage,
      documentTitle: `RANKING ${subject.name.toUpperCase()}`,
      continuationTitle: `Lanjutan Ranking ${subject.name}`,
      metaGroups: buildMetaGroups({
        left: [
          { label: "Kelas", value: selectedClass.name },
          { label: "Mata Pelajaran", value: subject.name },
        ],
        center: [
          { label: "KKM", value: subject.kkm },
          { label: "Periode", value: isCombinedView ? "Semua Semester" : `Semester ${semesterFilter}` },
        ],
        right: [
          { label: "Tanggal", value: new Date().toLocaleDateString("id-ID") },
          { label: "Jumlah Siswa", value: rankings.length },
        ],
      }),
      fileBaseName: `Ranking_${selectedClass.name}_${subject.name}`,
    };
  }, [
    autoFitOnePage,
    buildExportSignature,
    buildMetaGroups,
    documentStyle,
    getSubjectRanking,
    hasSignature,
    includeSignature,
    isCombinedView,
    paperSize,
    selectedClass,
    semesterFilter,
    signatureConfig,
    subjects,
  ]);

  const selectedOverallColumns = useMemo(() => exportColumns.filter((column) => selectedExportColumnIds.includes(column.id)), [exportColumns, selectedExportColumnIds]);

  const overallExportConfig = useMemo<ExportConfig | null>(() => {
    if (!selectedClass) return null;
    const subjectsToUse = selectedSubjectIds.length > 0
      ? subjects.filter((subject) => selectedSubjectIds.includes(subject.id))
      : subjects;
    const columns: ExportColumn[] = selectedOverallColumns.map((column) => ({
      key: column.key,
      label: column.label,
      type: mapRankingColumnType(column),
    }));
    const data = buildRankingExportData(
      overallRankings,
      exportColumns,
      selectedExportColumnIds,
      classKkm,
      formatGrade,
    );

    return {
      className: selectedClass.name,
      subjectName: "Ranking Keseluruhan",
      kkm: classKkm,
      periodLabel: isCombinedView ? "Semua Semester" : `Semester ${semesterFilter}`,
      isCombinedView,
      columns,
      headerGroups: [{ label: "Ranking Keseluruhan", colSpan: columns.length }],
      chapterGroups: [],
      data,
      dateStr: new Date().toLocaleDateString("id-ID"),
      studentCount: overallRankings.length,
      chapterCount: 0,
      assignmentCount: subjectsToUse.length,
      includeSignature: includeSignature && hasSignature,
      signature: buildExportSignature(signatureConfig),
      paperSize,
      documentStyle,
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
          { label: "Periode", value: isCombinedView ? "Semua Semester" : `Semester ${semesterFilter}` },
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
    mapRankingColumnType,
    overallRankings,
    paperSize,
    selectedClass,
    selectedExportColumnIds,
    selectedOverallColumns,
    selectedSubjectIds,
    semesterFilter,
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
        suggestedWidthMm: Number(getNaturalColumnWidthMmV2(column, documentStyle).toFixed(2)),
        suggestedHeaderAlignment: "center",
        suggestedBodyAlignment: column.type === "name" || column.type === "nisn" ? "left" : "center",
      };
    });
  }, [documentStyle]);

  const overallColumnTypographyOptions = useMemo(() => buildColumnTypographyOptions(overallExportConfig), [buildColumnTypographyOptions, overallExportConfig]);

  // Export functions
  const exportSubjectRanking = async (
    subjectId: string,
    {
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
    },
  ) => {
    const exportConfig = buildSubjectExportConfig(subjectId, {
      includeSignature: nextIncludeSignature && hasSignature,
      signatureConfig: nextSignatureConfig,
      paperSize: nextPaperSize,
      documentStyle: nextDocumentStyle ?? documentStyle,
      autoFitOnePage: nextAutoFitOnePage ?? autoFitOnePage,
    });
    if (!exportConfig) return;
    const baseFileName = exportConfig.fileBaseName?.replace(/\s+/g, "_") || "Ranking";
    const fileName = formatId === "pdf"
      ? `${baseFileName}.pdf`
      : formatId === "excel"
        ? `${baseFileName}.xlsx`
        : formatId === "csv"
          ? `${baseFileName}.csv`
          : `${baseFileName}.png`;
    await showLoader(fileName);

    if (formatId === "png-hd" || formatId === "png-4k") {
      await downloadPreviewPng(formatId === "png-4k" ? "4k" : "hd", fileName);
    } else {
      exportReport(formatId as "pdf" | "excel" | "csv", exportConfig);
    }

    toast({ title: "Ekspor berhasil", description: `File ${RANKING_EXPORT_FORMATS.find((item) => item.id === formatId)?.label || formatId.toUpperCase()} telah diunduh` });
  };

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
      documentStyle: nextDocumentStyle ?? documentStyle,
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

  // Enhanced Subject Ranking Carousel Component with improved touch/mouse scroll
  const SubjectRankingCarousel = ({ subjectId, subject }: { subjectId: string; subject: { id: string; name: string; kkm: number } }) => {
    const rankings = useMemo(() => getSubjectRanking(subjectId), [getSubjectRanking, subjectId]);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartX = useRef(0);
    const scrollStartX = useRef(0);
    const lastMoveX = useRef(0);
    const lastMoveTime = useRef(0);
    const velocityRef = useRef(0);
    const animationFrameRef = useRef<number | null>(null);
    const isHorizontalSwipe = useRef<boolean | null>(null);
    
    // Auto-scroll animation
    useEffect(() => {
      if (!isPlaying || rankings.length <= 3 || isDragging) return;
      
      const interval = setInterval(() => {
        setHighlightedIndex(prev => (prev + 1) % rankings.length);
      }, 2500);
      
      return () => clearInterval(interval);
    }, [isPlaying, rankings.length, isDragging]);
    
    // Scroll to highlighted card
    useEffect(() => {
      if (!containerRef.current || isDragging) return;
      
      const container = containerRef.current;
      const cardWidth = window.innerWidth < 640 ? 150 : window.innerWidth < 768 ? 170 : 190;
      const gap = 12;
      const containerWidth = container.offsetWidth;
      const scrollPosition = (highlightedIndex * (cardWidth + gap)) - (containerWidth / 2) + (cardWidth / 2);
      
      container.scrollTo({
        left: Math.max(0, scrollPosition),
        behavior: "smooth"
      });
    }, [highlightedIndex, isDragging]);

    // Momentum scrolling
    const applyMomentum = useCallback(() => {
      if (!containerRef.current || Math.abs(velocityRef.current) < 0.5) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        return;
      }
      
      containerRef.current.scrollLeft += velocityRef.current;
      velocityRef.current *= 0.92; // Friction
      animationFrameRef.current = requestAnimationFrame(applyMomentum);
    }, []);

    // Update highlighted index based on scroll position
    const updateHighlightFromScroll = useCallback(() => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const cardWidth = window.innerWidth < 640 ? 150 : window.innerWidth < 768 ? 170 : 190;
      const gap = 12;
      const containerCenter = container.scrollLeft + container.offsetWidth / 2;
      const index = Math.round(containerCenter / (cardWidth + gap));
      const clampedIndex = Math.max(0, Math.min(rankings.length - 1, index));
      
      if (clampedIndex !== highlightedIndex) {
        setHighlightedIndex(clampedIndex);
      }
    }, [rankings.length, highlightedIndex]);

    // Touch handlers - improved to prevent page scroll blocking
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      const touch = e.touches[0];
      dragStartX.current = touch.clientX;
      scrollStartX.current = containerRef.current?.scrollLeft || 0;
      lastMoveX.current = touch.clientX;
      lastMoveTime.current = Date.now();
      velocityRef.current = 0;
      isHorizontalSwipe.current = null; // Reset swipe direction detection
      
      setIsDragging(true);
      setIsPlaying(false);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const touch = e.touches[0];
      const deltaX = dragStartX.current - touch.clientX;
      const deltaY = Math.abs(e.touches[0].clientY - (e.touches[0].clientY || 0));
      
      // Determine swipe direction on first significant move
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 10 || deltaY > 10) {
          isHorizontalSwipe.current = Math.abs(deltaX) > deltaY;
        }
      }
      
      // Only prevent default and handle horizontal scrolling if it's a horizontal swipe
      if (isHorizontalSwipe.current === true) {
        e.preventDefault();
        e.stopPropagation();
        
        const now = Date.now();
        const dt = now - lastMoveTime.current;
        
        if (dt > 0) {
          velocityRef.current = (lastMoveX.current - touch.clientX) / dt * 12;
        }
        
        containerRef.current.scrollLeft = scrollStartX.current + deltaX;
        lastMoveX.current = touch.clientX;
        lastMoveTime.current = now;
        
        // Update highlight during drag
        updateHighlightFromScroll();
      }
    }, [isDragging, updateHighlightFromScroll]);

    const handleTouchEnd = useCallback(() => {
      if (!isDragging) return;
      
      setIsDragging(false);
      isHorizontalSwipe.current = null;
      
      // Apply momentum scrolling only if it was a horizontal swipe
      if (Math.abs(velocityRef.current) > 1) {
        applyMomentum();
      }
      
      // Resume auto-play after 4 seconds
      setTimeout(() => setIsPlaying(true), 4000);
    }, [isDragging, applyMomentum]);

    // Mouse handlers for desktop
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      setIsDragging(true);
      setIsPlaying(false);
      dragStartX.current = e.clientX;
      scrollStartX.current = containerRef.current?.scrollLeft || 0;
      lastMoveX.current = e.clientX;
      lastMoveTime.current = Date.now();
      velocityRef.current = 0;
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const deltaX = dragStartX.current - e.clientX;
      const now = Date.now();
      const dt = now - lastMoveTime.current;
      
      if (dt > 0) {
        velocityRef.current = (lastMoveX.current - e.clientX) / dt * 12;
      }
      
      containerRef.current.scrollLeft = scrollStartX.current + deltaX;
      lastMoveX.current = e.clientX;
      lastMoveTime.current = now;
      
      // Update highlight during drag
      updateHighlightFromScroll();
    }, [isDragging, updateHighlightFromScroll]);

    const handleMouseUp = useCallback(() => {
      if (!isDragging) return;
      setIsDragging(false);
      
      // Apply momentum scrolling
      if (Math.abs(velocityRef.current) > 1) {
        applyMomentum();
      }
      
      // Resume auto-play after 4 seconds
      setTimeout(() => setIsPlaying(true), 4000);
    }, [isDragging, applyMomentum]);

    // Mouse wheel support for desktop
    const handleWheel = useCallback((e: React.WheelEvent) => {
      if (!containerRef.current) return;
      
      // Only handle horizontal scroll if wheel is primarily horizontal or shift is held
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
        e.preventDefault();
        setIsPlaying(false);
        
        containerRef.current.scrollBy({
          left: e.deltaX || e.deltaY,
          behavior: "auto"
        });
        
        updateHighlightFromScroll();
        setTimeout(() => setIsPlaying(true), 3000);
      }
      // Let vertical scroll pass through to page
    }, [updateHighlightFromScroll]);

    if (rankings.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Belum ada data nilai</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {/* Controls */}
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-muted-foreground">
            {rankings.length} siswa • Geser untuk melihat
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className="gap-1 h-7 text-xs"
          >
            {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isPlaying ? "Pause" : "Play"}
          </Button>
        </div>

        {/* Carousel Container - Fixed touch handling */}
        <div 
          ref={containerRef}
          className={cn(
            "flex gap-3 overflow-x-auto scrollbar-hide py-6 px-4",
            "select-none",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ 
            scrollSnapType: isDragging ? "none" : "x mandatory",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {rankings.map((ranking, idx) => {
            const isTop3 = ranking.rank <= 3;
            const isHighlighted = idx === highlightedIndex;
            
            return (
              <motion.div
                key={ranking.student.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  scale: isHighlighted ? 1.05 : 1,
                  y: isHighlighted ? -8 : 0,
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 350, 
                  damping: 25 
                }}
                onClick={() => {
                  setHighlightedIndex(idx);
                  setIsPlaying(false);
                  setTimeout(() => setIsPlaying(true), 5000);
                }}
                className={cn(
                  "flex-shrink-0 w-[140px] sm:w-[160px] md:w-[180px] p-4 sm:p-5 rounded-xl border transition-all duration-300 select-none relative",
                  "scroll-snap-align-center",
                  isTop3 
                    ? "bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-orange-500/10 border-amber-500/30"
                    : "bg-card border-border hover:border-primary/30",
                  isHighlighted && "ring-2 ring-primary shadow-xl shadow-primary/20 z-10"
                )}
                style={{ scrollSnapAlign: "center" }}
              >
                {/* Rank Badge */}
                <div className="flex justify-center mb-3">
                  {ranking.rank === 1 && (
                    <motion.div
                      animate={isHighlighted ? { 
                        scale: [1, 1.1, 1],
                        rotate: [0, -5, 5, 0]
                      } : {}}
                      transition={{ duration: 0.5, repeat: isHighlighted ? Infinity : 0, repeatDelay: 1 }}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/50"
                    >
                      <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </motion.div>
                  )}
                  {ranking.rank === 2 && (
                    <motion.div
                      animate={isHighlighted ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.5, repeat: isHighlighted ? Infinity : 0, repeatDelay: 1 }}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center shadow-lg"
                    >
                      <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </motion.div>
                  )}
                  {ranking.rank === 3 && (
                    <motion.div
                      animate={isHighlighted ? { scale: [1, 1.05, 1] } : {}}
                      transition={{ duration: 0.5, repeat: isHighlighted ? Infinity : 0, repeatDelay: 1 }}
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center shadow-lg"
                    >
                      <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </motion.div>
                  )}
                  {ranking.rank > 3 && (
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-muted flex items-center justify-center text-xs sm:text-sm font-bold">
                      {ranking.rank}
                    </div>
                  )}
                </div>

                {/* Student Info */}
                <div className="text-center space-y-1">
                  <p className="font-semibold text-foreground text-xs sm:text-sm truncate px-1">
                    {ranking.student.name}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {ranking.student.nisn}
                  </p>
                  <div className={cn(
                    "text-lg sm:text-xl font-bold mt-2",
                    ranking.overallAverage >= subject.kkm ? "text-grade-pass" : "text-grade-fail"
                  )}>
                    {formatGrade(ranking.overallAverage)}
                  </div>
                </div>

                {/* Sparkle effect for top 3 */}
                {isTop3 && isHighlighted && (
                  <motion.div
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute top-2 right-2"
                  >
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1 pt-1">
          {rankings.slice(0, Math.min(10, rankings.length)).map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setHighlightedIndex(idx);
                setIsPlaying(false);
                setTimeout(() => setIsPlaying(true), 5000);
              }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                idx === highlightedIndex 
                  ? "bg-primary w-4" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
          {rankings.length > 10 && (
            <span className="text-[10px] text-muted-foreground ml-1">
              +{rankings.length - 10}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="p-3 sm:p-4 lg:p-8 max-w-7xl mx-auto space-y-3 sm:space-y-4 lg:space-y-6">
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
                Peringkat per mapel dan keseluruhan
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
                {activeYear.name} • {isCombinedView ? "Semua Semester" : `Sem ${semesterFilter}`}
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
          <Tabs defaultValue="subject" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 h-9 sm:h-10">
              <TabsTrigger value="subject" className="text-xs sm:text-sm gap-1">
                <Star className="w-3.5 h-3.5" />
                Per Mapel
              </TabsTrigger>
              <TabsTrigger value="overall" className="text-xs sm:text-sm gap-1">
                <Trophy className="w-3.5 h-3.5" />
                Keseluruhan
              </TabsTrigger>
            </TabsList>

            {/* Per Subject Tab */}
            <TabsContent value="subject" className="space-y-4">
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
                <div className="grid gap-4">
                  {subjects.map((subject) => (
                    <Card key={subject.id} className="overflow-hidden">
                      <CardHeader className="pb-2 sm:pb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="min-w-0">
                            <CardTitle className="text-sm sm:text-base truncate">
                              {subject.name}
                            </CardTitle>
                            <CardDescription className="text-[10px] sm:text-xs">
                              KKM: {subject.kkm}
                            </CardDescription>
                          </div>
                          <UnifiedExportStudio
                            title={`Studio Ekspor Ranking ${subject.name}`}
                            description="Pilih format ekspor ranking per mata pelajaran, aktifkan signature bila diperlukan, lalu ekspor dari satu panel."
                            triggerLabel="Ekspor"
                            triggerClassName="h-8 text-xs shrink-0"
                            formats={RANKING_EXPORT_FORMATS}
                            selectedFormat={exportFormat}
                            onFormatChange={(value) => setExportFormat(value as typeof exportFormat)}
                            onExport={(args) => exportSubjectRanking(subject.id, args)}
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
                            columnTypographyOptions={buildColumnTypographyOptions(buildSubjectExportConfig(subject.id))}
                            renderPreview={({ previewFormat, draft, setDraft, previewDate, includeSignature: previewIncludeSignature, paperSize: previewPaperSize, documentStyle: previewDocumentStyle, autoFitOnePage: previewAutoFit, liveEditMode, highlightTarget, onHighlightTargetHoverChange, onHighlightTargetSelect, onSignaturePlacementChange }) => {
                              const previewConfig = buildSubjectExportConfig(subject.id, {
                                paperSize: previewPaperSize,
                                documentStyle: previewDocumentStyle ?? documentStyle,
                                autoFitOnePage: previewAutoFit ?? autoFitOnePage,
                                includeSignature: previewIncludeSignature && hasSignature,
                                signatureConfig: draft,
                              });
                              if (!previewConfig) return null;
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
                                  onSignaturePlacementChange={onSignaturePlacementChange}
                                  previewData={previewConfig}
                                />
                              );
                            }}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="px-0 sm:px-2 pb-4">
                        <SubjectRankingCarousel subjectId={subject.id} subject={subject} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Overall Tab */}
            <TabsContent value="overall" className="space-y-4">
              {/* Subject Filter */}
              <Card>
                <CardHeader className="pb-2 sm:pb-4">
                  <CardTitle className="text-sm sm:text-base">Filter Mata Pelajaran</CardTitle>
                  <CardDescription className="text-[10px] sm:text-xs">
                    Pilih mata pelajaran untuk dihitung dalam ranking
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllSubjects}
                      className="text-xs h-7"
                    >
                      Pilih Semua
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={clearSubjectSelection}
                      className="text-xs h-7"
                    >
                      Hapus Pilihan
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((subject) => (
                      <div 
                        key={subject.id} 
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={subject.id}
                          checked={selectedSubjectIds.includes(subject.id)}
                          onCheckedChange={() => toggleSubjectSelection(subject.id)}
                        />
                        <label
                          htmlFor={subject.id}
                          className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {subject.name}
                        </label>
                      </div>
                    ))}
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
                        {selectedSubjectIds.length > 0 
                          ? `${selectedSubjectIds.length} mata pelajaran dipilih` 
                          : "Semua mata pelajaran"}
                        {" • "}{overallRankings.length} siswa • KKM Kelas: {classKkm}
                      </CardDescription>
                    </div>
                    <UnifiedExportStudio
                      title="Studio Ekspor Ranking Keseluruhan"
                      description="Pilih format ekspor ranking keseluruhan dan kelola signature dari satu panel yang sama."
                      triggerLabel="Ekspor"
                      triggerClassName="h-8 text-xs shrink-0"
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
                      renderPreview={({ previewFormat, draft, setDraft, previewDate, includeSignature: previewIncludeSignature, paperSize: previewPaperSize, documentStyle: previewDocumentStyle, autoFitOnePage: previewAutoFit, liveEditMode, highlightTarget, onHighlightTargetHoverChange, onHighlightTargetSelect, onSignaturePlacementChange }) => {
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
                            onSignaturePlacementChange={onSignaturePlacementChange}
                            previewData={{
                              ...overallExportConfig,
                              includeSignature: previewIncludeSignature && hasSignature,
                              signature: buildExportSignature(draft),
                              paperSize: previewPaperSize,
                              documentStyle: previewDocumentStyle ?? documentStyle,
                              autoFitOnePage: previewAutoFit ?? autoFitOnePage,
                            }}
                          />
                        );
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                  {gradesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
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
                            {(() => {
                              const totalItems = overallRankings.length;
                              const isShowAll = pageLimit === -1 || pageLimit >= totalItems;
                              const effectiveLimit = isShowAll ? totalItems : pageLimit;
                              const totalPages = Math.max(1, Math.ceil(totalItems / effectiveLimit));
                              const safePage = isShowAll ? 1 : Math.min(currentPage, totalPages);
                              const startIdx = (safePage - 1) * effectiveLimit;
                              const paginatedRankings = isShowAll ? overallRankings : overallRankings.slice(startIdx, startIdx + effectiveLimit);
                              // Reset to page 1 when showing all to prevent inconsistency
                              if (isShowAll && currentPage !== 1) {
                                setCurrentPage(1);
                              }

                              return paginatedRankings.map((ranking) => (
                                <TableRow key={ranking.student.id}>
                                  <TableCell className="py-2 sm:py-3">
                                    {getRankBadge(ranking.rank)}
                                  </TableCell>
                                  <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-3 max-w-[120px] sm:max-w-none truncate">
                                    {ranking.student.name}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm py-2 sm:py-3 hidden sm:table-cell">
                                    {ranking.student.nisn}
                                  </TableCell>
                                  <TableCell className="text-right py-2 sm:py-3">
                                    <span className={cn(
                                      "font-bold text-xs sm:text-sm",
                                      ranking.overallAverage >= classKkm ? "text-grade-pass" : "text-grade-fail"
                                    )}>
                                      {formatGrade(ranking.overallAverage)}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination Controls */}
                      <PaginationControls
                        currentPage={Math.min(currentPage, Math.max(1, Math.ceil(overallRankings.length / pageLimit)))}
                        totalPages={Math.max(1, Math.ceil(overallRankings.length / pageLimit))}
                        totalItems={overallRankings.length}
                        limit={pageLimit}
                        onPageChange={(p) => setCurrentPage(p)}
                        onLimitChange={(l) => { setPageLimit(l); setCurrentPage(1); }}
                        className="border-t border-border/30"
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
      {exportOverlay}
    </>
  );
}
