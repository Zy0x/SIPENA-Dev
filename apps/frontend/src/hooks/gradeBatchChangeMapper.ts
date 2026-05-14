import type { BulkGradeInput } from "./useGrades";

export interface GradeBatchChangeInput {
  studentId: string;
  gradeType: string;
  assignmentId?: string;
  academicYearId?: string | null;
  semesterId?: string | null;
  value: number | null;
}

export function gradeBatchChangeToBulkInput(input: GradeBatchChangeInput, subjectId: string): BulkGradeInput {
  return {
    student_id: input.studentId,
    subject_id: subjectId,
    assignment_id: input.assignmentId,
    academic_year_id: input.academicYearId || undefined,
    semester_id: input.semesterId || undefined,
    grade_type: input.gradeType,
    value: input.value,
  };
}
