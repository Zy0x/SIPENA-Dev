import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Columns3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  X,
  CheckCircle2,
  Star,
  Undo2,
  Redo2,
  Shield,
  Lock,
  LockOpen,
  Hand,
  Snowflake,
  Target,
  Maximize2,
  ChevronDown,
  HelpCircle,
} from "lucide-react";
import { triggerTour } from "@/components/ui/product-tour";
import { getGradeColor, getGradeTextColor } from "./GradeInputCell";
import { GradeHintPopup, HintTarget } from "./GradeHintPopup";
import type { Assignment } from "@/hooks/useAssignments";
import {
  DEFAULT_GRADE_TABLE_COLOR_SCHEME,
  getGradeTableAverageCellTone,
  getGradeTableChapterTone,
  getGradeTableColumnBodyTone,
  getGradeTableColumnHeaderTone,
  normalizeGradeTableColorScheme,
  type GradeTableColorSchemeId,
} from "@/lib/gradeTableColorSchemes";
import {
  applyViewportCssVariables,
  captureViewportTelemetrySnapshot,
  clearViewportCssVariables,
} from "@/lib/viewportTelemetry";
import { isVerticalScrollBoundary, scrollPageBy } from "@/lib/scrollChaining";
import { useCoarsePointerTapGuard } from "@/hooks/useCoarsePointerTapGuard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Smartphone rotation icon SVG (styled after Flaticon 2313449 - counter-clockwise)
const RotateDeviceIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 512 512"
    width="1.1em"
    height="1.1em"
    fill="currentColor"
    className={className}
  >
    {/* Top-left curved arrow */}
    <path d="M 204 0 L 220 0 L 228 4 L 233 12 L 233 23 L 175 83 L 171 85 L 156 83 L 132 56 L 101 77 L 73 106 L 57 130 L 46 154 L 38 181 L 34 222 L 23 233 L 9 232 L 4 228 L 0 220 L 1 193 L 5 170 L 13 143 L 23 120 L 40 92 L 56 72 L 84 46 L 124 21 L 162 7 L 203 1 Z" />
    {/* Bottom-right curved arrow */}
    <path d="M 492 277 L 505 281 L 511 291 L 510 318 L 506 341 L 489 389 L 471 419 L 455 439 L 432 461 L 407 479 L 387 490 L 356 502 L 318 510 L 291 511 L 281 505 L 277 492 L 280 484 L 340 426 L 355 428 L 378 455 L 397 444 L 419 426 L 446 394 L 461 367 L 472 334 L 477 289 L 484 280 L 491 278 Z" />
    {/* Tilted phone body with transparent screen (using evenodd fill rule) */}
    <path 
      fillRule="evenodd" 
      clipRule="evenodd" 
      d="M 321 21 L 338 23 L 350 29 L 482 161 L 488 173 L 490 190 L 487 204 L 478 220 L 220 478 L 204 487 L 196 489 L 177 489 L 161 482 L 29 350 L 23 338 L 21 321 L 24 307 L 33 291 L 291 33 L 307 24 L 322 21 Z M 320 58 L 330 61 L 339 70 L 342 77 L 341 86 L 330 103 L 332 117 L 394 179 L 408 181 L 425 170 L 434 169 L 441 172 L 450 181 L 453 187 L 453 196 L 450 202 L 202 450 L 196 453 L 187 453 L 181 450 L 61 330 L 58 324 L 58 315 L 61 309 L 309 61 L 319 58 Z" 
    />
  </svg>
);

// Types
interface Chapter {
  id: string;
  name: string;
  order_index: number;
}

interface Student {
  id: string;
  name: string;
  nisn: string;
  is_bookmarked?: boolean;
}

interface StudentAverage {
  chaptersAvg: number | null;
  stsAvg: number | null;
  sasAvg: number | null;
  final: number | null;
  chapterDetails: Record<string, number | null>;
  hasEmptyValues: boolean;
}

export interface SpreadsheetTableProps {
  students: Student[];
  chapters: Chapter[];
  assignmentsByChapter: Record<string, Assignment[]>;
  studentAverages: Record<string, StudentAverage>;
  kkm: number;
  getGradeValue: (studentId: string, gradeType: string, assignmentId?: string) => number | null;
  onSaveGrade: (studentId: string, gradeType: string, value: number | null, assignmentId?: string) => void;
  savingGrades: Set<string>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isFullscreen?: boolean;
  onClose?: () => void;
  className?: string;
  subjectName?: string;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onEnterFullscreen?: () => void;
  onEnterBrowserFullscreen?: () => void;
  toolbarExtra?: React.ReactNode;
  /** Slot tambahan di format-row (baris 1) fullscreen, antara help button dan close button */
  toolbarFormatSuffix?: React.ReactNode;
  tableColorScheme?: GradeTableColorSchemeId;
  fullscreenMode?: "browser" | "maximal" | null;
  fullscreenTourKey?: string;
}

type ProtectionMode = 'full' | 'layout' | 'navigate' | 'off';

const PROTECTION_MODE_META = {
  full: { label: 'Proteksi Penuh', icon: Shield },
  layout: { label: 'Kunci Tata Letak', icon: Lock },
  navigate: { label: 'Mode Navigasi', icon: Hand },
  off: { label: 'Proteksi', icon: LockOpen },
} satisfies Record<ProtectionMode, { label: string; icon: typeof Shield }>;

// Constants - matching template
const DEFAULT_COL_WIDTH = 80;
const DEFAULT_ROW_HEIGHT = 44;
const MIN_COL_WIDTH = 50;
const HEADING_HEIGHT = 40;
const CHAPTER_HEADER_HEIGHT = 32;
const INDEX_COL_WIDTH = 45;
const NAME_COL_WIDTH = 160;
const NAME_CELL_VERTICAL_PADDING = 12;
const NAME_LINE_HEIGHT = 16;
const NISN_LINE_HEIGHT = 12;
const GRADE_HINT_POPUP_ENABLED = false;
const TOOLBAR_DRAG_SUPPRESS_MS = 650;
const TOOLBAR_DRAG_RESET_MS = 700;
const TOOLBAR_DRAG_THRESHOLD_X = 6;
const TOOLBAR_DRAG_THRESHOLD_Y = 10;
const WHEEL_LINE_HEIGHT = 16;

function normalizeWheelDelta(delta: number, deltaMode: number, pageSize: number): number {
  if (deltaMode === 1) return delta * WHEEL_LINE_HEIGHT;
  if (deltaMode === 2) return delta * pageSize;
  return delta;
}

function estimateWrappedLineCount(text: string, width: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  const charsPerLine = Math.max(7, Math.floor(Math.max(48, width - 18) / 7.2));
  let lines = 1;
  let currentLineLength = 0;

  words.forEach((word) => {
    const wordLength = word.length;
    if (currentLineLength === 0) {
      currentLineLength = wordLength;
      return;
    }

    if (currentLineLength + 1 + wordLength <= charsPerLine) {
      currentLineLength += 1 + wordLength;
      return;
    }

    lines += 1;
    currentLineLength = wordLength;

    while (currentLineLength > charsPerLine) {
      lines += 1;
      currentLineLength -= charsPerLine;
    }
  });

  return lines;
}

function getChapterTone(schemeId: GradeTableColorSchemeId, index = 0) {
  return getGradeTableChapterTone(schemeId, index);
}

function isStandaloneFinalColumn(column: ColumnDef): column is ColumnDef & { type: "sts" | "sas" | "final" | "status" } {
  return column.type === "sts" || column.type === "sas" || column.type === "final" || column.type === "status";
}

function getColumnHeaderTone(column: ColumnDef, schemeId: GradeTableColorSchemeId): string {
  return getGradeTableColumnHeaderTone(schemeId, column);
}

function getColumnBodyTone(column: ColumnDef, schemeId: GradeTableColorSchemeId): string | null {
  return getGradeTableColumnBodyTone(schemeId, column);
}

function getGradeHeaderTooltip(label: string, fallback = "Header tabel nilai"): string {
  const cleanLabel = label.trim();
  return cleanLabel ? cleanLabel : fallback;
}

interface ColumnDef {
  id: string;
  type: 'index' | 'name' | 'assignment' | 'chapter_avg' | 'sts' | 'sas' | 'final' | 'status';
  label: string;
  chapterId?: string;
  chapterIndex?: number;
  assignmentId?: string;
  width: number;
}

export function SpreadsheetTable({
  students,
  chapters,
  assignmentsByChapter,
  studentAverages,
  kkm,
  getGradeValue,
  onSaveGrade,
  savingGrades,
  searchQuery,
  onSearchChange,
  isFullscreen = false,
  onClose,
  className = "",
  subjectName = "",
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onEnterFullscreen,
  onEnterBrowserFullscreen,
  toolbarExtra,
  toolbarFormatSuffix,
  tableColorScheme = DEFAULT_GRADE_TABLE_COLOR_SCHEME,
  fullscreenMode = null,
  fullscreenTourKey,
}: SpreadsheetTableProps) {
  const activeTableColorScheme = useMemo(
    () => normalizeGradeTableColorScheme(tableColorScheme),
    [tableColorScheme],
  );
  // State - based on template
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zoomInput, setZoomInput] = useState('100');
  const [frozenColumns, setFrozenColumns] = useState<Set<number>>(new Set([0, 1]));
  const [frozenRows, setFrozenRows] = useState<Set<number>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [resizeFeedback, setResizeFeedback] = useState<{ colIndex: number; x: number; width: number } | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [hoveredColumnIndex, setHoveredColumnIndex] = useState<number | null>(null);
  const [showFreezeMenu, setShowFreezeMenu] = useState(false);
  const [showProtectionMenu, setShowProtectionMenu] = useState(false);
  const [showFullscreenMenu, setShowFullscreenMenu] = useState(false);
  const [freezeMenuType, setFreezeMenuType] = useState<'column' | 'row'>('column');
  // Auto-lock format in fullscreen mode
  const [formatLocked, setFormatLocked] = useState(false);
  // Scroll lock mode - disables cell editing for free scrolling on mobile
  const [scrollLockMode, setScrollLockMode] = useState(false);

  // Track if screen is small (mobile/tablet viewport < 1024px) for responsive Nama column width
  const [isSmallScreen, setIsSmallScreen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 1024);
    };
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);
  
  // Debounced calculation ref for real-time updates without losing focus
  const debounceCalcRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track pending save value for debounce
  const [pendingSaveValue, setPendingSaveValue] = useState<string | null>(null);

  // Grade Hint Popup state for mobile long-press
  const [hintPopup, setHintPopup] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    studentId: string;
    studentName: string;
    targetType: HintTarget;
    currentValue: number | null;
    chapterId?: string;
    assignmentId?: string;
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs - based on template
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const freezeMenuRef = useRef<HTMLDivElement>(null);
  const freezeMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const frozenTouchLayerRef = useRef<HTMLDivElement>(null);

  // New refs for direct DOM scroll translation
  const chapterDataSiswaTranslationRef = useRef<HTMLDivElement>(null);
  const chapterHeadersTranslationRef = useRef<HTMLDivElement>(null);
  const headersTranslationRef = useRef<HTMLDivElement>(null);
  const frozenColumnsTranslationRef = useRef<HTMLDivElement>(null);

  const [rotationState, setRotationState] = useState<"none" | "left" | "right">("none");
  const [nativeOrientation, setNativeOrientation] = useState<string>(
    typeof window !== "undefined" && screen.orientation ? screen.orientation.type : ""
  );
  const lastTiltRef = useRef<"left" | "right">("left");

  // Reset rotation when exiting fullscreen mode
  useEffect(() => {
    if (!isFullscreen) {
      setRotationState("none");
      if (typeof window !== "undefined" && screen.orientation) {
        try {
          const orient = screen.orientation as any;
          if (typeof orient.unlock === "function") {
            orient.unlock();
          }
        } catch (e) {
          // ignore
        }
      }
    }
  }, [isFullscreen]);

  // Listen to device physical tilt (accelerometer/gyroscope) to automatically select left/right rotation (reversed coordinate layout mapping)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleDeviceOrientation = (e: DeviceOrientationEvent) => {
      // gamma is the left/right tilt in degrees [-90, 90]
      // If the user rotates the device counter-clockwise (tilts left), gamma is negative
      // If they rotate clockwise (tilts right), gamma is positive
      // Reversed: Tilting left (notch left) needs layout rotated right, and vice versa.
      const gamma = e.gamma;
      if (gamma !== null) {
        if (gamma < -15) {
          lastTiltRef.current = "right";
        } else if (gamma > 15) {
          lastTiltRef.current = "left";
        }
      }
    };
    window.addEventListener("deviceorientation", handleDeviceOrientation);
    return () => {
      window.removeEventListener("deviceorientation", handleDeviceOrientation);
    };
  }, []);

  // Automatically sync rotationState with screen.orientation changes in fullscreen mode (reversed coordinate layout mapping)
  useEffect(() => {
    if (!isFullscreen || typeof window === "undefined" || !screen.orientation) return;

    // Prevent automatic orientation sync on desktop landscape screens
    const isMobile = window.matchMedia("(pointer: coarse)").matches || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile) return;

    const handleOrientationChange = () => {
      const type = screen.orientation.type;
      setNativeOrientation(type);
      if (type === "landscape-primary") {
        setRotationState("left");
      } else if (type === "landscape-secondary") {
        setRotationState("right");
      } else if (type.startsWith("portrait")) {
        setRotationState("none");
      }
    };

    screen.orientation.addEventListener("change", handleOrientationChange);
    // Initialize immediately
    handleOrientationChange();

    return () => {
      screen.orientation.removeEventListener("change", handleOrientationChange);
    };
  }, [isFullscreen]);

  // Handle native screen orientation lock when rotationState changes in native browser fullscreen mode (reversed coordinate layout mapping)
  useEffect(() => {
    if (typeof window === "undefined" || !screen.orientation) return;
    const applyNativeRotation = async () => {
      if (isFullscreen) {
        try {
          const orient = screen.orientation as any;
          if (rotationState === "left") {
            if (typeof orient.lock === "function") {
              await orient.lock("landscape-primary");
            }
          } else if (rotationState === "right") {
            if (typeof orient.lock === "function") {
              await orient.lock("landscape-secondary");
            }
          } else {
            if (typeof orient.unlock === "function") {
              orient.unlock();
            }
          }
        } catch (e) {
          console.log("Native orientation lock failed:", e);
        }
      }
    };
    applyNativeRotation();
  }, [rotationState, isFullscreen]);

  // Apply scroll transforms directly to DOM elements to bypass React re-renders
  const syncScrollTransforms = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const left = container.scrollLeft;
    const top = container.scrollTop;

    const leftTransform = `translate3d(-${left}px, 0, 0)`;
    const topTransform = `translate3d(0, -${top}px, 0)`;

    if (chapterDataSiswaTranslationRef.current) {
      chapterDataSiswaTranslationRef.current.style.transform = leftTransform;
    }
    if (chapterHeadersTranslationRef.current) {
      chapterHeadersTranslationRef.current.style.transform = leftTransform;
    }
    if (headersTranslationRef.current) {
      headersTranslationRef.current.style.transform = leftTransform;
    }
    if (frozenColumnsTranslationRef.current) {
      frozenColumnsTranslationRef.current.style.transform = topTransform;
    }
  }, []);

  useEffect(() => {
    syncScrollTransforms();
  });
  const toolbarDragRef = useRef<{
    x: number;
    y: number;
    moved: boolean;
    pointerActive: boolean;
    pointerId: number | null;
    suppressClickUntil: number;
    resetTimer: ReturnType<typeof setTimeout> | null;
  }>({
    x: 0,
    y: 0,
    moved: false,
    pointerActive: false,
    pointerId: null,
    suppressClickUntil: 0,
    resetTimer: null,
  });
  const resizingRef = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);
  const overlayPanRef = useRef<{ x: number; y: number; time: number; velocityX: number; velocityY: number } | null>(null);
  const overlayMomentumRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const pendingScrollRef = useRef({ left: 0, top: 0 });
  const pinchRef = useRef({
    active: false,
    startDistance: 0,
    startZoom: 100,
  });
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const zoomFactor = zoomLevel / 100;

  useEffect(() => {
    if (!showFreezeMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (freezeMenuRef.current?.contains(target) || freezeMenuTriggerRef.current?.contains(target)) {
        return;
      }

      setShowFreezeMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowFreezeMenu(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showFreezeMenu]);

  const protectionMode = useMemo<ProtectionMode>(() => {
    if (formatLocked && scrollLockMode) return 'full';
    if (formatLocked) return 'layout';
    if (scrollLockMode) return 'navigate';
    return 'off';
  }, [formatLocked, scrollLockMode]);

  const protectionModeMeta = PROTECTION_MODE_META[protectionMode];
  const ProtectionModeIcon = protectionModeMeta.icon;

  const applyProtectionMode = useCallback((mode: ProtectionMode) => {
    switch (mode) {
      case 'full':
        setFormatLocked(true);
        setScrollLockMode(true);
        break;
      case 'layout':
        setFormatLocked(true);
        setScrollLockMode(false);
        break;
      case 'navigate':
        setFormatLocked(false);
        setScrollLockMode(true);
        break;
      case 'off':
        setFormatLocked(false);
        setScrollLockMode(false);
        break;
    }
  }, []);

  const handleProtectionButtonClick = useCallback(() => {
    if (formatLocked && scrollLockMode) {
      applyProtectionMode('off');
      return;
    }

    applyProtectionMode('full');
  }, [applyProtectionMode, formatLocked, scrollLockMode]);

  // Build columns structure with chapter grouping
  const columns: ColumnDef[] = useMemo(() => {
    const cols: ColumnDef[] = [
      { id: 'index', type: 'index', label: 'No', width: INDEX_COL_WIDTH },
      { id: 'name', type: 'name', label: 'Nama Siswa', width: isSmallScreen ? 115 : NAME_COL_WIDTH },
    ];

    chapters.forEach((chapter, chapterIndex) => {
      const assignments = assignmentsByChapter[chapter.id] || [];
      assignments.forEach(assignment => {
        cols.push({
          id: `assignment-${assignment.id}`,
          type: 'assignment',
          label: assignment.name,
          chapterId: chapter.id,
          chapterIndex,
          assignmentId: assignment.id,
          width: DEFAULT_COL_WIDTH,
        });
      });
      cols.push({
        id: `chapter_avg-${chapter.id}`,
        type: 'chapter_avg',
        label: 'Rata-rata',
        chapterId: chapter.id,
        chapterIndex,
        width: 84,
      });
    });

    cols.push(
      { id: 'sts', type: 'sts', label: 'STS', width: DEFAULT_COL_WIDTH },
      { id: 'sas', type: 'sas', label: 'SAS', width: DEFAULT_COL_WIDTH },
      { id: 'final', type: 'final', label: 'Rapor', width: DEFAULT_COL_WIDTH },
      { id: 'status', type: 'status', label: 'Status', width: 85 }
    );

    return cols;
  }, [chapters, assignmentsByChapter, isSmallScreen]);

  // Build chapter headers for grouped display
  const chapterHeaders = useMemo(() => {
    const headers: { chapterId: string; chapterName: string; chapterIndex: number; startIdx: number; endIdx: number }[] = [];
    let currentIdx = 2; // Start after No and Name

    chapters.forEach((chapter, chapterIndex) => {
      const assignments = assignmentsByChapter[chapter.id] || [];
      const startIdx = currentIdx;
      const endIdx = currentIdx + assignments.length; // Including avg column
      headers.push({
        chapterId: chapter.id,
        chapterName: chapter.name,
        chapterIndex,
        startIdx,
        endIdx,
      });
      currentIdx = endIdx + 1; // Move past avg column
    });

    return headers;
  }, [chapters, assignmentsByChapter]);

  // Column width helper
  const getColWidth = useCallback((colIndex: number): number => {
    if (colIndex < 0 || colIndex >= columns.length) return DEFAULT_COL_WIDTH;
    return columnWidths[colIndex] ?? columns[colIndex]?.width ?? DEFAULT_COL_WIDTH;
  }, [columnWidths, columns]);

  const rowHeights = useMemo(() => {
    const nameColumnWidth = getColWidth(1);
    return students.map((student) => {
      const nameLineCount = estimateWrappedLineCount(student.name, nameColumnWidth);
      return Math.max(
        DEFAULT_ROW_HEIGHT,
        NAME_CELL_VERTICAL_PADDING + nameLineCount * NAME_LINE_HEIGHT + NISN_LINE_HEIGHT,
      );
    });
  }, [getColWidth, students]);

  const getRowHeight = useCallback((rowIndex: number): number => {
    return rowHeights[rowIndex] ?? DEFAULT_ROW_HEIGHT;
  }, [rowHeights]);

  // Sorted frozen columns for consistent ordering
  const sortedFrozenColumns = useMemo(() => 
    Array.from(frozenColumns).sort((a, b) => a - b).filter(i => i >= 0 && i < columns.length)
  , [frozenColumns, columns.length]);

  // Non-frozen columns in order
  const nonFrozenColumns = useMemo(() =>
    columns.map((_, i) => i).filter(i => !frozenColumns.has(i))
  , [columns, frozenColumns]);

  // Sorted frozen rows for consistent ordering
  const sortedFrozenRows = useMemo(() => 
    Array.from(frozenRows).sort((a, b) => a - b).filter(i => i >= 0 && i < students.length)
  , [frozenRows, students.length]);

  // Non-frozen rows in order
  const nonFrozenRowIndices = useMemo(() =>
    students.map((_, i) => i).filter(i => !frozenRows.has(i))
  , [students, frozenRows]);

  // Get frozen column position (position within frozen area)
  const getFrozenColLeft = useCallback((colIndex: number): number => {
    let left = 0;
    for (const frozenCol of sortedFrozenColumns) {
      if (frozenCol === colIndex) break;
      left += getColWidth(frozenCol) * zoomFactor;
    }
    return left;
  }, [sortedFrozenColumns, getColWidth, zoomFactor]);

  // Get non-frozen column position (position within scrollable area)
  const getNonFrozenColLeft = useCallback((colIndex: number): number => {
    let left = 0;
    for (const nonFrozenCol of nonFrozenColumns) {
      if (nonFrozenCol === colIndex) break;
      left += getColWidth(nonFrozenCol) * zoomFactor;
    }
    return left;
  }, [nonFrozenColumns, getColWidth, zoomFactor]);

  // Get row position (relative to frozen/non-frozen area)
  const getFrozenRowTop = useCallback((rowIndex: number): number => {
    let top = 0;
    for (const frozenRow of sortedFrozenRows) {
      if (frozenRow === rowIndex) break;
      top += getRowHeight(frozenRow) * zoomFactor;
    }
    return top;
  }, [getRowHeight, sortedFrozenRows, zoomFactor]);

  const getNonFrozenRowTop = useCallback((rowIndex: number): number => {
    let top = 0;
    for (const nonFrozenRow of nonFrozenRowIndices) {
      if (nonFrozenRow === rowIndex) break;
      top += getRowHeight(nonFrozenRow) * zoomFactor;
    }
    return top;
  }, [getRowHeight, nonFrozenRowIndices, zoomFactor]);

  const getFrozenWidth = useCallback((): number => {
    return sortedFrozenColumns.reduce((sum, col) => sum + getColWidth(col) * zoomFactor, 0);
  }, [sortedFrozenColumns, getColWidth, zoomFactor]);

  const getFrozenHeight = useCallback((): number => {
    return sortedFrozenRows.reduce((sum, rowIndex) => sum + getRowHeight(rowIndex) * zoomFactor, 0);
  }, [getRowHeight, sortedFrozenRows, zoomFactor]);

  const getTotalWidth = useCallback((): number => {
    return columns.reduce((sum, _, i) => sum + getColWidth(i) * zoomFactor, 0);
  }, [columns, getColWidth, zoomFactor]);

  const getTotalHeight = useCallback((): number => {
    return rowHeights.reduce((sum, height) => sum + height * zoomFactor, 0);
  }, [rowHeights, zoomFactor]);

  const getNonFrozenWidth = useCallback((): number => {
    return nonFrozenColumns.reduce((sum, i) => sum + getColWidth(i) * zoomFactor, 0);
  }, [nonFrozenColumns, getColWidth, zoomFactor]);

  const getNonFrozenHeight = useCallback((): number => {
    return nonFrozenRowIndices.reduce((sum, rowIndex) => sum + getRowHeight(rowIndex) * zoomFactor, 0);
  }, [getRowHeight, nonFrozenRowIndices, zoomFactor]);

  // Simple row top calculation for non-frozen-row mode (current implementation)
  const getRowTop = useCallback((rowIndex: number): number => {
    let top = 0;
    for (let index = 0; index < rowIndex; index += 1) {
      top += getRowHeight(index) * zoomFactor;
    }
    return top;
  }, [getRowHeight, zoomFactor]);

  const totalHeaderHeight = (chapters.length > 0 ? CHAPTER_HEADER_HEIGHT : 0) + HEADING_HEIGHT;

  useEffect(() => {
    if (!isFullscreen || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscrollBehavior = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "contain";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen || fullscreenMode !== "browser" || typeof document === "undefined") return;

    const target = document.documentElement;
    const updateViewportMetrics = () => {
      applyViewportCssVariables(captureViewportTelemetrySnapshot(window.location.pathname || "/"), target);
    };

    updateViewportMetrics();

    const visualViewport = window.visualViewport;
    window.addEventListener("resize", updateViewportMetrics);
    window.addEventListener("orientationchange", updateViewportMetrics);
    visualViewport?.addEventListener("resize", updateViewportMetrics);
    visualViewport?.addEventListener("scroll", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      window.removeEventListener("orientationchange", updateViewportMetrics);
      visualViewport?.removeEventListener("resize", updateViewportMetrics);
      visualViewport?.removeEventListener("scroll", updateViewportMetrics);
      clearViewportCssVariables(target);
    };
  }, [fullscreenMode, isFullscreen]);

  // Focus edit input when editing
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Keyboard shortcuts - FIXED: allow undo/redo even when editing (Ctrl/Cmd key pressed)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow undo/redo shortcuts even when editing
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        onUndo?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        onRedo?.();
        return;
      }

      // Other shortcuts only when not editing (except Escape/Enter/Tab)
      if (editingCell && e.key !== 'Escape' && e.key !== 'Enter' && e.key !== 'Tab') return;

      if (e.key === 'Escape' && editingCell) {
        setEditingCell(null);
        setEditValue('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingCell, onUndo, onRedo]);

  // Scroll handler
  const handleScroll = useCallback((_e?: React.UIEvent<HTMLDivElement>) => {
    if (scrollRafRef.current !== null) return;

    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      syncScrollTransforms();
    });
  }, [syncScrollTransforms]);

  useEffect(() => () => {
    if (scrollRafRef.current !== null) {
      window.cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
  }, []);

  const cancelOverlayMomentum = useCallback(() => {
    if (overlayMomentumRef.current !== null) {
      window.cancelAnimationFrame(overlayMomentumRef.current);
      overlayMomentumRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelOverlayMomentum(), [cancelOverlayMomentum]);

  const scrollSpreadsheetBy = useCallback((deltaX: number, deltaY: number) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    el.scrollLeft += deltaX;
    el.scrollTop += deltaY;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const originatedInScrollContainer = e.target instanceof Node && el.contains(e.target);
    const deltaX = normalizeWheelDelta(e.deltaX, e.deltaMode, el.clientWidth);
    const deltaY = normalizeWheelDelta(e.deltaY, e.deltaMode, el.clientHeight);
    const isVerticalWheel = Math.abs(deltaY) > Math.abs(deltaX);

    if (!originatedInScrollContainer) {
      const shouldReleaseToPage = isVerticalWheel && (
        isVerticalScrollBoundary(el, deltaY)
      );

      if (shouldReleaseToPage) {
        scrollPageBy(deltaY);
      } else {
        scrollSpreadsheetBy(deltaX, deltaY);
      }
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (!isVerticalWheel) return;

    const shouldReleaseToPage = isVerticalScrollBoundary(el, deltaY);

    if (!shouldReleaseToPage) return;

    scrollPageBy(deltaY);
    e.preventDefault();
    e.stopPropagation();
  }, [scrollSpreadsheetBy]);

  const handleFrozenLayerWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;

    cancelOverlayMomentum();

    const deltaX = normalizeWheelDelta(e.deltaX, e.deltaMode, el.clientWidth);
    const deltaY = normalizeWheelDelta(e.deltaY, e.deltaMode, el.clientHeight);
    const isVerticalWheel = Math.abs(deltaY) > Math.abs(deltaX);
    const shouldReleaseToPage = isVerticalWheel && (
      isVerticalScrollBoundary(el, deltaY)
    );

    if (shouldReleaseToPage) {
      scrollPageBy(deltaY);
    } else {
      scrollSpreadsheetBy(deltaX, deltaY);
    }

    e.preventDefault();
    e.stopPropagation();
  }, [cancelOverlayMomentum, scrollSpreadsheetBy]);

  // Toggle freeze column - blocked when format is locked
  const toggleFreezeColumn = useCallback((colIndex: number) => {
    if (formatLocked) return;
    setFrozenColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(colIndex)) {
        newSet.delete(colIndex);
      } else {
        newSet.add(colIndex);
      }
      return newSet;
    });
  }, [formatLocked]);

  // Toggle freeze row - blocked when format is locked
  const toggleFreezeRow = useCallback((rowIndex: number) => {
    if (formatLocked) return;
    setFrozenRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  }, [formatLocked]);

  // Zoom controls - blocked when format is locked
  const handleZoomIn = useCallback(() => {
    if (formatLocked) return;
    const newZoom = Math.min(200, zoomLevel + 10);
    setZoomLevel(newZoom);
    setZoomInput(newZoom.toString());
  }, [zoomLevel, formatLocked]);

  const handleZoomOut = useCallback(() => {
    if (formatLocked) return;
    const newZoom = Math.max(50, zoomLevel - 10);
    setZoomLevel(newZoom);
    setZoomInput(newZoom.toString());
  }, [zoomLevel, formatLocked]);

  const handleZoomInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (formatLocked) return;
    setZoomInput(e.target.value);
  }, [formatLocked]);

  const handleZoomInputBlur = useCallback(() => {
    if (formatLocked) return;
    let numValue = parseInt(zoomInput);
    if (isNaN(numValue)) {
      numValue = 100;
    } else {
      numValue = Math.max(50, Math.min(200, numValue));
    }
    setZoomLevel(numValue);
    setZoomInput(numValue.toString());
  }, [zoomInput, formatLocked]);

  const handleZoomInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (formatLocked) return;
    if (e.key === 'Enter') {
      handleZoomInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  }, [handleZoomInputBlur, formatLocked]);

  const handleReset = useCallback(() => {
    if (formatLocked) return;
    setColumnWidths({});
    setFrozenColumns(new Set([0, 1]));
    setFrozenRows(new Set([0]));
    setZoomLevel(100);
    setZoomInput('100');
    setEditingCell(null);
    setEditValue('');
    setShowFreezeMenu(false);

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
      scrollContainerRef.current.scrollTop = 0;
    }
    syncScrollTransforms();
  }, [formatLocked, syncScrollTransforms]);

  // Column resize handlers - blocked when format is locked
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, colIndex: number) => {
    if (formatLocked) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = getColWidth(colIndex);
    const containerLeft = containerRef.current?.getBoundingClientRect().left || 0;

    resizingRef.current = { colIndex, startX, startWidth };
    setResizeFeedback({ colIndex, x: startX - containerLeft, width: Math.round(startWidth) });

    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      const resizing = resizingRef.current;
      if (!resizing) return;

      const currentX = 'touches' in moveEvent
        ? (moveEvent as TouchEvent).touches[0]?.clientX
        : (moveEvent as MouseEvent).clientX;

      if (currentX === undefined) return;

      const diff = (currentX - resizing.startX) / zoomFactor;
      const newWidth = Math.max(MIN_COL_WIDTH, resizing.startWidth + diff);

      setColumnWidths(prev => ({ ...prev, [resizing.colIndex]: newWidth }));
      setResizeFeedback({
        colIndex: resizing.colIndex,
        x: currentX - containerLeft,
        width: Math.round(newWidth),
      });
    };

    const handleEnd = () => {
      resizingRef.current = null;
      setResizeFeedback(null);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
      window.removeEventListener('blur', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    window.addEventListener('blur', handleEnd);
  }, [getColWidth, zoomFactor, formatLocked]);

  const renderResizeHandle = useCallback((colIndex: number) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Ubah lebar kolom ${columns[colIndex]?.label || colIndex + 1}`}
      className="sipena-grade-resize-handle absolute right-0 top-0 z-10 h-full w-3 cursor-col-resize touch-none"
      data-resizing={resizeFeedback?.colIndex === colIndex ? "true" : "false"}
      onMouseDown={(event) => handleResizeStart(event, colIndex)}
      onTouchStart={(event) => handleResizeStart(event, colIndex)}
    >
      <span aria-hidden="true" className="sipena-grade-resize-handle-line" />
    </div>
  ), [columns, handleResizeStart, resizeFeedback?.colIndex]);

  // Touch handling for pinch zoom - blocked when format is locked
  const getDistance = useCallback((touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const el = scrollContainerRef.current;
    const frozenLayer = frozenTouchLayerRef.current;
    const originatedInFrozenLayer = !!(
      frozenLayer &&
      e.target instanceof Node &&
      frozenLayer.contains(e.target)
    );

    if (e.touches.length === 1 && el && e.target instanceof Node && (!el.contains(e.target) || originatedInFrozenLayer)) {
      cancelOverlayMomentum();
      const now = performance.now();
      overlayPanRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: now,
        velocityX: 0,
        velocityY: 0,
      };
      return;
    }

    overlayPanRef.current = null;

    // Hanya set state untuk pinch-zoom (2 jari). Jangan preventDefault di awal.
    if (e.touches.length === 2 && !formatLocked) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      pinchRef.current = {
        active: true,
        startDistance: distance,
        startZoom: zoomLevel,
      };
    }
  }, [cancelOverlayMomentum, zoomLevel, getDistance, formatLocked]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const el = scrollContainerRef.current;
    if (e.touches.length === 1 && el && overlayPanRef.current) {
      const touch = e.touches[0];
      const previous = overlayPanRef.current;
      const deltaX = previous.x - touch.clientX;
      const deltaY = previous.y - touch.clientY;
      const now = performance.now();
      const dt = Math.max(8, now - previous.time);
      const isMostlyVertical = Math.abs(deltaY) > Math.abs(deltaX);
      const shouldReleaseToPage = isMostlyVertical && (
        isVerticalScrollBoundary(el, deltaY)
      );
      overlayPanRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: now,
        velocityX: deltaX / dt,
        velocityY: deltaY / dt,
      };

      if (shouldReleaseToPage) {
        scrollPageBy(deltaY);
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      el.scrollLeft += deltaX;
      el.scrollTop += deltaY;
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Prevent hanya saat pinch-zoom aktif (2 jari) agar 1 jari tetap scroll native.
    if (e.touches.length === 2 && pinchRef.current.active && !formatLocked) {
      e.preventDefault();
      e.stopPropagation();

      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / pinchRef.current.startDistance;

      let newZoom = Math.round(pinchRef.current.startZoom * scale);
      newZoom = Math.max(50, Math.min(200, newZoom));

      setZoomLevel(newZoom);
      setZoomInput(newZoom.toString());
    }
  }, [getDistance, formatLocked]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    const overlayPan = overlayPanRef.current;
    overlayPanRef.current = null;

    const el = scrollContainerRef.current;
    if (el && overlayPan) {
      let velocityX = overlayPan.velocityX;
      let velocityY = overlayPan.velocityY;

      if (Math.hypot(velocityX, velocityY) > 0.035) {
        cancelOverlayMomentum();

        const step = () => {
          velocityX *= 0.92;
          velocityY *= 0.92;

          if (Math.hypot(velocityX, velocityY) < 0.012) {
            overlayMomentumRef.current = null;
            return;
          }

          const beforeLeft = el.scrollLeft;
          const beforeTop = el.scrollTop;
          el.scrollLeft += velocityX * 16;
          el.scrollTop += velocityY * 16;

          const hitHorizontalEdge = Math.abs(el.scrollLeft - beforeLeft) < 0.5 && Math.abs(velocityX) > 0.02;
          const hitVerticalEdge = Math.abs(el.scrollTop - beforeTop) < 0.5 && Math.abs(velocityY) > 0.02;
          if (hitHorizontalEdge) velocityX = 0;
          if (hitVerticalEdge) velocityY = 0;

          overlayMomentumRef.current = window.requestAnimationFrame(step);
        };

        overlayMomentumRef.current = window.requestAnimationFrame(step);
      }
    }

    // Reset pinch state
    pinchRef.current.active = false;
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, [cancelOverlayMomentum]);

  // Show hint popup - for both long press (mobile) and hover (desktop fullscreen)
  const showHintForCell = useCallback((
    position: { x: number; y: number },
    rowIndex: number,
    colIndex: number
  ) => {
    if (!GRADE_HINT_POPUP_ENABLED) return;

    const student = students[rowIndex];
    const column = columns[colIndex];
    
    if (!student || !column || !['assignment', 'sts', 'sas'].includes(column.type)) return;

    // Get grade data for hint calculation
    const gradeType = column.type === 'assignment' ? 'assignment' : column.type;
    const currentValue = getGradeValue(student.id, gradeType, column.assignmentId);

    // Get other assignment values for chapter avg calculation
    let otherAssignmentValues: number[] = [];
    let totalAssignments = 1;
    
    if (column.type === 'assignment' && column.chapterId) {
      const chapterAssignments = assignmentsByChapter[column.chapterId] || [];
      totalAssignments = chapterAssignments.length;
      otherAssignmentValues = chapterAssignments
        .filter(a => a.id !== column.assignmentId)
        .map(a => getGradeValue(student.id, 'assignment', a.id))
        .filter((v): v is number => v !== null);
    }

    setHintPopup({
      isOpen: true,
      position,
      studentId: student.id,
      studentName: student.name,
      targetType: column.type as HintTarget,
      currentValue,
      chapterId: column.chapterId,
      assignmentId: column.assignmentId,
    });
  }, [students, columns, getGradeValue, assignmentsByChapter]);

  // Long press handler for showing grade hint popup on mobile
  const handleCellLongPress = useCallback((
    e: React.TouchEvent,
    rowIndex: number,
    colIndex: number
  ) => {
    if (!GRADE_HINT_POPUP_ENABLED || isFullscreen) return;

    const student = students[rowIndex];
    const column = columns[colIndex];
    
    if (!student || !column || !['assignment', 'sts', 'sas'].includes(column.type)) return;

    // Clear any existing timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    const touch = e.touches[0];
    const position = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      showHintForCell(position, rowIndex, colIndex);
    }, 500); // 500ms long press
  }, [isFullscreen, students, columns, showHintForCell]);

  // Prediksi nilai ditahan sementara agar tidak menutup sel saat guru input cepat.
  const hintHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeHintPopup = useCallback(() => {
    setHintPopup(null);
  }, []);
  
  const handleCellMouseEnter = useCallback((_e?: React.MouseEvent, _rowIndex?: number, _colIndex?: number) => {
    if (!GRADE_HINT_POPUP_ENABLED) return;

    if (hintHoverTimerRef.current) {
      clearTimeout(hintHoverTimerRef.current);
      hintHoverTimerRef.current = null;
    }
  }, []);

  const handleCellMouseLeave = useCallback((rowIndex?: number) => {
    if (typeof rowIndex === "number") {
      setHoveredRowIndex((current) => (current === rowIndex ? null : current));
    }

    if (hintHoverTimerRef.current) {
      clearTimeout(hintHoverTimerRef.current);
      hintHoverTimerRef.current = null;
    }
    // Small delay before closing to allow moving to popup
    setTimeout(() => {
      if (!hintHoverTimerRef.current) {
        closeHintPopup();
      }
    }, 100);
  }, [closeHintPopup]);

  const resetToolbarDragState = useCallback(() => {
    if (toolbarDragRef.current.resetTimer) {
      clearTimeout(toolbarDragRef.current.resetTimer);
    }
    toolbarDragRef.current.resetTimer = setTimeout(() => {
      toolbarDragRef.current.moved = false;
      toolbarDragRef.current.resetTimer = null;
    }, TOOLBAR_DRAG_RESET_MS);
  }, []);

  const isToolbarActivationSuppressed = useCallback(() => (
    toolbarDragRef.current.moved || Date.now() < toolbarDragRef.current.suppressClickUntil
  ), []);

  const handleToolbarPointerDownCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    toolbarDragRef.current.x = e.clientX;
    toolbarDragRef.current.y = e.clientY;
    toolbarDragRef.current.moved = false;
    toolbarDragRef.current.pointerActive = true;
    toolbarDragRef.current.pointerId = e.pointerId;
    if (toolbarDragRef.current.resetTimer) {
      clearTimeout(toolbarDragRef.current.resetTimer);
      toolbarDragRef.current.resetTimer = null;
    }
  }, []);

  const handleToolbarPointerMoveCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!toolbarDragRef.current.pointerActive || toolbarDragRef.current.pointerId !== e.pointerId) return;
    const deltaX = Math.abs(e.clientX - toolbarDragRef.current.x);
    const deltaY = Math.abs(e.clientY - toolbarDragRef.current.y);
    if (deltaX > TOOLBAR_DRAG_THRESHOLD_X || deltaY > TOOLBAR_DRAG_THRESHOLD_Y) {
      toolbarDragRef.current.moved = true;
    }
  }, []);

  const finishToolbarPointer = useCallback((pointerId: number) => {
    if (!toolbarDragRef.current.pointerActive) return;
    if (toolbarDragRef.current.pointerId !== null && toolbarDragRef.current.pointerId !== pointerId) return;
    if (toolbarDragRef.current.moved) {
      toolbarDragRef.current.suppressClickUntil = Date.now() + TOOLBAR_DRAG_SUPPRESS_MS;
    }
    toolbarDragRef.current.pointerActive = false;
    toolbarDragRef.current.pointerId = null;
    resetToolbarDragState();
  }, [resetToolbarDragState]);

  const handleToolbarPointerEndCapture = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    finishToolbarPointer(e.pointerId);
  }, [finishToolbarPointer]);

  useEffect(() => {
    const handlePointerEnd = (event: PointerEvent) => finishToolbarPointer(event.pointerId);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [finishToolbarPointer]);

  const handleToolbarClickCapture = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isToolbarActivationSuppressed()) return;
    e.preventDefault();
    e.stopPropagation();
    resetToolbarDragState();
  }, [isToolbarActivationSuppressed, resetToolbarDragState]);

  const handleToolbarDropdownOpenChange = useCallback((
    setOpen: React.Dispatch<React.SetStateAction<boolean>>,
    nextOpen: boolean,
  ) => {
    if (nextOpen && isToolbarActivationSuppressed()) return;
    setOpen(nextOpen);
  }, [isToolbarActivationSuppressed]);

  const protectionDropdownTapGuard = useCoarsePointerTapGuard<HTMLButtonElement>({
    moveThresholdX: TOOLBAR_DRAG_THRESHOLD_X,
    moveThresholdY: TOOLBAR_DRAG_THRESHOLD_Y,
    suppressMs: TOOLBAR_DRAG_SUPPRESS_MS,
    isSuppressed: isToolbarActivationSuppressed,
    onValidTap: () => setShowProtectionMenu((current) => !current),
  });

  const fullscreenDropdownTapGuard = useCoarsePointerTapGuard<HTMLButtonElement>({
    moveThresholdX: TOOLBAR_DRAG_THRESHOLD_X,
    moveThresholdY: TOOLBAR_DRAG_THRESHOLD_Y,
    suppressMs: TOOLBAR_DRAG_SUPPRESS_MS,
    isSuppressed: isToolbarActivationSuppressed,
    onValidTap: () => setShowFullscreenMenu((current) => !current),
  });

  const handleCellTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Cell editing - SINGLE CLICK to edit for grade cells
  const startEditing = useCallback((rowIdx: number, colIdx: number) => {
    const cellKey = `${rowIdx}-${colIdx}`;
    const student = students[rowIdx];
    const column = columns[colIdx];
    
    if (student && column && ['assignment', 'sts', 'sas'].includes(column.type)) {
      closeHintPopup();
      setEditingCell(cellKey);
      const gradeType = column.type === 'assignment' ? 'assignment' : column.type;
      const value = getGradeValue(student.id, gradeType, column.assignmentId);
      setEditValue(value?.toString() || '');
      setPendingSaveValue(null);
    }
  }, [students, columns, getGradeValue, closeHintPopup]);

  // Debounced real-time calculation - saves while user is still editing
  const debouncedSave = useCallback((studentId: string, gradeType: string, value: number | null, assignmentId?: string) => {
    // Clear existing debounce timer
    if (debounceCalcRef.current) {
      clearTimeout(debounceCalcRef.current);
    }
    
    // Set new debounce timer (300ms for real-time feel)
    debounceCalcRef.current = setTimeout(() => {
      onSaveGrade(studentId, gradeType, value, assignmentId);
    }, 300);
  }, [onSaveGrade]);

  // Handle edit value change with debounced real-time calculation
  const handleEditValueChange = useCallback((newValue: string) => {
    setEditValue(newValue);
    
    // Trigger debounced calculation without losing focus
    if (!editingCell) return;
    
    const [rowIdx, colIdx] = editingCell.split('-').map(Number);
    const student = students[rowIdx];
    const column = columns[colIdx];
    
    if (student && column && ['assignment', 'sts', 'sas'].includes(column.type)) {
      const gradeType = column.type === 'assignment' ? 'assignment' : column.type;
      const numValue = newValue === '' ? null : parseFloat(newValue);
      
      // Only trigger calculation if value is valid
      if (numValue === null || (!isNaN(numValue) && numValue >= 0 && numValue <= 100)) {
        debouncedSave(student.id, gradeType, numValue, column.assignmentId);
      }
    }
  }, [editingCell, students, columns, debouncedSave]);

  const saveEdit = useCallback((moveToNextRow = false) => {
    if (!editingCell) return;

    // Clear any pending debounce
    if (debounceCalcRef.current) {
      clearTimeout(debounceCalcRef.current);
      debounceCalcRef.current = null;
    }

    const [rowIdx, colIdx] = editingCell.split('-').map(Number);
    const student = students[rowIdx];
    const column = columns[colIdx];

    if (student && column && ['assignment', 'sts', 'sas'].includes(column.type)) {
      const gradeType = column.type === 'assignment' ? 'assignment' : column.type;
      const value = editValue === '' ? null : parseFloat(editValue);
      
      if (value === null || (!isNaN(value) && value >= 0 && value <= 100)) {
        // Final save (immediate, not debounced)
        onSaveGrade(student.id, gradeType, value, column.assignmentId);
      }
    }

    setEditingCell(null);
    setEditValue('');
    setPendingSaveValue(null);

    // Move to next row if enter was pressed (vertical navigation)
    if (moveToNextRow && rowIdx < students.length - 1) {
      setTimeout(() => {
        startEditing(rowIdx + 1, colIdx);
      }, 50);
    }
  }, [editingCell, students, columns, editValue, onSaveGrade, startEditing]);

  // Handle cell click - SINGLE click to edit grade cells (disabled in scroll lock mode)
  const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
    // If scroll lock mode is enabled, don't allow editing
    if (scrollLockMode) return;
    
    const column = columns[colIndex];
    
    if (editingCell) {
      const [currentRow, currentCol] = editingCell.split('-').map(Number);
      if (currentRow !== rowIndex || currentCol !== colIndex) {
        saveEdit(false);
      }
    }

    // Single click opens edit for editable cells
    if (column && ['assignment', 'sts', 'sas'].includes(column.type)) {
      startEditing(rowIndex, colIndex);
    }
  }, [columns, editingCell, saveEdit, startEditing, scrollLockMode]);

  // Get text alignment based on column type
  const getTextAlign = useCallback((colType: string): 'left' | 'center' => {
    return colType === 'name' ? 'left' : 'center';
  }, []);

  // Render cell content
  const renderCellContent = useCallback((student: Student, column: ColumnDef, rowIndex: number, colIndex: number) => {
    const cellKey = `${rowIndex}-${colIndex}`;
    const isEditing = editingCell === cellKey;
    const avg = studentAverages[student.id];
    const textAlign = getTextAlign(column.type);

    switch (column.type) {
      case 'index':
        return (
          <span 
            className="font-medium text-muted-foreground w-full text-center"
            style={{ fontSize: `${12 * zoomFactor}px` }}
          >
            {rowIndex + 1}
          </span>
        );

      case 'name':
        return (
          <div className="flex h-full min-w-0 w-full items-start gap-1">
            {student.is_bookmarked && (
              <Star 
                className="mt-0.5 flex-shrink-0 fill-amber-500 text-amber-500"
                style={{ width: `${14 * zoomFactor}px`, height: `${14 * zoomFactor}px` }}
              />
            )}
            <div className="min-w-0 flex-1 text-left">
              <div 
                className="whitespace-normal break-words font-medium"
                style={{ fontSize: `${12 * zoomFactor}px`, lineHeight: `${16 * zoomFactor}px` }}
              >
                {student.name}
              </div>
              <div 
                className="break-words text-muted-foreground"
                style={{ fontSize: `${10 * zoomFactor}px`, lineHeight: `${12 * zoomFactor}px` }}
              >
                {student.nisn}
              </div>
            </div>
          </div>
        );

      case 'assignment':
      case 'sts':
      case 'sas': {
        const gradeType = column.type === 'assignment' ? 'assignment' : column.type;
        const value = getGradeValue(student.id, gradeType, column.assignmentId);
        const isSaving = savingGrades.has(`${student.id}-${gradeType}-${column.assignmentId || ''}`);

        if (isEditing) {
          return (
            <input
              ref={editInputRef}
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.1"
              value={editValue}
              onChange={(e) => handleEditValueChange(e.target.value)}
              onBlur={() => saveEdit(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveEdit(true);
                } else if (e.key === 'Escape') {
                  // Clear pending debounce on escape
                  if (debounceCalcRef.current) {
                    clearTimeout(debounceCalcRef.current);
                  }
                  setEditingCell(null);
                  setEditValue('');
                } else if (e.key === 'Tab') {
                  e.preventDefault();
                  saveEdit(false);
                  // Navigate to next editable cell horizontally
                  const [rowIdx, colIdx] = editingCell.split('-').map(Number);
                  const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
                  if (nextCol >= 0 && nextCol < columns.length) {
                    setTimeout(() => startEditing(rowIdx, nextCol), 50);
                  }
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  saveEdit(false);
                  // Navigate up
                  const [rowIdx, colIdx] = editingCell.split('-').map(Number);
                  if (rowIdx > 0) {
                    setTimeout(() => startEditing(rowIdx - 1, colIdx), 50);
                  }
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  saveEdit(true);
                }
              }}
              className="w-full h-full border-none outline-none bg-transparent text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ fontSize: `${13 * zoomFactor}px` }}
            />
          );
        }

        const colorClass = getGradeTextColor(value, kkm);
        // Format: integer tanpa desimal, desimal sesuai input user
        const displayValue = value !== null
          ? (Number.isInteger(value) ? value.toString() : value.toString())
          : '-';
        return (
          <div 
            className={`w-full h-full flex items-center justify-center rounded font-semibold transition-colors cursor-pointer ${colorClass} ${isSaving ? 'opacity-50' : ''}`}
            style={{ fontSize: `${13 * zoomFactor}px` }}
          >
            {displayValue}
          </div>
        );
      }

      case 'chapter_avg': {
        const chapterAvg = avg?.chapterDetails[column.chapterId!];
        // Format: integer tanpa desimal, desimal dengan 1 angka di belakang koma
        const displayValue = chapterAvg !== null
          ? (Number.isInteger(chapterAvg) ? chapterAvg.toString() : chapterAvg.toFixed(1))
          : '-';
        const colorClass = getGradeTextColor(chapterAvg ?? null, kkm);
        return (
          <div 
            className={`flex h-full w-full items-center justify-center rounded border ${getGradeTableAverageCellTone(activeTableColorScheme)} ${colorClass}`}
            style={{ fontSize: `${12 * zoomFactor}px` }}
          >
            {displayValue}
          </div>
        );
      }

      case 'final': {
        const finalValue = avg?.final ?? null;
        const colorClass = getGradeColor(finalValue, kkm);
        // Format: integer tanpa desimal, desimal dengan 1 angka di belakang koma
        const displayValue = finalValue !== null
          ? (Number.isInteger(finalValue) ? finalValue.toString() : finalValue.toFixed(1))
          : '-';
        return (
          <div 
            className={`flex h-full w-full items-center justify-center rounded border font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ${colorClass || getGradeTableAverageCellTone(activeTableColorScheme)}`}
            style={{ fontSize: `${13 * zoomFactor}px` }}
          >
            {displayValue}
          </div>
        );
      }

      case 'status': {
        const status = avg?.final !== null
          ? avg.final > kkm + 5 ? 'pass' : avg.final >= kkm ? 'warning' : 'fail'
          : null;
        if (!status) return null;
        return (
          <div className="flex items-center justify-center w-full">
            <Badge 
              variant={status as 'pass' | 'warning' | 'fail'} 
              style={{ fontSize: `${10 * zoomFactor}px`, padding: `${2 * zoomFactor}px ${6 * zoomFactor}px` }}
            >
              {status === 'pass' ? 'Lulus' : status === 'warning' ? 'Cukup' : 'Belum'}
            </Badge>
          </div>
        );
      }

      default:
        return null;
    }
  }, [activeTableColorScheme, editingCell, editValue, studentAverages, getGradeValue, savingGrades, kkm, zoomFactor, saveEdit, getTextAlign]);

  // Render a single cell - matching template style
  const renderCell = useCallback((rowIndex: number, colIndex: number, isFrozenCol: boolean) => {
    const student = students[rowIndex];
    const column = columns[colIndex];
    if (!student || !column) return null;

    const cellKey = `${rowIndex}-${colIndex}`;
    const width = getColWidth(colIndex);
    const height = getRowHeight(rowIndex);
    const isEditing = editingCell === cellKey;
    const isEditable = ['assignment', 'sts', 'sas'].includes(column.type);
    const isFrozenCell = frozenColumns.has(colIndex);
    const isAverageColumn = column.type === 'chapter_avg';
    const isRowHovered = hoveredRowIndex === rowIndex && !isEditing;
    const isColumnHovered = hoveredColumnIndex === colIndex && !isEditing;
    const isColumnResizing = resizeFeedback?.colIndex === colIndex;
    const isCrossHovered = isRowHovered && isColumnHovered;
    const tableTouchAction = isEditing ? 'none' : isFrozenCol ? 'none' : 'pan-x pan-y';
    const columnBodyTone = getColumnBodyTone(column, activeTableColorScheme);
    const defaultBackground = isFrozenCell
      ? 'bg-primary/5'
      : columnBodyTone || (rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20');
    const rowHoverBackground = isAverageColumn
      ? 'bg-fuchsia-50/95 border-fuchsia-300/90 ring-1 ring-inset ring-fuchsia-200/80 dark:bg-fuchsia-950/45 dark:border-fuchsia-700/80 dark:ring-fuchsia-800/70'
      : isFrozenCell
      ? 'bg-fuchsia-100/80 border-fuchsia-300/90 dark:bg-fuchsia-950/45 dark:border-fuchsia-700/80'
      : 'bg-fuchsia-50/90 border-fuchsia-300/80 ring-1 ring-inset ring-fuchsia-200/80 dark:bg-fuchsia-950/35 dark:border-fuchsia-700/70 dark:ring-fuchsia-800/60';
    const columnHoverBackground = isAverageColumn
      ? 'bg-fuchsia-50/95 border-fuchsia-300/90 ring-1 ring-inset ring-fuchsia-200/80 dark:bg-fuchsia-950/45 dark:border-fuchsia-700/80 dark:ring-fuchsia-800/70'
      : isFrozenCell
      ? 'bg-fuchsia-100/75 border-fuchsia-300/80 dark:bg-fuchsia-950/40 dark:border-fuchsia-700/70'
      : 'bg-fuchsia-50/75 border-fuchsia-300/70 ring-1 ring-inset ring-fuchsia-200/70 dark:bg-fuchsia-950/30 dark:border-fuchsia-700/60 dark:ring-fuchsia-800/50';
    const crossHoverBackground = isAverageColumn
      ? 'bg-fuchsia-100/95 border-fuchsia-400/90 ring-2 ring-inset ring-fuchsia-300/80 dark:bg-fuchsia-950/55 dark:border-fuchsia-700 dark:ring-fuchsia-800'
      : 'bg-fuchsia-100/95 border-fuchsia-400/90 ring-2 ring-inset ring-fuchsia-300/80 dark:bg-fuchsia-950/55 dark:border-fuchsia-700 dark:ring-fuchsia-800';

    // Use correct position function based on frozen state
    const left = isFrozenCol ? getFrozenColLeft(colIndex) : getNonFrozenColLeft(colIndex);
    const top = getRowTop(rowIndex);

    return (
      <div
        key={cellKey}
        data-cellkey={cellKey}
        onClick={() => handleCellClick(rowIndex, colIndex)}
        onTouchStart={(e) => {
          if (isEditable && !scrollLockMode) handleCellLongPress(e, rowIndex, colIndex);
        }}
        onTouchEnd={handleCellTouchEnd}
        onTouchCancel={handleCellTouchEnd}
        onMouseEnter={(e) => {
          setHoveredRowIndex(rowIndex);
          setHoveredColumnIndex(colIndex);
          if (isEditable && !isEditing) handleCellMouseEnter(e, rowIndex, colIndex);
        }}
        onMouseLeave={() => handleCellMouseLeave(rowIndex)}
        style={{
          position: 'absolute',
          left: left,
          top: top,
          width: width * zoomFactor,
          height: height * zoomFactor,
          padding: isEditing ? 0 : `${4 * zoomFactor}px`,
          touchAction: tableTouchAction,
          userSelect: isEditing ? 'text' : 'none',
          boxSizing: 'border-box',
        }}
        className={`border border-border/40 flex items-center transition-colors ${
          isEditing ? 'bg-primary/10 ring-2 ring-primary z-10' : 
          isColumnResizing ? 'bg-primary/10 ring-1 ring-inset ring-primary/35' :
          isCrossHovered ? crossHoverBackground :
          isRowHovered ? rowHoverBackground :
          isColumnHovered ? columnHoverBackground :
          defaultBackground
        } ${isEditable && !isEditing && !scrollLockMode ? 'cursor-pointer' : ''} ${scrollLockMode ? 'cursor-grab' : ''}`}
      >
        {renderCellContent(student, column, rowIndex, colIndex)}
      </div>
    );
  }, [activeTableColorScheme, students, columns, getColWidth, getRowHeight, getFrozenColLeft, getNonFrozenColLeft, getRowTop, editingCell, hoveredRowIndex, hoveredColumnIndex, resizeFeedback?.colIndex, zoomFactor, handleCellClick, renderCellContent, frozenColumns, scrollLockMode, handleCellLongPress, handleCellTouchEnd, handleCellMouseEnter, handleCellMouseLeave]);

  // Render header cell - centered, no lock buttons
  const renderHeaderCell = useCallback((colIndex: number, isFrozen: boolean) => {
    const column = columns[colIndex];
    if (!column) return null;

    const width = getColWidth(colIndex);
    const left = isFrozen ? getFrozenColLeft(colIndex) : getNonFrozenColLeft(colIndex);
    const isFrozenCol = frozenColumns.has(colIndex);
    const isColumnHovered = hoveredColumnIndex === colIndex;
    const isColumnResizing = resizeFeedback?.colIndex === colIndex;
    const isMergedStandaloneHeader = chapters.length > 0 && !isFrozen && isStandaloneFinalColumn(column);

    if (isMergedStandaloneHeader) return null;

    return (
      <div
        key={`header-${colIndex}`}
        data-grade-header-tooltip={getGradeHeaderTooltip(column.label)}
        title={getGradeHeaderTooltip(column.label)}
        aria-label={getGradeHeaderTooltip(column.label)}
        className={`absolute flex items-center justify-center border font-bold text-center ${
          getColumnHeaderTone(column, activeTableColorScheme)
        } ${isFrozenCol ? 'ring-1 ring-inset ring-primary/35' : ''} ${
          isColumnHovered ? 'ring-2 ring-inset ring-primary/45 brightness-[0.98]' : ''
        } ${isColumnResizing ? 'sipena-grade-column-resizing ring-2 ring-inset ring-primary/70' : ''
        }`}
        style={{
          left: left,
          top: 0,
          width: width * zoomFactor,
          height: HEADING_HEIGHT * zoomFactor,
        }}
      >
        {/* Freeze indicator icon for frozen columns */}
        {isFrozenCol && (
          <Snowflake 
            className="absolute top-1 left-1 text-primary/60" 
            style={{ width: `${10 * zoomFactor}px`, height: `${10 * zoomFactor}px` }}
          />
        )}
        <span 
          className="truncate px-1 text-center w-full"
          style={{ fontSize: `${11 * zoomFactor}px` }}
        >
          {column.label}
        </span>

        {/* Resize handle - only if format is not locked */}
        {!formatLocked && renderResizeHandle(colIndex)}
      </div>
    );
  }, [activeTableColorScheme, chapters.length, columns, getColWidth, getFrozenColLeft, getNonFrozenColLeft, frozenColumns, hoveredColumnIndex, resizeFeedback?.colIndex, zoomFactor, renderResizeHandle, formatLocked]);

  // Calculate header positions for when no columns are frozen
  // This ensures BAB headers maintain their position relative to their columns
  const getColumnLeftFromStart = useCallback((colIndex: number): number => {
    let left = 0;
    for (let i = 0; i < colIndex; i++) {
      left += getColWidth(i) * zoomFactor;
    }
    return left;
  }, [getColWidth, zoomFactor]);

  // Render chapter header row - FIXED: consistent header layout regardless of frozen columns
  const renderChapterHeaders = useCallback(() => {
    if (chapters.length === 0) return null;

    const frozenWidth = getFrozenWidth();
    // Calculate where non-frozen content starts (which columns are before the scrollable area)
    const firstNonFrozenColIndex = nonFrozenColumns.length > 0 ? nonFrozenColumns[0] : columns.length;

    // Calculate offset for non-frozen headers (position of first non-frozen column from absolute start)
    let nonFrozenStartOffset = 0;
    for (let i = 0; i < firstNonFrozenColIndex; i++) {
      if (!frozenColumns.has(i)) {
        nonFrozenStartOffset += getColWidth(i) * zoomFactor;
      }
    }

    return (
      <div
        className="absolute top-0 left-0 right-0 z-50 bg-primary/5"
        style={{ height: CHAPTER_HEADER_HEIGHT * zoomFactor }}
      >
        {/* Fixed area header - always shows "Data Siswa" placeholder to maintain alignment */}
        {frozenWidth > 0 ? (
          <div 
            className="absolute top-0 left-0 bg-muted border-r border-border flex items-center justify-center"
            data-grade-header-tooltip="Data Siswa"
            title="Data Siswa"
            aria-label="Data Siswa"
            style={{ 
              width: frozenWidth, 
              height: CHAPTER_HEADER_HEIGHT * zoomFactor 
            }}
          >
            {(sortedFrozenColumns.includes(0) || sortedFrozenColumns.includes(1)) && (
              <span style={{ fontSize: `${11 * zoomFactor}px` }} className="font-bold text-muted-foreground text-center">
                Data Siswa
              </span>
            )}
          </div>
        ) : (
          // When no frozen columns, add invisible spacer for columns 0 & 1 (No, Nama) that scrolls with content
          <div 
            className="absolute top-0 overflow-hidden bg-muted"
            style={{ 
              left: 0, 
              right: 0,
              height: CHAPTER_HEADER_HEIGHT * zoomFactor 
            }}
          >
            <div 
              ref={chapterDataSiswaTranslationRef}
              className="relative"
            >
              {/* Data Siswa header for No and Nama columns */}
              <div
                className="absolute top-0 flex items-center justify-center bg-muted border-r border-border font-bold text-muted-foreground text-center"
                data-grade-header-tooltip="Data Siswa"
                title="Data Siswa"
                aria-label="Data Siswa"
                style={{
                  left: 0,
                  width: (getColWidth(0) + getColWidth(1)) * zoomFactor,
                  height: CHAPTER_HEADER_HEIGHT * zoomFactor,
                  fontSize: `${11 * zoomFactor}px`,
                }}
              >
                Data Siswa
              </div>
            </div>
          </div>
        )}

        {/* Chapter headers - scrollable area */}
        <div 
          className="pointer-events-none absolute top-0 overflow-hidden"
          style={{ 
            left: frozenWidth, 
            right: 0,
            height: totalHeaderHeight * zoomFactor
          }}
        >
          <div 
            ref={chapterHeadersTranslationRef}
            className="relative"
          >
            {/* When no frozen columns, show Data Siswa header first */}
            {frozenWidth === 0 && (
              <div
                className="absolute top-0 flex items-center justify-center bg-muted border-r border-border font-bold text-muted-foreground text-center"
                data-grade-header-tooltip="Data Siswa"
                title="Data Siswa"
                aria-label="Data Siswa"
                style={{
                  left: 0,
                  width: (getColWidth(0) + getColWidth(1)) * zoomFactor,
                  height: CHAPTER_HEADER_HEIGHT * zoomFactor,
                  fontSize: `${11 * zoomFactor}px`,
                }}
              >
                Data Siswa
              </div>
            )}

            {chapterHeaders.map((header) => {
              // Calculate width of chapter header (only non-frozen columns)
              let width = 0;
              for (let i = header.startIdx; i <= header.endIdx; i++) {
                if (!frozenColumns.has(i)) {
                  width += getColWidth(i) * zoomFactor;
                }
              }
              
              // Calculate left position - account for non-frozen columns before this chapter
              let left = 0;
              // When no frozen columns, start after "Data Siswa" area
              if (frozenWidth === 0) {
                left = (getColWidth(0) + getColWidth(1)) * zoomFactor;
              }
              // Add widths of all non-frozen columns between the start and this chapter
              for (let i = (frozenWidth === 0 ? 2 : 2); i < header.startIdx; i++) {
                if (!frozenColumns.has(i)) {
                  left += getColWidth(i) * zoomFactor;
                }
              }

              if (width <= 0) return null;
              const isChapterHovered = hoveredColumnIndex !== null && hoveredColumnIndex >= header.startIdx && hoveredColumnIndex <= header.endIdx;

              return (
                <div
                  key={header.chapterId}
                  data-grade-header-tooltip={getGradeHeaderTooltip(header.chapterName, "Header BAB")}
                  title={getGradeHeaderTooltip(header.chapterName, "Header BAB")}
                  aria-label={getGradeHeaderTooltip(header.chapterName, "Header BAB")}
                  className={`absolute top-0 flex items-center justify-center border-r font-bold text-center ${getChapterTone(activeTableColorScheme, header.chapterIndex).header} ${
                    isChapterHovered ? 'ring-2 ring-inset ring-primary/40 brightness-[0.98]' : ''
                  }`}
                  style={{
                    left: left,
                    width: width,
                    height: CHAPTER_HEADER_HEIGHT * zoomFactor,
                    fontSize: `${11 * zoomFactor}px`,
                  }}
                >
                  {header.chapterName}
                </div>
              );
            })}

            {/* STS, SAS, Rapor, Status headers */}
            {(() => {
              const lastChapterEnd = chapterHeaders.length > 0 
                ? chapterHeaders[chapterHeaders.length - 1].endIdx + 1
                : 2;

              const extraCols = columns.slice(lastChapterEnd);
              return extraCols.map((column, i) => {
                const colIdx = lastChapterEnd + i;
                if (frozenColumns.has(colIdx) || !isStandaloneFinalColumn(column)) return null;
                const isColumnHovered = hoveredColumnIndex === colIdx;

                return (
                  <div
                    key={`final-header-${column.id}`}
                    data-grade-header-tooltip={getGradeHeaderTooltip(column.label)}
                    title={getGradeHeaderTooltip(column.label)}
                    aria-label={getGradeHeaderTooltip(column.label)}
                    className={`pointer-events-auto absolute top-0 flex items-center justify-center border-r border-b font-bold text-center ${getColumnHeaderTone(column, activeTableColorScheme)} ${
                      isColumnHovered ? 'ring-2 ring-inset ring-primary/45 brightness-[0.98]' : ''
                    }`}
                    style={{
                      left: getNonFrozenColLeft(colIdx),
                      width: getColWidth(colIdx) * zoomFactor,
                      height: totalHeaderHeight * zoomFactor,
                      fontSize: `${11 * zoomFactor}px`,
                    }}
                  >
                    {column.label}
                    {!formatLocked && renderResizeHandle(colIdx)}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    );
  }, [activeTableColorScheme, chapters.length, chapterHeaders, columns, frozenColumns, formatLocked, hoveredColumnIndex, nonFrozenColumns, sortedFrozenColumns, getColWidth, getFrozenWidth, getNonFrozenColLeft, renderResizeHandle, totalHeaderHeight, zoomFactor]);

  const fullscreenViewportHeight =
    fullscreenMode === "maximal"
      ? "min(100dvh, var(--sipena-visual-viewport-height, 100dvh))"
      : "100dvh";

  // Check if browser orientation has natively rotated the viewport to landscape
  const isNativelyRotated = typeof window !== "undefined" && 
    (nativeOrientation ? nativeOrientation.startsWith("landscape") : (
      !!screen.orientation && screen.orientation.type.startsWith("landscape")
    ));

  const rotationClass = isFullscreen
    ? (isNativelyRotated 
        ? 'fixed inset-0 z-[9999]' 
        : (rotationState === 'left' 
            ? 'sipena-layout-rotated-right' 
            : rotationState === 'right' 
              ? 'sipena-layout-rotated-left' 
              : 'fixed inset-0 z-[9999]'
          )
      )
    : 'h-full';

  return (
    <div 
      ref={containerRef}
      className={`sipena-grade-spreadsheet flex flex-col bg-background select-none ${rotationClass} ${fullscreenMode === "maximal" ? "sipena-grade-maximal-fullscreen" : ""}`}
      style={{
        ...(isFullscreen && (rotationState === 'none' || isNativelyRotated) && {
          width: '100vw',
          height: fullscreenViewportHeight,
          maxHeight: fullscreenViewportHeight,
        }),
      }}
    >
      {/* Toolbar - matching template style */}
      <div
        data-tour="grade-toolbar"
        className={`sipena-grade-toolbar ${isFullscreen ? 'sipena-grade-toolbar--fullscreen' : ''} flex-shrink-0 border-b bg-card px-3 py-2 sm:px-4 sm:py-3 flex flex-nowrap items-center justify-between gap-2`}
        onPointerDownCapture={handleToolbarPointerDownCapture}
        onPointerMoveCapture={handleToolbarPointerMoveCapture}
        onPointerUpCapture={handleToolbarPointerEndCapture}
        onPointerCancelCapture={handleToolbarPointerEndCapture}
        onClickCapture={handleToolbarClickCapture}
      >
        <div className="sipena-grade-toolbar-format flex min-w-0 flex-nowrap items-center gap-1.5 lg:gap-2">
          {/* Freeze Menu Toggle */}
          <Button
            data-tour="grade-freeze-control"
            ref={freezeMenuTriggerRef}
            variant={showFreezeMenu ? "default" : "outline"}
            size="sm"
            onClick={() => !formatLocked && setShowFreezeMenu(!showFreezeMenu)}
            className={`gap-1.5 lg:gap-2 h-9 lg:h-10 px-2.5 lg:px-3 ${formatLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={formatLocked}
            style={{ minWidth: 40, touchAction: 'manipulation' }}
          >
            <Columns3 className="w-4 h-4" />
            <span className="sipena-grade-action-text hidden lg:inline">Bekukan</span>
          </Button>

          {/* Protection split button */}
          <div data-tour="grade-protection-control" className={`sipena-protection-split flex items-stretch rounded-lg border border-input bg-background overflow-hidden ${formatLocked || scrollLockMode ? 'sipena-protection-split--active' : ''}`}>
            <Button
              variant={formatLocked || scrollLockMode ? "default" : "ghost"}
              size="sm"
              onClick={handleProtectionButtonClick}
              className="gap-1.5 lg:gap-2 h-9 lg:h-10 rounded-none border-0 px-2.5 lg:px-3"
              title="Aktifkan proteksi penuh: kunci tata letak dan mode navigasi"
              style={{ minWidth: 40, touchAction: 'manipulation' }}
            >
              <ProtectionModeIcon className="w-4 h-4" />
              <span className="sipena-grade-action-text hidden lg:inline">{protectionModeMeta.label}</span>
            </Button>
            <DropdownMenu
              open={showProtectionMenu}
              onOpenChange={(nextOpen) => handleToolbarDropdownOpenChange(setShowProtectionMenu, nextOpen)}
            >
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant={formatLocked || scrollLockMode ? "default" : "ghost"}
                  size="sm"
                  className="h-9 lg:h-10 w-9 lg:w-10 rounded-none border-0 border-l border-border/50 px-0"
                  title="Pilih mode proteksi spreadsheet"
                  onPointerDown={protectionDropdownTapGuard.onPointerDown}
                  onPointerMove={protectionDropdownTapGuard.onPointerMove}
                  onPointerCancel={protectionDropdownTapGuard.onPointerCancel}
                  onPointerUp={protectionDropdownTapGuard.onPointerUp}
                  onClick={protectionDropdownTapGuard.onClick}
                  style={{ touchAction: 'pan-x pan-y' }}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={6} className="sipena-protection-menu w-72 max-w-[calc(100vw-1rem)]">
                <DropdownMenuRadioGroup value={protectionMode} onValueChange={(value) => applyProtectionMode(value as ProtectionMode)}>
                <DropdownMenuRadioItem value="full" className="sipena-protection-item flex items-start gap-2 py-2.5 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary">
                  <Shield className="w-4 h-4 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium">Proteksi Penuh</p>
                    <p className="sipena-protection-item-description text-xs text-muted-foreground">Kunci tata letak sekaligus aktifkan mode navigasi.</p>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="layout" className="sipena-protection-item flex items-start gap-2 py-2.5 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary">
                  <Lock className="w-4 h-4 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium">Kunci Tata Letak</p>
                    <p className="sipena-protection-item-description text-xs text-muted-foreground">Bekukan format spreadsheet tanpa mengaktifkan mode navigasi.</p>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="navigate" className="sipena-protection-item flex items-start gap-2 py-2.5 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary">
                  <Hand className="w-4 h-4 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium">Mode Navigasi</p>
                    <p className="sipena-protection-item-description text-xs text-muted-foreground">Nonaktifkan edit sel agar gulir spreadsheet lebih leluasa.</p>
                  </div>
                </DropdownMenuRadioItem>
                <DropdownMenuSeparator />
                <DropdownMenuRadioItem value="off" className="sipena-protection-item flex items-center gap-2 py-2.5 data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary">
                  <LockOpen className="h-4 w-4" /> Buka Semua Proteksi
                </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Undo/Redo */}
          <Button
            variant="outline"
            size="icon"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="h-9 w-9 lg:h-10 lg:w-10"
            style={{ touchAction: 'manipulation' }}
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="h-9 w-9 lg:h-10 lg:w-10"
            style={{ touchAction: 'manipulation' }}
          >
            <Redo2 className="w-4 h-4" />
          </Button>

          {/* Reset */}
          <Button
            variant="outline"
            size="icon"
            onClick={handleReset}
            disabled={formatLocked}
            title="Reset semua pengaturan"
            className={`h-9 w-9 lg:h-10 lg:w-10 ${formatLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          {isFullscreen && fullscreenTourKey && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 lg:h-10 lg:w-10"
              onClick={() => triggerTour(fullscreenTourKey)}
              title="Panduan toolbar fullscreen"
              aria-label="Buka panduan toolbar fullscreen"
              style={{ touchAction: 'manipulation' }}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          )}

          {/* toolbarFormatSuffix: slot tambahan antara help & close (diisi dari luar, mis. rounding button) */}
          {isFullscreen && toolbarFormatSuffix && (
            <div className="sipena-grade-toolbar-format-suffix flex-1 min-w-0">
              {toolbarFormatSuffix}
            </div>
          )}

          {isFullscreen && (
            <Button
              variant="destructive"
              size="icon"
              onClick={onClose}
              aria-label="Tutup fullscreen"
              className="sipena-grade-close-button ml-auto h-9 w-9 shadow-md sm:hidden"
              style={{ touchAction: 'manipulation' }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Right side - Zoom, Rotate & Search */}
        <div className="sipena-grade-toolbar-view flex min-w-0 flex-nowrap items-center gap-1.5 lg:gap-2 justify-end">
          {/* Zoom Controls - matching template */}
          <div data-tour="grade-zoom-control" className={`sipena-grade-zoom-control flex items-center gap-1 bg-muted rounded-lg p-1 ${formatLocked ? 'opacity-50' : ''}`}>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleZoomOut}
              disabled={formatLocked}
              style={{ touchAction: 'manipulation' }}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1 px-1">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={zoomInput}
                onChange={handleZoomInputChange}
                onBlur={handleZoomInputBlur}
                onKeyDown={handleZoomInputKeyDown}
                disabled={formatLocked}
                className="w-10 text-center bg-transparent border-none outline-none text-xs lg:text-sm font-medium disabled:cursor-not-allowed"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleZoomIn}
              disabled={formatLocked}
              style={{ touchAction: 'manipulation' }}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* Rotate Control - fullscreen mode only (with Flaticon layout and tilt auto-detection / manual override) */}
          {isFullscreen && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Rotasi Layar"
                  className="sipena-grade-rotate-control h-9 w-9 flex-shrink-0"
                  style={{ touchAction: 'manipulation' }}
                >
                  <RotateDeviceIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setRotationState("left")} className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" /> Putar ke Kiri
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRotationState("right")} className="flex items-center gap-2">
                  <RotateCw className="h-4 w-4" /> Putar ke Kanan
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRotationState("none")} disabled={rotationState === "none"} className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4" /> Reset Portrait
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {toolbarExtra && (
            <div className="sipena-grade-toolbar-extra flex min-w-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
              {toolbarExtra}
            </div>
          )}

          {/* Fullscreen button for non-fullscreen mode */}
          {!isFullscreen && onEnterFullscreen && (
            onEnterBrowserFullscreen ? (
              <DropdownMenu
                open={showFullscreenMenu}
                onOpenChange={(nextOpen) => handleToolbarDropdownOpenChange(setShowFullscreenMenu, nextOpen)}
              >
                <DropdownMenuTrigger asChild>
                  <Button
                    data-tour="grade-fullscreen-control"
                    type="button"
                    variant="outline"
                    size="sm"
                    className="sipena-grade-fullscreen-trigger h-9 lg:h-10 gap-1.5 lg:gap-2 px-2.5 lg:px-3"
                    onPointerDown={fullscreenDropdownTapGuard.onPointerDown}
                    onPointerMove={fullscreenDropdownTapGuard.onPointerMove}
                    onPointerCancel={fullscreenDropdownTapGuard.onPointerCancel}
                    onPointerUp={fullscreenDropdownTapGuard.onPointerUp}
                    onClick={fullscreenDropdownTapGuard.onClick}
                    style={{ touchAction: 'pan-x pan-y' }}
                  >
                    <Maximize2 className="w-4 h-4" />
                    <span className="sipena-grade-fullscreen-label hidden lg:inline">Fullscreen</span>
                    <ChevronDown className="sipena-grade-fullscreen-chevron w-3 h-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="sipena-fullscreen-menu w-64 max-w-[calc(100vw-1rem)]">
                  <DropdownMenuItem onClick={onEnterFullscreen} className="sipena-fullscreen-menu-item min-h-[48px] items-start gap-2 py-2.5">
                    <Maximize2 className="mt-0.5 h-4 w-4" />
                    <div className="min-w-0">
                      <p className="font-medium">Layar Penuh Browser</p>
                      <p className="text-xs text-muted-foreground">Membuka Input Nilai lebih luas, tetapi tetap berada di dalam tampilan browser.</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onEnterBrowserFullscreen} className="sipena-fullscreen-menu-item min-h-[48px] items-start gap-2 py-2.5">
                    <Maximize2 className="mt-0.5 h-4 w-4" />
                    <div className="min-w-0">
                      <p className="font-medium">Layar Penuh Maksimal</p>
                      <p className="text-xs text-muted-foreground">Membuka Input Nilai memenuhi seluruh layar perangkat.</p>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onEnterFullscreen}
                className="h-9 lg:h-10 gap-1.5 lg:gap-2 px-2.5 lg:px-3"
                style={{ touchAction: 'manipulation' }}
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden lg:inline">Fullscreen</span>
              </Button>
            )
          )}

          {/* Desktop close button for fullscreen */}
          {isFullscreen && (
            <Button variant="destructive" size="sm" onClick={onClose} className="sipena-grade-close-button hidden h-8 sm:flex">
              <X className="sipena-grade-close-icon h-3.5 w-3.5 mr-1" />
              <span className="sipena-grade-close-text">Tutup</span>
            </Button>
          )}
        </div>
      </div>

      {/* Freeze Menu Dropdown - column freeze only */}
      {showFreezeMenu && !formatLocked && (
        <div ref={freezeMenuRef} className="sipena-freeze-menu sipena-scroll-chain-page absolute top-14 sm:top-16 left-2 sm:left-3 z-[120] bg-card rounded-lg shadow-xl border p-3 sm:p-4 max-h-96 overflow-y-auto w-72 sm:w-80">
          <div className="font-semibold mb-3 text-sm">Pilih Kolom Freeze</div>
          <div className="sipena-freeze-menu-grid grid grid-cols-3 sm:grid-cols-4 gap-2">
            {columns.slice(0, Math.min(16, columns.length)).map((col, i) => (
              <button
                key={i}
                onClick={() => toggleFreezeColumn(i)}
                className={`sipena-freeze-menu-option px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  frozenColumns.has(i)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                style={{ minWidth: 40, minHeight: 40, touchAction: 'manipulation' }}
              >
                {col.label.substring(0, 6)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Kolom yang di-freeze akan tetap terlihat saat menggulir tabel.
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="w-full mt-3"
            onClick={() => setShowFreezeMenu(false)}
            style={{ touchAction: 'manipulation' }}
          >
            Tutup
          </Button>
        </div>
      )}

      {/* Info Bar */}
      <div className="sipena-grade-info-bar flex items-center gap-2 overflow-x-auto border-b bg-muted/50 px-3 py-1.5 text-xs">
        {isFullscreen && (
          <Badge variant="pass" className="gap-1 flex-shrink-0 text-xs">
            <CheckCircle2 className="w-3 h-3" />
            Auto-Save
          </Badge>
        )}
        {formatLocked && scrollLockMode && (
          <Badge variant="warning" className="gap-1 flex-shrink-0 text-xs">
            <Shield className="w-3 h-3" />
            Proteksi Penuh
          </Badge>
        )}
        {formatLocked && !scrollLockMode && (
          <Badge variant="warning" className="gap-1 flex-shrink-0 text-xs">
            <Lock className="w-3 h-3" />
            Tata Letak Terkunci
          </Badge>
        )}
        {!formatLocked && scrollLockMode && (
          <Badge variant="default" className="gap-1 flex-shrink-0 text-xs bg-primary">
            <Hand className="w-3 h-3" />
            Mode Navigasi
          </Badge>
        )}
        {frozenColumns.size > 0 && (
          <Badge variant="outline" className="gap-1 flex-shrink-0 text-xs border-primary/50 text-primary">
            <Snowflake className="w-3 h-3" />
            {frozenColumns.size} Kolom Freeze
          </Badge>
        )}
        <span className="text-muted-foreground flex-shrink-0">
          {students.length} siswa • {chapters.length} BAB • KKM: {kkm}
        </span>
        {isFullscreen && (
          <span className="text-muted-foreground hidden sm:inline">
          {fullscreenMode === "maximal" ? "Layar penuh maksimal aktif • " : ""}
          {scrollLockMode
            ? 'Navigasi aktif • Geser spreadsheet dengan aman tanpa membuka edit sel'
            : formatLocked
              ? 'Tata letak terkunci • Gunakan dropdown Proteksi untuk ubah mode'
              : 'Klik = edit | Enter = simpan & pindah bawah | Ctrl+Z = undo'}
        </span>
        )}
      </div>

      {/* Spreadsheet Container - FIXED: proper touch scrolling for fullscreen */}
      <div
        className="flex-1 relative overflow-hidden"
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseLeave={() => {
          setHoveredRowIndex(null);
          setHoveredColumnIndex(null);
        }}
        style={{
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {resizeFeedback && (
          <div
            aria-hidden="true"
            className="sipena-grade-resize-guide pointer-events-none absolute inset-y-0 z-[80]"
            style={{ left: resizeFeedback.x }}
          >
            <span className="sipena-grade-resize-bubble">{resizeFeedback.width}px</span>
          </div>
        )}
        {/* Chapter Headers Row */}
        {renderChapterHeaders()}

        {/* Header Row - Frozen columns */}
        <div
          className="absolute z-40 bg-muted"
          style={{
            left: 0,
            top: (chapters.length > 0 ? CHAPTER_HEADER_HEIGHT : 0) * zoomFactor,
            width: getFrozenWidth(),
            height: HEADING_HEIGHT * zoomFactor,
          }}
        >
          {sortedFrozenColumns.map(colIndex => renderHeaderCell(colIndex, true))}
        </div>

        {/* Header Row - Non-frozen columns */}
        <div
          className="absolute z-30 bg-muted overflow-hidden"
          style={{
            left: getFrozenWidth(),
            right: 0,
            top: (chapters.length > 0 ? CHAPTER_HEADER_HEIGHT : 0) * zoomFactor,
            height: HEADING_HEIGHT * zoomFactor,
          }}
        >
          <div
            ref={headersTranslationRef}
            className="relative"
            style={{
              width: getNonFrozenWidth(),
            }}
          >
            {nonFrozenColumns.map(colIndex => renderHeaderCell(colIndex, false))}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="sipena-grade-header-shadow pointer-events-none absolute inset-x-0 z-[35]"
          style={{
            top: Math.max(0, totalHeaderHeight * zoomFactor - 1),
          }}
        />

        {/* Main Scrollable Area - FIXED: proper scroll for touch devices in fullscreen */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="sipena-grade-scroll sipena-scroll-chain-page absolute inset-x-0 bottom-0 overflow-auto"
          style={{
            top: totalHeaderHeight * zoomFactor,
            paddingLeft: getFrozenWidth(),
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            overscrollBehaviorY: 'auto',
            touchAction: 'pan-x pan-y',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <div
            className="relative"
            style={{
              height: getTotalHeight(),
              width: getNonFrozenWidth(),
              minHeight: '100%',
            }}
          >
            {/* Non-frozen cells */}
            {students.map((_, rowIndex) =>
              nonFrozenColumns.map(colIndex => renderCell(rowIndex, colIndex, false))
            )}
          </div>
        </div>

        {/* Frozen Columns Overlay */}
        {frozenColumns.size > 0 && (
          <div
            ref={frozenTouchLayerRef}
            onWheel={handleFrozenLayerWheel}
            className="sipena-grade-frozen-layer absolute z-20 bg-background"
            style={{
              left: 0,
              top: totalHeaderHeight * zoomFactor,
              bottom: 0,
              width: getFrozenWidth(),
              overflow: 'hidden',
              borderRight: '2px solid hsl(var(--primary))',
              boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
              pointerEvents: 'none',
              touchAction: 'pan-x pan-y',
            }}
          >
            <div
              ref={frozenColumnsTranslationRef}
              style={{
                position: 'relative',
                height: getTotalHeight(),
                width: '100%',
              }}
            >
              {students.map((_, rowIndex) =>
                sortedFrozenColumns.map(colIndex => renderCell(rowIndex, colIndex, true))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3 border-t bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="min-w-0">
          {scrollLockMode 
            ? 'Mode navigasi aktif • geser bebas tanpa membuka editor nilai'
            : 'Klik sel untuk edit • Enter untuk simpan • Pinch untuk zoom'
          }
        </span>
        
        <div className="flex items-center gap-3 flex-shrink-0">
          {isFullscreen && (
            <span className="hidden shrink-0 text-right font-medium sm:inline">
              {className} - {subjectName}
            </span>
          )}
          
          {/* Panduan Warna Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <button 
                type="button" 
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted px-2 py-0.5 rounded transition-colors border border-border/40 font-medium cursor-pointer select-none"
                style={{ touchAction: 'manipulation' }}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Panduan Warna
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md md:max-w-lg overflow-y-auto max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Panduan & Legenda Warna Tabel</DialogTitle>
                <DialogDescription>
                  Penjelasan sistem warna indikator nilai KKM dan kolom khusus pada Spreadsheet Nilai SIPENA.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-2 text-sm text-foreground">
                {/* Section 1: KKM */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Status Kelulusan (KKM: {kkm})
                  </h4>
                  <div className="space-y-2.5">
                    {/* Lulus */}
                    <div className="flex items-start gap-3">
                      <div className={`w-24 px-2 py-1 text-center font-semibold text-xs rounded border flex-shrink-0 ${getGradeColor(kkm + 10, kkm)}`}>
                        {kkm + 10}
                      </div>
                      <div>
                        <div className="font-medium text-emerald-600 dark:text-emerald-400">Lulus (Sangat Baik)</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Nilai &gt; {kkm + 5}. Nilai tuntas secara aman di atas batas minimum KKM.
                        </div>
                      </div>
                    </div>

                    {/* Cukup */}
                    <div className="flex items-start gap-3">
                      <div className={`w-24 px-2 py-1 text-center font-extrabold text-xs rounded border flex-shrink-0 ${getGradeColor(kkm + 2, kkm)}`}>
                        {kkm + 2}
                      </div>
                      <div>
                        <div className="font-medium text-yellow-600 dark:text-yellow-400">Cukup</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Nilai antara {kkm} hingga {kkm + 5}. Nilai tuntas tetapi mendekati batas KKM minimum.
                        </div>
                      </div>
                    </div>

                    {/* Belum Lulus */}
                    <div className="flex items-start gap-3">
                      <div className={`w-24 px-2 py-1 text-center font-black text-xs rounded border flex-shrink-0 ${getGradeColor(kkm - 5, kkm)}`}>
                        {kkm - 5}
                      </div>
                      <div>
                        <div className="font-medium text-red-600 dark:text-red-400">Belum Lulus</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Nilai &lt; {kkm}. Nilai di bawah KKM, siswa memerlukan program pembelajaran remedial.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Special Columns */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                    Kolom Nilai Khusus
                  </h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Chapter Avg */}
                    <div className="flex items-center gap-2 rounded border p-2 bg-muted/20">
                      <div className={`w-12 h-6 flex items-center justify-center text-xs font-semibold rounded border ${getGradeTableAverageCellTone(activeTableColorScheme)}`}>
                        85
                      </div>
                      <div>
                        <div className="font-medium text-xs">Rata-rata BAB</div>
                        <div className="text-[10px] text-muted-foreground">Nilai rata-rata tugas per BAB</div>
                      </div>
                    </div>

                    {/* STS */}
                    <div className="flex items-center gap-2 rounded border p-2 bg-muted/20">
                      <div className={`w-12 h-6 flex items-center justify-center text-xs font-semibold rounded border ${getGradeTableColumnHeaderTone(activeTableColorScheme, { type: 'sts' })}`}>
                        82
                      </div>
                      <div>
                        <div className="font-medium text-xs">Nilai STS</div>
                        <div className="text-[10px] text-muted-foreground">Sumatif Tengah Semester</div>
                      </div>
                    </div>

                    {/* SAS */}
                    <div className="flex items-center gap-2 rounded border p-2 bg-muted/20">
                      <div className={`w-12 h-6 flex items-center justify-center text-xs font-semibold rounded border ${getGradeTableColumnHeaderTone(activeTableColorScheme, { type: 'sas' })}`}>
                        80
                      </div>
                      <div>
                        <div className="font-medium text-xs">Nilai SAS</div>
                        <div className="text-[10px] text-muted-foreground">Sumatif Akhir Semester</div>
                      </div>
                    </div>

                    {/* Rapor */}
                    <div className="flex items-center gap-2 rounded border p-2 bg-muted/20">
                      <div className={`w-12 h-6 flex items-center justify-center text-xs font-semibold rounded border ${getGradeTableColumnHeaderTone(activeTableColorScheme, { type: 'final' })}`}>
                        83
                      </div>
                      <div>
                        <div className="font-medium text-xs">Nilai Rapor</div>
                        <div className="text-[10px] text-muted-foreground">Hasil akhir kalkulasi rapor</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Active Theme Scheme */}
                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
                  <div className="font-semibold text-muted-foreground">Tema Tabel Aktif:</div>
                  <div className="font-medium text-foreground">
                    {activeTableColorScheme === "classic" ? "Setting A (Awal SIPENA)" : "Setting B (Warna Sekarang)"}
                  </div>
                  <div className="text-muted-foreground">
                    {activeTableColorScheme === "classic" 
                      ? "Menggunakan header BAB bernuansa biru klasik untuk tampilan ringan dan bersih."
                      : "Menggunakan kode warna khusus per BAB (biru, ungu, toska, dll.) untuk memudahkan navigasi horizontal."
                    }
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Grade Hint Popup for mobile long-press */}
      {GRADE_HINT_POPUP_ENABLED && hintPopup && !isFullscreen && (
        <GradeHintPopup
          isOpen={hintPopup.isOpen}
          onClose={closeHintPopup}
          position={hintPopup.position}
          studentName={hintPopup.studentName}
          kkm={kkm}
          currentValue={hintPopup.currentValue}
          targetType={hintPopup.targetType}
          chapterAvg={studentAverages[hintPopup.studentId]?.chaptersAvg}
          stsValue={getGradeValue(hintPopup.studentId, 'sts')}
          sasValue={getGradeValue(hintPopup.studentId, 'sas')}
        />
      )}
    </div>
  );
}
