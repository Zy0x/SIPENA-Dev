import {
  DEFAULT_FORMULA,
  calculateReportGrade,
  type CustomFormula,
} from "@/components/grades/FormulaSettings";
import { getScopedGradeValue } from "@/lib/gradeValueSelection";

export type RankingSemesterValue = "1" | "2" | "all";

export interface RankingGrade {
  student_id: string;
  subject_id: string;
  assignment_id: string | null;
  grade_type: string;
  value: number | null;
  semester_id?: string | null;
}

export interface RankingChapter {
  id: string;
  subject_id: string;
  semester_id?: string | null;
}

export interface RankingAssignment {
  id: string;
  chapter_id: string;
  semester_id?: string | null;
}

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

const calculateSingleScopeSubjectAverage = (
  subjectGrades: RankingGrade[],
  subjectChapters: RankingChapter[],
  assignments: RankingAssignment[],
  formula: CustomFormula,
  targetSemesterId?: string,
): number | null => {
  const assignmentsByChapter: Record<string, RankingAssignment[]> = {};

  subjectChapters.forEach((chapter) => {
    assignmentsByChapter[chapter.id] = assignments.filter(
      (assignment) => assignment.chapter_id === chapter.id,
    );
  });

  const hasChapters = subjectChapters.some(
    (chapter) => (assignmentsByChapter[chapter.id]?.length || 0) > 0,
  );

  let chapterSum = 0;
  let chapterCount = 0;

  subjectChapters.forEach((chapter) => {
    const chapterAssignments = assignmentsByChapter[chapter.id] || [];
    if (chapterAssignments.length === 0) {
      return;
    }

    let assignmentSum = 0;
    chapterAssignments.forEach((assignment) => {
      const value = getScopedGradeValue(subjectGrades, {
        gradeType: "assignment",
        assignmentId: assignment.id,
        semesterId: targetSemesterId,
      });
      assignmentSum += value ?? 0;
    });

    chapterSum += assignmentSum / chapterAssignments.length;
    chapterCount += 1;
  });

  const chaptersAverage = chapterCount > 0 ? chapterSum / chapterCount : null;
  const stsRaw = getScopedGradeValue(subjectGrades, {
    gradeType: "sts",
    semesterId: targetSemesterId,
  });
  const sasRaw = getScopedGradeValue(subjectGrades, {
    gradeType: "sas",
    semesterId: targetSemesterId,
  });

  if (chaptersAverage === null && stsRaw === null && sasRaw === null) {
    return null;
  }

  return calculateReportGrade(
    formula,
    chaptersAverage ?? 0,
    stsRaw ?? 0,
    sasRaw ?? 0,
    hasChapters,
  );
};

const isLegacySemester = (semesterId: string | null | undefined) => !semesterId;

const filterSemesterGrades = (
  grades: RankingGrade[],
  targetSemesterId?: string,
): RankingGrade[] => {
  if (!targetSemesterId) {
    return grades;
  }

  const semesterGrades = grades.filter((grade) => grade.semester_id === targetSemesterId);
  return semesterGrades.length > 0 ? semesterGrades : grades.filter((grade) => isLegacySemester(grade.semester_id));
};

const filterSemesterChapters = (
  chapters: RankingChapter[],
  targetSemesterId?: string,
): RankingChapter[] => {
  if (!targetSemesterId) {
    return chapters;
  }

  const semesterChapters = chapters.filter((chapter) => chapter.semester_id === targetSemesterId);
  return semesterChapters.length > 0 ? semesterChapters : chapters.filter((chapter) => isLegacySemester(chapter.semester_id));
};

export function calculateRankingSubjectAverage({
  studentId,
  subjectId,
  grades,
  chapters,
  assignments,
  semesterIds = [],
  formula = DEFAULT_FORMULA,
}: CalculateSubjectAverageInput): number | null {
  const baseGrades = grades.filter(
    (grade) => grade.student_id === studentId && grade.subject_id === subjectId,
  );
  const baseChapters = chapters.filter((chapter) => chapter.subject_id === subjectId);

  if (semesterIds.length <= 1) {
    const targetSemesterId = semesterIds[0];
    const scopedGrades = filterSemesterGrades(baseGrades, targetSemesterId);
    const scopedChapters = filterSemesterChapters(baseChapters, targetSemesterId);
    const scopedChapterIds = new Set(scopedChapters.map((chapter) => chapter.id));
    const scopedAssignments = assignments.filter((assignment) => scopedChapterIds.has(assignment.chapter_id));

    return calculateSingleScopeSubjectAverage(scopedGrades, scopedChapters, scopedAssignments, formula, targetSemesterId);
  }

  const semesterAverages = semesterIds
    .map((semesterId) => {
      const scopedGrades = filterSemesterGrades(baseGrades, semesterId);
      const scopedChapters = filterSemesterChapters(baseChapters, semesterId);
      const scopedChapterIds = new Set(scopedChapters.map((chapter) => chapter.id));
      const scopedAssignments = assignments.filter((assignment) => scopedChapterIds.has(assignment.chapter_id));

      return calculateSingleScopeSubjectAverage(scopedGrades, scopedChapters, scopedAssignments, formula, semesterId);
    })
    .filter((average): average is number => average !== null);

  if (semesterAverages.length > 0) {
    return semesterAverages.reduce((sum, average) => sum + average, 0) / semesterAverages.length;
  }

  return null;
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

export function buildOverallRankings({
  students,
  subjectIds,
  grades,
  chapters,
  assignments,
  semesterIds = [],
}: {
  students: RankingStudent[];
  subjectIds: string[];
  grades: RankingGrade[];
  chapters: RankingChapter[];
  assignments: RankingAssignment[];
  semesterIds?: string[];
}): StudentRankingEntry[] {
  const rankings = students
    .map((student) => {
      const subjectGrades: Record<string, number | null> = {};
      let totalScore = 0;
      let gradedSubjectCount = 0;

      subjectIds.forEach((subjectId) => {
        const average = calculateRankingSubjectAverage({
          studentId: student.id,
          subjectId,
          grades,
          chapters,
          assignments,
          semesterIds,
        });

        subjectGrades[subjectId] = average;

        if (average !== null) {
          totalScore += average;
          gradedSubjectCount += 1;
        }
      });

      if (gradedSubjectCount === 0) {
        return null;
      }

      return {
        student,
        subjectGrades,
        overallAverage: totalScore / gradedSubjectCount,
        rank: 0,
        gradedSubjectCount,
      } satisfies StudentRankingEntry;
    })
    .filter((entry): entry is StudentRankingEntry => entry !== null)
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
}: {
  students: RankingStudent[];
  subjectId: string;
  grades: RankingGrade[];
  chapters: RankingChapter[];
  assignments: RankingAssignment[];
  semesterIds?: string[];
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
      });

      if (average === null) {
        return null;
      }

      return {
        student,
        subjectGrades: { [subjectId]: average },
        overallAverage: average,
        rank: 0,
        gradedSubjectCount: 1,
      } satisfies StudentRankingEntry;
    })
    .filter((entry): entry is StudentRankingEntry => entry !== null)
    .sort(
      (left, right) =>
        right.overallAverage - left.overallAverage ||
        left.student.name.localeCompare(right.student.name),
    );

  return applyDenseRank(rankings);
}
