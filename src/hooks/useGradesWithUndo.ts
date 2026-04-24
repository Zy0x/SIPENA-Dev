import { useState, useCallback, useRef, useEffect } from 'react';
import { useGrades, BulkGradeInput } from './useGrades';
import { useEnhancedToast } from '@/contexts/ToastContext';

interface GradeChange {
  studentId: string;
  gradeType: string;
  assignmentId?: string;
  oldValue: number | null;
  newValue: number | null;
}

interface UndoState {
  past: GradeChange[][];
  future: GradeChange[][];
}

const MAX_HISTORY = 50;

export function useGradesWithUndo(subjectId?: string, classId?: string) {
  const gradesHook = useGrades(subjectId, classId);
  const { info } = useEnhancedToast();
  
  const [undoState, setUndoState] = useState<UndoState>({
    past: [],
    future: [],
  });
  
  // Track if undo/redo is in progress to prevent recording
  const isUndoRedoInProgress = useRef(false);

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
    
    // Only record change if not from undo/redo
    if (!isUndoRedoInProgress.current) {
      const change: GradeChange = {
        studentId,
        gradeType,
        assignmentId,
        oldValue,
        newValue: value,
      };
      
      setUndoState(prev => ({
        past: [...prev.past.slice(-MAX_HISTORY + 1), [change]],
        future: [], // Clear future on new change
      }));
    }
    
    // Save the value
    await gradesHook.upsertGrade.mutateAsync({
      student_id: studentId,
      subject_id: subjectId,
      assignment_id: assignmentId,
      grade_type: gradeType,
      value,
    });
  }, [gradesHook, subjectId]);

  const undo = useCallback(async () => {
    if (undoState.past.length === 0 || !subjectId) return;
    
    isUndoRedoInProgress.current = true;
    const lastChanges = undoState.past[undoState.past.length - 1];
    
    try {
      // Apply reverse changes
      for (const change of lastChanges) {
        await gradesHook.upsertGrade.mutateAsync({
          student_id: change.studentId,
          subject_id: subjectId,
          assignment_id: change.assignmentId,
          grade_type: change.gradeType,
          value: change.oldValue,
        });
      }
      
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
      // Apply changes again
      for (const change of nextChanges) {
        await gradesHook.upsertGrade.mutateAsync({
          student_id: change.studentId,
          subject_id: subjectId,
          assignment_id: change.assignmentId,
          grade_type: change.gradeType,
          value: change.newValue,
        });
      }
      
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
    undo,
    redo,
    canUndo,
    canRedo,
  };
}