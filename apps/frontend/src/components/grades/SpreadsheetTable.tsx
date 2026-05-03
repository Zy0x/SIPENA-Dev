import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Columns3,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  CheckCircle2,
  Star,
  Undo2,
  Redo2,
  Shield,
  Lock,
  Hand,
  Snowflake,
  Target,
  Maximize2,
  ChevronDown,
} from "lucide-react";
import { getGradeColor } from "./GradeInputCell";
import { GradeHintPopup, HintTarget } from "./GradeHintPopup";
import type { Assignment } from "@/hooks/useAssignments";

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
  toolbarExtra?: React.ReactNode;
}

// Constants - matching template
const DEFAULT_COL_WIDTH = 80;
const DEFAULT_ROW_HEIGHT = 44;
const MIN_COL_WIDTH = 50;
const HEADING_HEIGHT = 40;
const CHAPTER_HEADER_HEIGHT = 32;
const INDEX_COL_WIDTH = 45;
const NAME_COL_WIDTH = 160;

interface ColumnDef {
  id: string;
  type: 'index' | 'name' | 'assignment' | 'chapter_avg' | 'sts' | 'sas' | 'final' | 'status';
  label: string;
  chapterId?: string;
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
  toolbarExtra,
}: SpreadsheetTableProps) {
  // State - based on template
  const [zoomLevel, setZoomLevel] = useState(100);
  const [zoomInput, setZoomInput] = useState('100');
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [frozenColumns, setFrozenColumns] = useState<Set<number>>(new Set([0, 1]));
  const [frozenRows, setFrozenRows] = useState<Set<number>>(new Set());
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showFreezeMenu, setShowFreezeMenu] = useState(false);
  const [freezeMenuType, setFreezeMenuType] = useState<'column' | 'row'>('column');
  // Auto-lock format in fullscreen mode
  const [formatLocked, setFormatLocked] = useState(false);
  // Scroll lock mode - disables cell editing for free scrolling on mobile
  const [scrollLockMode, setScrollLockMode] = useState(false);
  
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
  const resizingRef = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);
  const pinchRef = useRef({
    active: false,
    startDistance: 0,
    startZoom: 100,
  });
  const editInputRef = useRef<HTMLInputElement | null>(null);

  const zoomFactor = zoomLevel / 100;

  const protectionModeLabel = useMemo(() => {
    if (formatLocked && scrollLockMode) return 'Proteksi';
    if (formatLocked) return 'Tata Letak';
    if (scrollLockMode) return 'Navigasi';
    return 'Proteksi';
  }, [formatLocked, scrollLockMode]);

  const applyProtectionMode = useCallback((mode: 'full' | 'layout' | 'navigate' | 'off') => {
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
      { id: 'name', type: 'name', label: 'Nama Siswa', width: NAME_COL_WIDTH },
    ];

    chapters.forEach(chapter => {
      const assignments = assignmentsByChapter[chapter.id] || [];
      assignments.forEach(assignment => {
        cols.push({
          id: `assignment-${assignment.id}`,
          type: 'assignment',
          label: assignment.name,
          chapterId: chapter.id,
          assignmentId: assignment.id,
          width: DEFAULT_COL_WIDTH,
        });
      });
      cols.push({
        id: `chapter_avg-${chapter.id}`,
        type: 'chapter_avg',
        label: 'Avg',
        chapterId: chapter.id,
        width: 65,
      });
    });

    cols.push(
      { id: 'sts', type: 'sts', label: 'STS', width: DEFAULT_COL_WIDTH },
      { id: 'sas', type: 'sas', label: 'SAS', width: DEFAULT_COL_WIDTH },
      { id: 'final', type: 'final', label: 'Rapor', width: DEFAULT_COL_WIDTH },
      { id: 'status', type: 'status', label: 'Status', width: 85 }
    );

    return cols;
  }, [chapters, assignmentsByChapter]);

  // Build chapter headers for grouped display
  const chapterHeaders = useMemo(() => {
    const headers: { chapterId: string; chapterName: string; startIdx: number; endIdx: number }[] = [];
    let currentIdx = 2; // Start after No and Name

    chapters.forEach(chapter => {
      const assignments = assignmentsByChapter[chapter.id] || [];
      const startIdx = currentIdx;
      const endIdx = currentIdx + assignments.length; // Including avg column
      headers.push({
        chapterId: chapter.id,
        chapterName: chapter.name,
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
      top += DEFAULT_ROW_HEIGHT * zoomFactor;
    }
    return top;
  }, [sortedFrozenRows, zoomFactor]);

  const getNonFrozenRowTop = useCallback((rowIndex: number): number => {
    let top = 0;
    for (const nonFrozenRow of nonFrozenRowIndices) {
      if (nonFrozenRow === rowIndex) break;
      top += DEFAULT_ROW_HEIGHT * zoomFactor;
    }
    return top;
  }, [nonFrozenRowIndices, zoomFactor]);

  const getFrozenWidth = useCallback((): number => {
    return sortedFrozenColumns.reduce((sum, col) => sum + getColWidth(col) * zoomFactor, 0);
  }, [sortedFrozenColumns, getColWidth, zoomFactor]);

  const getFrozenHeight = useCallback((): number => {
    return sortedFrozenRows.length * DEFAULT_ROW_HEIGHT * zoomFactor;
  }, [sortedFrozenRows.length, zoomFactor]);

  const getTotalWidth = useCallback((): number => {
    return columns.reduce((sum, _, i) => sum + getColWidth(i) * zoomFactor, 0);
  }, [columns, getColWidth, zoomFactor]);

  const getTotalHeight = useCallback((): number => {
    return students.length * DEFAULT_ROW_HEIGHT * zoomFactor;
  }, [students.length, zoomFactor]);

  const getNonFrozenWidth = useCallback((): number => {
    return nonFrozenColumns.reduce((sum, i) => sum + getColWidth(i) * zoomFactor, 0);
  }, [nonFrozenColumns, getColWidth, zoomFactor]);

  const getNonFrozenHeight = useCallback((): number => {
    return nonFrozenRowIndices.length * DEFAULT_ROW_HEIGHT * zoomFactor;
  }, [nonFrozenRowIndices.length, zoomFactor]);

  // Simple row top calculation for non-frozen-row mode (current implementation)
  const getRowTop = useCallback((rowIndex: number): number => {
    return rowIndex * DEFAULT_ROW_HEIGHT * zoomFactor;
  }, [zoomFactor]);

  const totalHeaderHeight = (chapters.length > 0 ? CHAPTER_HEADER_HEIGHT : 0) + HEADING_HEIGHT;

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
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollLeft(target.scrollLeft);
    setScrollTop(target.scrollTop);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

    const tolerance = 1;
    const atTop = el.scrollTop <= tolerance;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - tolerance;
    const shouldReleaseToPage = (e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom);

    if (!shouldReleaseToPage) return;

    const pageScroller = document.querySelector<HTMLElement>("[data-app-scroll-container]");
    if (pageScroller && pageScroller.scrollHeight > pageScroller.clientHeight) {
      pageScroller.scrollBy({ top: e.deltaY, behavior: "auto" });
    } else {
      window.scrollBy({ top: e.deltaY, behavior: "auto" });
    }
    e.preventDefault();
  }, []);

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
    setScrollLeft(0);
    setScrollTop(0);
    setEditingCell(null);
    setEditValue('');
    setShowFreezeMenu(false);

    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [formatLocked]);

  // Column resize handlers - blocked when format is locked
  const handleResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent, colIndex: number) => {
    if (formatLocked) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = getColWidth(colIndex);

    resizingRef.current = { colIndex, startX, startWidth };

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
    };

    const handleEnd = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
  }, [getColWidth, zoomFactor, formatLocked]);

  // Touch handling for pinch zoom - blocked when format is locked
  const getDistance = useCallback((touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Hanya set state untuk pinch-zoom (2 jari). Jangan preventDefault di awal.
    if (e.touches.length === 2 && !formatLocked) {
      const distance = getDistance(e.touches[0], e.touches[1]);
      pinchRef.current = {
        active: true,
        startDistance: distance,
        startZoom: zoomLevel,
      };
    }
  }, [zoomLevel, getDistance, formatLocked]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
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
    // Reset pinch state
    pinchRef.current.active = false;
    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Show hint popup - for both long press (mobile) and hover (desktop fullscreen)
  const showHintForCell = useCallback((
    position: { x: number; y: number },
    rowIndex: number,
    colIndex: number
  ) => {
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
  }, [students, columns, showHintForCell]);

  // Hover handler for desktop fullscreen hint
  const hintHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeHintPopup = useCallback(() => {
    setHintPopup(null);
  }, []);
  
  const handleCellMouseEnter = useCallback((
    e: React.MouseEvent,
    rowIndex: number,
    colIndex: number
  ) => {
    // Only show hint on hover in fullscreen mode on desktop
    if (!isFullscreen || scrollLockMode) return;
    
    const student = students[rowIndex];
    const column = columns[colIndex];
    if (!student || !column || !['assignment', 'sts', 'sas'].includes(column.type)) return;
    if (editingCell === `${rowIndex}-${colIndex}`) return; // Don't show when editing

    // Clear existing timer
    if (hintHoverTimerRef.current) {
      clearTimeout(hintHoverTimerRef.current);
    }

    // Delay before showing hint (150ms for hover)
    hintHoverTimerRef.current = setTimeout(() => {
      const position = { x: e.clientX + 10, y: e.clientY + 10 };
      showHintForCell(position, rowIndex, colIndex);
    }, 150);
  }, [isFullscreen, scrollLockMode, students, columns, editingCell, showHintForCell]);

  const handleCellMouseLeave = useCallback(() => {
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
      setEditingCell(cellKey);
      const gradeType = column.type === 'assignment' ? 'assignment' : column.type;
      const value = getGradeValue(student.id, gradeType, column.assignmentId);
      setEditValue(value?.toString() || '');
      setPendingSaveValue(null);
    }
  }, [students, columns, getGradeValue]);

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
          <div className="flex items-center gap-1 min-w-0 w-full">
            {student.is_bookmarked && (
              <Star 
                className="text-amber-500 fill-amber-500 flex-shrink-0" 
                style={{ width: `${14 * zoomFactor}px`, height: `${14 * zoomFactor}px` }}
              />
            )}
            <div className="min-w-0 flex-1 overflow-hidden text-left">
              <div 
                className="font-medium truncate"
                style={{ fontSize: `${12 * zoomFactor}px`, lineHeight: `${16 * zoomFactor}px` }}
              >
                {student.name}
              </div>
              <div 
                className="text-muted-foreground truncate"
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

        const colorClass = value !== null ? getGradeColor(value, kkm) : '';
        // Format: integer tanpa desimal, desimal sesuai input user
        const displayValue = value !== null
          ? (Number.isInteger(value) ? value.toString() : value.toString())
          : '-';
        return (
          <div 
            className={`w-full h-full flex items-center justify-center font-medium rounded transition-colors cursor-pointer ${colorClass} ${isSaving ? 'opacity-50' : ''}`}
            style={{ fontSize: `${13 * zoomFactor}px` }}
          >
            {displayValue}
          </div>
        );
      }

      case 'chapter_avg': {
        const chapterAvg = avg?.chapterDetails[column.chapterId!];
        const colorClass = chapterAvg !== null ? getGradeColor(chapterAvg, kkm) : '';
        // Format: integer tanpa desimal, desimal dengan 1 angka di belakang koma
        const displayValue = chapterAvg !== null
          ? (Number.isInteger(chapterAvg) ? chapterAvg.toString() : chapterAvg.toFixed(1))
          : '-';
        return (
          <div 
            className={`flex items-center justify-center w-full font-semibold rounded ${colorClass || 'text-muted-foreground'}`}
            style={{ fontSize: `${12 * zoomFactor}px` }}
          >
            {displayValue}
          </div>
        );
      }

      case 'final': {
        const colorClass = avg?.final !== null ? getGradeColor(avg.final, kkm) : '';
        // Format: integer tanpa desimal, desimal dengan 1 angka di belakang koma
        const displayValue = avg?.final !== null
          ? (Number.isInteger(avg.final) ? avg.final.toString() : avg.final.toFixed(1))
          : '-';
        return (
          <div 
            className={`flex items-center justify-center w-full font-bold rounded ${colorClass || 'text-muted-foreground'}`}
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
  }, [editingCell, editValue, studentAverages, getGradeValue, savingGrades, kkm, zoomFactor, saveEdit, getTextAlign]);

  // Render a single cell - matching template style
  const renderCell = useCallback((rowIndex: number, colIndex: number, isFrozenCol: boolean) => {
    const student = students[rowIndex];
    const column = columns[colIndex];
    if (!student || !column) return null;

    const cellKey = `${rowIndex}-${colIndex}`;
    const width = getColWidth(colIndex);
    const height = DEFAULT_ROW_HEIGHT;
    const isEditing = editingCell === cellKey;
    const isEditable = ['assignment', 'sts', 'sas'].includes(column.type);
    const isFrozenCell = frozenColumns.has(colIndex);

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
          if (isEditable && !isEditing) handleCellMouseEnter(e, rowIndex, colIndex);
        }}
        onMouseLeave={handleCellMouseLeave}
        style={{
          position: 'absolute',
          left: left,
          top: top,
          width: width * zoomFactor,
          height: height * zoomFactor,
          padding: isEditing ? 0 : `${4 * zoomFactor}px`,
          touchAction: isEditing ? 'none' : 'auto',
          userSelect: isEditing ? 'text' : 'none',
          boxSizing: 'border-box',
        }}
        className={`border border-border/40 flex items-center transition-colors ${
          isEditing ? 'bg-primary/10 ring-2 ring-primary z-10' : 
          isFrozenCell ? 'bg-primary/5' :
          rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/20'
        } ${isEditable && !isEditing && !scrollLockMode ? 'cursor-pointer hover:bg-muted/40' : ''} ${scrollLockMode ? 'cursor-grab' : ''}`}
      >
        {renderCellContent(student, column, rowIndex, colIndex)}
      </div>
    );
  }, [students, columns, getColWidth, getFrozenColLeft, getNonFrozenColLeft, getRowTop, editingCell, zoomFactor, handleCellClick, renderCellContent, frozenColumns, scrollLockMode, handleCellLongPress, handleCellTouchEnd, handleCellMouseEnter, handleCellMouseLeave]);

  // Render header cell - centered, no lock buttons
  const renderHeaderCell = useCallback((colIndex: number, isFrozen: boolean) => {
    const column = columns[colIndex];
    if (!column) return null;

    const width = getColWidth(colIndex);
    const left = isFrozen ? getFrozenColLeft(colIndex) : getNonFrozenColLeft(colIndex);
    const isFrozenCol = frozenColumns.has(colIndex);

    return (
      <div
        key={`header-${colIndex}`}
        className={`absolute flex items-center justify-center border border-border/40 font-semibold text-center ${
          isFrozenCol ? 'bg-primary/15 border-primary/30' : 'bg-muted'
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
        {!formatLocked && (
          <div
            className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-primary/50 active:bg-primary touch-none z-10"
            onMouseDown={(e) => handleResizeStart(e, colIndex)}
            onTouchStart={(e) => handleResizeStart(e, colIndex)}
          />
        )}
      </div>
    );
  }, [columns, getColWidth, getFrozenColLeft, getNonFrozenColLeft, frozenColumns, zoomFactor, handleResizeStart, formatLocked]);

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
  const renderChapterHeaders = useCallback((scrollOffset: number) => {
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
        className="absolute top-0 left-0 right-0 z-30 bg-primary/5 border-b border-border"
        style={{ height: CHAPTER_HEADER_HEIGHT * zoomFactor }}
      >
        {/* Fixed area header - always shows "Data Siswa" placeholder to maintain alignment */}
        {frozenWidth > 0 ? (
          <div 
            className="absolute top-0 left-0 bg-muted border-r border-border flex items-center justify-center"
            style={{ 
              width: frozenWidth, 
              height: CHAPTER_HEADER_HEIGHT * zoomFactor 
            }}
          >
            {(sortedFrozenColumns.includes(0) || sortedFrozenColumns.includes(1)) && (
              <span style={{ fontSize: `${11 * zoomFactor}px` }} className="font-semibold text-muted-foreground text-center">
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
              className="relative"
              style={{ transform: `translateX(-${scrollOffset}px)` }}
            >
              {/* Data Siswa header for No and Nama columns */}
              <div
                className="absolute top-0 flex items-center justify-center bg-muted border-r border-border font-semibold text-muted-foreground text-center"
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
          className="absolute top-0 overflow-hidden"
          style={{ 
            left: frozenWidth, 
            right: 0,
            height: CHAPTER_HEADER_HEIGHT * zoomFactor 
          }}
        >
          <div 
            className="relative"
            style={{ transform: `translateX(-${scrollOffset}px)` }}
          >
            {/* When no frozen columns, show Data Siswa header first */}
            {frozenWidth === 0 && (
              <div
                className="absolute top-0 flex items-center justify-center bg-muted border-r border-border font-semibold text-muted-foreground text-center"
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

              return (
                <div
                  key={header.chapterId}
                  className="absolute top-0 flex items-center justify-center bg-primary/10 border-r border-border font-semibold text-primary text-center"
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
              
              let left = frozenWidth === 0 ? (getColWidth(0) + getColWidth(1)) * zoomFactor : 0;
              for (let i = 2; i < lastChapterEnd; i++) {
                if (!frozenColumns.has(i)) {
                  left += getColWidth(i) * zoomFactor;
                }
              }

              const extraCols = columns.slice(lastChapterEnd);
              let width = 0;
              extraCols.forEach((_, i) => {
                const colIdx = lastChapterEnd + i;
                if (!frozenColumns.has(colIdx)) {
                  width += getColWidth(colIdx) * zoomFactor;
                }
              });

              return width > 0 ? (
                <div
                  className="absolute top-0 flex items-center justify-center bg-muted border-r border-border font-semibold text-muted-foreground text-center"
                  style={{
                    left: left,
                    width: width,
                    height: CHAPTER_HEADER_HEIGHT * zoomFactor,
                    fontSize: `${11 * zoomFactor}px`,
                  }}
                >
                  Nilai Akhir
                </div>
              ) : null;
            })()}
          </div>
        </div>
      </div>
    );
  }, [chapters.length, chapterHeaders, columns, frozenColumns, nonFrozenColumns, sortedFrozenColumns, getColWidth, getFrozenWidth, zoomFactor]);

  return (
    <div 
      ref={containerRef}
      className={`flex flex-col bg-background select-none ${isFullscreen ? 'fixed inset-0 z-[9999]' : 'h-full'}`}
      style={{
        ...(isFullscreen && {
          width: '100vw',
          height: '100dvh', // Use dynamic viewport height for mobile
          maxHeight: '100dvh',
        }),
      }}
    >
      {/* Toolbar - matching template style */}
      <div className="flex items-start sm:items-center justify-between p-2 sm:p-3 bg-card border-b flex-wrap gap-2 sm:gap-3 flex-shrink-0">
        {/* Mobile close button - top right for fullscreen on mobile */}
        {isFullscreen && (
          <Button 
            variant="destructive" 
            size="icon" 
            onClick={onClose} 
            className="fixed top-2 right-2 z-[10000] h-10 w-10 sm:hidden shadow-lg"
            style={{ touchAction: 'manipulation' }}
          >
            <X className="w-5 h-5" />
          </Button>
        )}

        <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0">
          {/* Freeze Menu Toggle */}
          <Button
            variant={showFreezeMenu ? "default" : "outline"}
            size="sm"
            onClick={() => !formatLocked && setShowFreezeMenu(!showFreezeMenu)}
            className={`gap-1 sm:gap-2 h-9 sm:h-10 px-2.5 sm:px-3 ${formatLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={formatLocked}
            style={{ minWidth: 40, touchAction: 'manipulation' }}
          >
            <Columns3 className="w-4 h-4" />
            <span className="hidden sm:inline">Bekukan</span>
          </Button>

          {/* Protection split button */}
          <div className="flex items-stretch rounded-lg border border-input bg-background overflow-hidden">
            <Button
              variant={formatLocked || scrollLockMode ? "default" : "ghost"}
              size="sm"
              onClick={handleProtectionButtonClick}
              className="gap-1.5 sm:gap-2 h-9 sm:h-10 rounded-none border-0 px-2.5 sm:px-3"
              title="Aktifkan proteksi penuh: kunci tata letak dan mode navigasi"
              style={{ minWidth: 40, touchAction: 'manipulation' }}
            >
              {scrollLockMode ? <Hand className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              <span className="hidden sm:inline">{protectionModeLabel}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={formatLocked || scrollLockMode ? "default" : "ghost"}
                  size="sm"
                  className="h-9 sm:h-10 w-9 sm:w-10 rounded-none border-0 border-l border-border/50 px-0"
                  title="Pilih mode proteksi spreadsheet"
                  style={{ touchAction: 'manipulation' }}
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuItem onClick={() => applyProtectionMode('full')} className="flex items-start gap-2 py-2.5">
                  <Shield className="w-4 h-4 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium">Proteksi Penuh</p>
                    <p className="text-xs text-muted-foreground">Kunci tata letak sekaligus aktifkan mode navigasi.</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyProtectionMode('layout')} className="flex items-start gap-2 py-2.5">
                  <Lock className="w-4 h-4 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium">Kunci Tata Letak</p>
                    <p className="text-xs text-muted-foreground">Bekukan format spreadsheet tanpa mengaktifkan mode navigasi.</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyProtectionMode('navigate')} className="flex items-start gap-2 py-2.5">
                  <Hand className="w-4 h-4 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-medium">Mode Navigasi</p>
                    <p className="text-xs text-muted-foreground">Nonaktifkan edit sel agar gulir spreadsheet lebih leluasa.</p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => applyProtectionMode('off')} className="py-2.5">
                  Buka Semua Proteksi
                </DropdownMenuItem>
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
            className="h-9 w-9 sm:h-10 sm:w-10"
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
            className="h-9 w-9 sm:h-10 sm:w-10"
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
            title="Reset semua"
            className={`h-9 w-9 sm:h-10 sm:w-10 ${formatLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ touchAction: 'manipulation' }}
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Right side - Zoom & Search */}
        <div className="flex items-center gap-2 flex-wrap justify-end min-w-0 ml-auto">
          {toolbarExtra && (
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {toolbarExtra}
            </div>
          )}

          {/* Zoom Controls - matching template */}
          <div className={`flex items-center gap-1 bg-muted rounded-lg p-1 ${formatLocked ? 'opacity-50' : ''}`}>
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
                className="w-10 text-center bg-transparent border-none outline-none text-xs sm:text-sm font-medium disabled:cursor-not-allowed"
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

          {/* Fullscreen button for non-fullscreen mode */}
          {!isFullscreen && onEnterFullscreen && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onEnterFullscreen} 
              className="h-9 gap-1 px-2.5 sm:px-3"
              style={{ touchAction: 'manipulation' }}
            >
              <Maximize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Fullscreen</span>
            </Button>
          )}

          {/* Desktop close button for fullscreen */}
          {isFullscreen && (
            <Button variant="outline" size="sm" onClick={onClose} className="h-9 hidden sm:flex">
              <X className="w-4 h-4 mr-1" />
              Tutup
            </Button>
          )}
        </div>
      </div>

      {/* Freeze Menu Dropdown - column freeze only */}
      {showFreezeMenu && !formatLocked && (
        <div className="absolute top-14 sm:top-16 left-2 sm:left-3 z-50 bg-card rounded-lg shadow-xl border p-3 sm:p-4 max-h-96 overflow-y-auto w-72 sm:w-80">
          <div className="font-semibold mb-3 text-sm">Pilih Kolom Freeze</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {columns.slice(0, Math.min(16, columns.length)).map((col, i) => (
              <button
                key={i}
                onClick={() => toggleFreezeColumn(i)}
                className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
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
            variant="outline"
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
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b text-xs overflow-x-auto">
        <Badge variant="pass" className="gap-1 flex-shrink-0 text-xs">
          <CheckCircle2 className="w-3 h-3" />
          Auto-Save
        </Badge>
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
        <span className="text-muted-foreground hidden sm:inline">
          {scrollLockMode
            ? 'Navigasi aktif • Geser spreadsheet dengan aman tanpa membuka edit sel'
            : formatLocked
              ? 'Tata letak terkunci • Gunakan dropdown Proteksi untuk ubah mode'
              : 'Klik = edit | Enter = simpan & pindah bawah | Ctrl+Z = undo'}
        </span>
      </div>

      {/* Spreadsheet Container - FIXED: proper touch scrolling for fullscreen */}
      <div
        className="flex-1 relative overflow-hidden"
        style={{
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
      >
        {/* Chapter Headers Row */}
        {renderChapterHeaders(scrollLeft)}

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
            className="relative"
            style={{
              transform: `translateX(-${scrollLeft}px)`,
              width: getNonFrozenWidth(),
            }}
          >
            {nonFrozenColumns.map(colIndex => renderHeaderCell(colIndex, false))}
          </div>
        </div>

        {/* Main Scrollable Area - FIXED: proper scroll for touch devices in fullscreen */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="absolute inset-0 overflow-auto"
          style={{
            paddingTop: totalHeaderHeight * zoomFactor,
            paddingLeft: getFrozenWidth(),
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'auto',
            touchAction: 'manipulation',
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
            className="absolute z-20 bg-background"
            style={{
              left: 0,
              top: totalHeaderHeight * zoomFactor,
              bottom: 0,
              width: getFrozenWidth(),
              overflow: 'hidden',
              borderRight: '2px solid hsl(var(--primary))',
              boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
              pointerEvents: 'auto',
            }}
          >
            <div
              style={{
                position: 'relative',
                transform: `translateY(-${scrollTop}px)`,
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
      <div className="px-3 py-1.5 bg-muted/50 border-t text-xs text-muted-foreground flex items-center justify-between">
        <span>
          {scrollLockMode 
            ? 'Mode navigasi aktif • geser bebas tanpa membuka editor nilai'
            : 'Klik sel untuk edit • Enter untuk simpan • Pinch untuk zoom'
          }
        </span>
        {isFullscreen && (
          <span className="font-medium">
            {className} - {subjectName}
          </span>
        )}
      </div>

      {/* Grade Hint Popup for mobile long-press */}
      {hintPopup && (
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
