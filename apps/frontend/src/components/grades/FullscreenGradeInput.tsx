import { SpreadsheetTable } from "./SpreadsheetTable";
import { FormulaSettings, CustomFormula } from "./FormulaSettings";
import type { Assignment } from "@/hooks/useAssignments";

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

interface FullscreenGradeInputProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  chapters: Chapter[];
  assignmentsByChapter: Record<string, Assignment[]>;
  studentAverages: Record<string, StudentAverage>;
  kkm: number;
  className: string;
  subjectName: string;
  getGradeValue: (studentId: string, gradeType: string, assignmentId?: string) => number | null;
  onSaveGrade: (studentId: string, gradeType: string, value: number | null, assignmentId?: string) => void;
  savingGrades: Set<string>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  formula: CustomFormula;
  onFormulaChange: (formula: CustomFormula) => void;
  // Undo/Redo support
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function FullscreenGradeInput({
  isOpen,
  onClose,
  students,
  chapters,
  assignmentsByChapter,
  studentAverages,
  kkm,
  className,
  subjectName,
  getGradeValue,
  onSaveGrade,
  savingGrades,
  searchQuery,
  onSearchChange,
  formula,
  onFormulaChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: FullscreenGradeInputProps) {
  if (!isOpen) return null;

  return (
    <SpreadsheetTable
      students={students}
      chapters={chapters}
      assignmentsByChapter={assignmentsByChapter}
      studentAverages={studentAverages}
      kkm={kkm}
      getGradeValue={getGradeValue}
      onSaveGrade={onSaveGrade}
      savingGrades={savingGrades}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      isFullscreen={true}
      onClose={onClose}
      className={className}
      subjectName={subjectName}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={onUndo}
      onRedo={onRedo}
    />
  );
}
