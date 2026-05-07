import { calculateReportGrade, DEFAULT_FORMULA, type CustomFormula } from "@/lib/gradeFormula";
import { getScopedGradeValue } from "@/lib/gradeValueSelection";

export interface ReportGradeRecord {
  student_id: string;
  subject_id: string;
  assignment_id: string | null;
  grade_type: string;
  value: number | null;
  semester_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ReportChapterRecord {
  id: string;
  subject_id: string;
  semester_id?: string | null;
}

export interface ReportAssignmentRecord {
  id: string;
  chapter_id: string;
  semester_id?: string | null;
}

export interface StudentSubjectReport {
  assignmentGrades: Record<string, number | null>;
  chapterDetails: Record<string, number | null>;
  chaptersAvg: number | null;
  stsAvg: number | null;
  sasAvg: number | null;
  final: number | null;
  hasChapters: boolean;
  hasEmptyValues: boolean;
}

interface CalculateStudentSubjectReportInput {
  studentId: string;
  subjectId: string;
  grades: ReportGradeRecord[];
  chapters: ReportChapterRecord[];
  assignments: ReportAssignmentRecord[];
  semesterId?: string | null;
  formula?: CustomFormula;
}

interface CalculateStudentSubjectReportAcrossSemestersInput extends Omit<CalculateStudentSubjectReportInput, "semesterId"> {
  semesterIds: string[];
}

function isLegacySemester(semesterId: string | null | undefined) {
  return !semesterId;
}

function scopeBySemester<T>(
  records: T[],
  semesterId: string | null | undefined,
  getSemesterId: (record: T) => string | null | undefined,
): T[] {
  if (!semesterId) {
    return records;
  }

  const exact = records.filter((record) => getSemesterId(record) === semesterId);
  if (exact.length > 0) {
    return exact;
  }

  return records.filter((record) => isLegacySemester(getSemesterId(record)));
}

export function calculateStudentSubjectReport({
  studentId,
  subjectId,
  grades,
  chapters,
  assignments,
  semesterId,
  formula = DEFAULT_FORMULA,
}: CalculateStudentSubjectReportInput): StudentSubjectReport {
  const subjectGradePool = grades.filter((grade) => grade.subject_id === subjectId);
  const scopedSubjectGrades = scopeBySemester(subjectGradePool, semesterId, (grade) => grade.semester_id);
  const studentGrades = scopedSubjectGrades.filter((grade) => grade.student_id === studentId);

  const subjectChapters = chapters.filter((chapter) => chapter.subject_id === subjectId);
  const scopedChapters = scopeBySemester(subjectChapters, semesterId, (chapter) => chapter.semester_id);
  const scopedChapterIds = new Set(scopedChapters.map((chapter) => chapter.id));
  const scopedAssignments = assignments.filter((assignment) => scopedChapterIds.has(assignment.chapter_id));

  const assignmentsByChapter: Record<string, ReportAssignmentRecord[]> = {};
  scopedChapters.forEach((chapter) => {
    assignmentsByChapter[chapter.id] = scopedAssignments.filter((assignment) => assignment.chapter_id === chapter.id);
  });

  const assignmentGrades: Record<string, number | null> = {};
  const chapterDetails: Record<string, number | null> = {};
  const hasChapters = scopedChapters.some((chapter) => (assignmentsByChapter[chapter.id]?.length || 0) > 0);
  let hasAssignmentValue = false;
  let hasEmptyValues = false;
  let chapterSum = 0;
  let chapterCount = 0;

  scopedChapters.forEach((chapter) => {
    const chapterAssignments = assignmentsByChapter[chapter.id] || [];
    if (chapterAssignments.length === 0) {
      chapterDetails[chapter.id] = null;
      return;
    }

    let assignmentSum = 0;
    chapterAssignments.forEach((assignment) => {
      const value = getScopedGradeValue(studentGrades, {
        gradeType: "assignment",
        assignmentId: assignment.id,
      });
      assignmentGrades[assignment.id] = value;
      if (value !== null) hasAssignmentValue = true;
      if (value === null) hasEmptyValues = true;
      assignmentSum += value ?? 0;
    });

    const chapterAverage = assignmentSum / chapterAssignments.length;
    chapterDetails[chapter.id] = chapterAverage;
    chapterSum += chapterAverage;
    chapterCount += 1;
  });

  const chaptersAvg = chapterCount > 0 ? chapterSum / chapterCount : null;
  const stsRaw = getScopedGradeValue(studentGrades, { gradeType: "sts" });
  const sasRaw = getScopedGradeValue(studentGrades, { gradeType: "sas" });

  if (stsRaw === null || sasRaw === null) {
    hasEmptyValues = true;
  }

  const hasAnyComponent = hasAssignmentValue || stsRaw !== null || sasRaw !== null;
  const final = hasAnyComponent
    ? calculateReportGrade(formula, chaptersAvg ?? 0, stsRaw ?? 0, sasRaw ?? 0, hasChapters)
    : null;

  return {
    assignmentGrades,
    chapterDetails,
    chaptersAvg,
    stsAvg: stsRaw,
    sasAvg: sasRaw,
    final,
    hasChapters,
    hasEmptyValues,
  };
}

export function calculateStudentSubjectReportAcrossSemesters({
  semesterIds,
  ...input
}: CalculateStudentSubjectReportAcrossSemestersInput): StudentSubjectReport {
  const semesterReports = semesterIds.map((semesterId) => calculateStudentSubjectReport({ ...input, semesterId }));
  const validFinals = semesterReports
    .map((report) => report.final)
    .filter((value): value is number => value !== null);

  return {
    assignmentGrades: {},
    chapterDetails: {},
    chaptersAvg: null,
    stsAvg: null,
    sasAvg: null,
    final: validFinals.length > 0 ? validFinals.reduce((sum, value) => sum + value, 0) / validFinals.length : null,
    hasChapters: semesterReports.some((report) => report.hasChapters),
    hasEmptyValues: semesterReports.some((report) => report.hasEmptyValues),
  };
}
