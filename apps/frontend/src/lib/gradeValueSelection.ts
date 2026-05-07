export interface GradeValueRecord {
  grade_type: string;
  assignment_id?: string | null;
  semester_id?: string | null;
  value: number | null;
  created_at?: string | null;
  updated_at?: string | null;
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

  const byNewest = (left: GradeValueRecord, right: GradeValueRecord) => {
    const leftTime = Date.parse(left.updated_at || left.created_at || "");
    const rightTime = Date.parse(right.updated_at || right.created_at || "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  };

  const selected = semesterId
    ? [...candidates.filter((grade) => grade.semester_id === semesterId)].sort(byNewest)[0] ??
      [...candidates.filter((grade) => !grade.semester_id)].sort(byNewest)[0]
    : [...candidates].sort(byNewest)[0];

  return selected?.value ?? null;
}
