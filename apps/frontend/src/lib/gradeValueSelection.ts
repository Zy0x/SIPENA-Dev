export interface GradeValueRecord {
  grade_type: string;
  assignment_id?: string | null;
  semester_id?: string | null;
  value: number | null;
}

interface GetScopedGradeValueOptions {
  gradeType: string;
  assignmentId?: string;
  semesterId?: string | null;
}

export function getScopedGradeValue(
  grades: GradeValueRecord[],
  { gradeType, assignmentId, semesterId }: GetScopedGradeValueOptions,
): number | null {
  const candidates = grades.filter(
    (grade) =>
      grade.grade_type === gradeType &&
      (assignmentId ? grade.assignment_id === assignmentId : !grade.assignment_id),
  );

  if (candidates.length === 0) {
    return null;
  }

  const selected = semesterId
    ? candidates.find((grade) => grade.semester_id === semesterId) ??
      candidates.find((grade) => !grade.semester_id)
    : candidates[0];

  return selected?.value ?? null;
}
