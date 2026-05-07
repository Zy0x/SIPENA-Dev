import { DEFAULT_FORMULA, type CustomFormula } from "@/lib/gradeFormula";
import {
  calculateStudentSubjectReport,
  calculateStudentSubjectReportAcrossSemesters,
  type ReportAssignmentRecord,
  type ReportChapterRecord,
  type ReportGradeRecord,
} from "@/lib/gradeReportEngine";

export type RankingSemesterValue = "1" | "2" | "all";

export interface RankingGrade extends ReportGradeRecord {}

export interface RankingChapter extends ReportChapterRecord {}

export interface RankingAssignment extends ReportAssignmentRecord {}

export interface RankingStudent {
  id: string;
  name: string;
  nisn: string;
}

export interface StudentRankingEntry {
  student: RankingStudent;
  subjectGrades: Record<string, number | null>;
  overallAverage: number;
  rank: number;
  gradedSubjectCount: number;
}

interface CalculateSubjectAverageInput {
  studentId: string;
  subjectId: string;
  grades: RankingGrade[];
  chapters: RankingChapter[];
  assignments: RankingAssignment[];
  semesterIds?: string[];
  formula?: CustomFormula;
}

export function calculateRankingSubjectAverage({
  studentId,
  subjectId,
  grades,
  chapters,
  assignments,
  semesterIds = [],
  formula = DEFAULT_FORMULA,
}: CalculateSubjectAverageInput): number | null {
  const baseGrades = grades.filter((grade) => grade.subject_id === subjectId);

  if (semesterIds.length <= 1) {
    return calculateStudentSubjectReport({
      studentId,
      subjectId,
      grades: baseGrades,
      chapters,
      assignments,
      semesterId: semesterIds[0],
      formula,
    }).final;
  }

  return calculateStudentSubjectReportAcrossSemesters({
    studentId,
    subjectId,
    grades: baseGrades,
    chapters,
    assignments,
    semesterIds,
    formula,
  }).final;
}

export function applyDenseRank(sorted: StudentRankingEntry[]): StudentRankingEntry[] {
  let currentRank = 0;
  let previousAverage: number | null = null;

  return sorted.map((entry) => {
    const roundedAverage = Math.round(entry.overallAverage * 10) / 10;
    if (roundedAverage !== previousAverage) {
      currentRank += 1;
      previousAverage = roundedAverage;
    }

    return {
      ...entry,
      rank: currentRank,
    };
  });
}

function normalizeRankingScore(value: number | null): number {
  return value ?? 0;
}

export function buildOverallRankings({
  students,
  subjectIds,
  grades,
  chapters,
  assignments,
  semesterIds = [],
  formulasBySubject = {},
}: {
  students: RankingStudent[];
  subjectIds: string[];
  grades: RankingGrade[];
  chapters: RankingChapter[];
  assignments: RankingAssignment[];
  semesterIds?: string[];
  formulasBySubject?: Record<string, CustomFormula | null | undefined>;
}): StudentRankingEntry[] {
  if (subjectIds.length === 0) {
    return [];
  }

  const rankings = students
    .map((student) => {
      const subjectGrades: Record<string, number | null> = {};
      let totalScore = 0;

      subjectIds.forEach((subjectId) => {
        const average = calculateRankingSubjectAverage({
          studentId: student.id,
          subjectId,
          grades,
          chapters,
          assignments,
          semesterIds,
          formula: formulasBySubject[subjectId] || DEFAULT_FORMULA,
        });

        const rankingScore = normalizeRankingScore(average);
        subjectGrades[subjectId] = rankingScore;
        totalScore += rankingScore;
      });

      return {
        student,
        subjectGrades,
        overallAverage: totalScore / subjectIds.length,
        rank: 0,
        gradedSubjectCount: subjectIds.length,
      } satisfies StudentRankingEntry;
    })
    .sort(
      (left, right) =>
        right.overallAverage - left.overallAverage ||
        left.student.name.localeCompare(right.student.name),
    );

  return applyDenseRank(rankings);
}

export function buildSubjectRankings({
  students,
  subjectId,
  grades,
  chapters,
  assignments,
  semesterIds = [],
  formulasBySubject = {},
}: {
  students: RankingStudent[];
  subjectId: string;
  grades: RankingGrade[];
  chapters: RankingChapter[];
  assignments: RankingAssignment[];
  semesterIds?: string[];
  formulasBySubject?: Record<string, CustomFormula | null | undefined>;
}): StudentRankingEntry[] {
  const rankings = students
    .map((student) => {
      const average = calculateRankingSubjectAverage({
        studentId: student.id,
        subjectId,
        grades,
        chapters,
        assignments,
        semesterIds,
        formula: formulasBySubject[subjectId] || DEFAULT_FORMULA,
      });

      const rankingScore = normalizeRankingScore(average);

      return {
        student,
        subjectGrades: { [subjectId]: rankingScore },
        overallAverage: rankingScore,
        rank: 0,
        gradedSubjectCount: 1,
      } satisfies StudentRankingEntry;
    })
    .sort(
      (left, right) =>
        right.overallAverage - left.overallAverage ||
        left.student.name.localeCompare(right.student.name),
    );

  return applyDenseRank(rankings);
}
