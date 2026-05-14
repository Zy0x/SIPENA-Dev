import { useState, useCallback, useRef, useEffect } from 'react';
import { useGrades, type BulkGradeInput, type GradeBatchChangedRow } from './useGrades';
import { useEnhancedToast } from '@/contexts/ToastContext';
import { gradeBatchChangeToBulkInput, type GradeBatchChangeInput } from './gradeBatchChangeMapper';

export type { GradeBatchChangeInput } from './gradeBatchChangeMapper';

interface GradeChange {
  studentId: string;
  subjectId?: string;
  gradeType: string;
  assignmentId?: string;
  academicYearId?: string | null;
  semesterId?: string | null;
  oldValue: number | null;
  newValue: number | null;
}

interface UndoState {
  past: GradeChange[][];
  future: GradeChange[][];
}

const MAX_HISTORY = 50;

function changeFromRpcRow(row: GradeBatchChangedRow): GradeChange {
  return {
    studentId: row.studentId,
    subjectId: row.subjectId,
    gradeType: row.gradeType,
    assignmentId: row.assignmentId || undefined,
    academicYearId: row.academicYearId,
    semesterId: row.semesterId,
    oldValue: row.oldValue,
    newValue: row.newValue,
  };
}

function changeToBulkInput(change: GradeChange, fallbackSubjectId: string, value: number | null): BulkGradeInput {
  return {
    student_id: change.studentId,
    subject_id: change.subjectId || fallbackSubjectId,
    assignment_id: change.assignmentId,
    academic_year_id: change.academicYearId || undefined,
    semester_id: change.semesterId || undefined,
    grade_type: change.gradeType,
    value,
  };
}

export function useGradesWithUndo(subjectId?: string, classId?: string) {
  const gradesHook = useGrades(subjectId, classId);
  const { info } = useEnhancedToast();
  
  const [undoState, setUndoState] = useState<UndoState>({
    past: [],
    future: [],
  });
  
  // Track if undo/redo is in progress to prevent recording
  const isUndoRedoInProgress = useRef(false);

  const recordUndoBatch = useCallback((changes: GradeChange[], message?: string) => {
    if (changes.length === 0 || isUndoRedoInProgress.current) return;
    setUndoState(prev => ({
      past: [...prev.past.slice(-MAX_HISTORY + 1), changes],
      future: [],
    }));
    if (message) {
      info("Import dapat di-undo", message);
    }
  }, [info]);

  // Enhanced save that tracks changes for undo
  const saveGradeWithUndo = useCallback(async (
    studentId: string,
    gradeType: string,
    value: number | null,
    assignmentId?: string
  ) => {
    if (!subjectId) return;
    
    // Get old value before saving
    const oldValue = gradesHook.getGradeValue(studentId, gradeType, assignmentId);
    
    // Don't record if value hasn't changed
    if (oldValue === value) {
      return;
    }
    
    // Save the value
    await gradesHook.upsertGrade.mutateAsync({
      student_id: studentId,
      subject_id: subjectId,
      assignment_id: assignmentId,
      grade_type: gradeType,
      value,
    });

    // Only record change after save succeeds and not from undo/redo
    if (!isUndoRedoInProgress.current) {
      recordUndoBatch([{
        studentId,
        subjectId,
        gradeType,
        assignmentId,
        academicYearId: gradesHook.activeYearId,
        semesterId: gradesHook.activeSemesterId,
        oldValue,
        newValue: value,
      }]);
    }
  }, [gradesHook, recordUndoBatch, subjectId]);

  const saveGradesBatchWithUndo = useCallback(async (
    inputs: GradeBatchChangeInput[],
  ): Promise<{ savedCount: number; skippedUnchangedCount: number }> => {
    if (!subjectId || inputs.length === 0) {
      return { savedCount: 0, skippedUnchangedCount: inputs.length };
    }

    const result = await gradesHook.upsertGradesBatch.mutateAsync(
      inputs.map((input) => gradeBatchChangeToBulkInput(input, subjectId)),
    );
    const changes = result.changedRows.map(changeFromRpcRow);

    recordUndoBatch(changes, `${changes.length} nilai dari import tersimpan sebagai satu riwayat undo.`);

    return { savedCount: result.savedCount, skippedUnchangedCount: result.skippedUnchangedCount };
  }, [gradesHook, recordUndoBatch, subjectId]);

  const undo = useCallback(async () => {
    if (undoState.past.length === 0 || !subjectId) return;
    
    isUndoRedoInProgress.current = true;
    const lastChanges = undoState.past[undoState.past.length - 1];
    
    try {
      await gradesHook.upsertGradesBatch.mutateAsync(
        lastChanges.map((change) => changeToBulkInput(change, subjectId, change.oldValue)),
      );
      
      setUndoState(prev => ({
        past: prev.past.slice(0, -1),
        future: [lastChanges, ...prev.future.slice(0, MAX_HISTORY - 1)],
      }));
      
      info("Undo berhasil", "Perubahan dikembalikan");
    } finally {
      isUndoRedoInProgress.current = false;
    }
  }, [undoState.past, gradesHook, subjectId, info]);

  const redo = useCallback(async () => {
    if (undoState.future.length === 0 || !subjectId) return;
    
    isUndoRedoInProgress.current = true;
    const nextChanges = undoState.future[0];
    
    try {
      await gradesHook.upsertGradesBatch.mutateAsync(
        nextChanges.map((change) => changeToBulkInput(change, subjectId, change.newValue)),
      );
      
      setUndoState(prev => ({
        past: [...prev.past.slice(-MAX_HISTORY + 1), nextChanges],
        future: prev.future.slice(1),
      }));
      
      info("Redo berhasil", "Perubahan diterapkan kembali");
    } finally {
      isUndoRedoInProgress.current = false;
    }
  }, [undoState.future, gradesHook, subjectId, info]);

  const canUndo = undoState.past.length > 0;
  const canRedo = undoState.future.length > 0;

  // Clear undo history when subject changes
  useEffect(() => {
    setUndoState({ past: [], future: [] });
  }, [subjectId]);

  return {
    ...gradesHook,
    saveGradeWithUndo,
    saveGradesBatchWithUndo,
    undo,
    redo,
    canUndo,
    canRedo,
  };
}
