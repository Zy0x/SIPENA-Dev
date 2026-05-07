import { describe, expect, it } from "vitest";
import {
  buildOverallRankings,
  buildSubjectRankings,
  calculateRankingSubjectAverage,
  type RankingAssignment,
  type RankingChapter,
  type RankingGrade,
  type RankingStudent,
} from "./rankingCalculations";

const students: RankingStudent[] = [
  { id: "student-a", name: "Alya", nisn: "001" },
  { id: "student-b", name: "Bima", nisn: "002" },
];

const chapters: RankingChapter[] = [
  { id: "math-chapter-s1", subject_id: "math", semester_id: "sem-1" },
  { id: "math-chapter-s2", subject_id: "math", semester_id: "sem-2" },
  { id: "science-chapter-s1", subject_id: "science", semester_id: "sem-1" },
  { id: "science-chapter-s2", subject_id: "science", semester_id: "sem-2" },
];

const assignments: RankingAssignment[] = [
  { id: "math-task-s1", chapter_id: "math-chapter-s1", semester_id: "sem-1" },
  { id: "math-task-s2", chapter_id: "math-chapter-s2", semester_id: "sem-2" },
  { id: "science-task-s1", chapter_id: "science-chapter-s1", semester_id: "sem-1" },
  { id: "science-task-s2", chapter_id: "science-chapter-s2", semester_id: "sem-2" },
];

const grade = (
  studentId: string,
  subjectId: string,
  gradeType: "assignment" | "sts" | "sas",
  value: number | null,
  semesterId: string,
  assignmentId: string | null = null,
): RankingGrade => ({
  student_id: studentId,
  subject_id: subjectId,
  grade_type: gradeType,
  value,
  semester_id: semesterId,
  assignment_id: assignmentId,
});

const grades: RankingGrade[] = [
  grade("student-a", "math", "assignment", 80, "sem-1", "math-task-s1"),
  grade("student-a", "math", "sts", 70, "sem-1"),
  grade("student-a", "math", "sas", 90, "sem-1"),
  grade("student-a", "math", "assignment", 100, "sem-2", "math-task-s2"),
  grade("student-a", "math", "sts", 80, "sem-2"),
  grade("student-a", "math", "sas", 100, "sem-2"),
  grade("student-b", "math", "assignment", 90, "sem-1", "math-task-s1"),
  grade("student-b", "math", "sts", 90, "sem-1"),
  grade("student-b", "math", "sas", 90, "sem-1"),
  grade("student-b", "math", "assignment", 90, "sem-2", "math-task-s2"),
  grade("student-b", "math", "sts", 90, "sem-2"),
  grade("student-b", "math", "sas", 90, "sem-2"),
  grade("student-a", "science", "assignment", 70, "sem-1", "science-task-s1"),
  grade("student-a", "science", "sts", 70, "sem-1"),
  grade("student-a", "science", "sas", 70, "sem-1"),
  grade("student-b", "science", "assignment", 95, "sem-1", "science-task-s1"),
  grade("student-b", "science", "sts", 95, "sem-1"),
  grade("student-b", "science", "sas", 95, "sem-1"),
];

describe("ranking calculations", () => {
  it("calculates combined-semester subject averages from semester report values", () => {
    const average = calculateRankingSubjectAverage({
      studentId: "student-a",
      subjectId: "math",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1", "sem-2"],
    });

    expect(average).toBe(87.5);
  });

  it("ranks per subject using the same combined-semester subject average", () => {
    const rankings = buildSubjectRankings({
      students,
      subjectId: "math",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1", "sem-2"],
    });

    expect(rankings.map((entry) => [entry.student.id, entry.overallAverage, entry.rank])).toEqual([
      ["student-b", 90, 1],
      ["student-a", 87.5, 2],
    ]);
  });

  it("calculates overall ranking only from selected subjects", () => {
    const rankings = buildOverallRankings({
      students,
      subjectIds: ["science"],
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(rankings.map((entry) => [entry.student.id, entry.overallAverage, entry.gradedSubjectCount])).toEqual([
      ["student-b", 95, 1],
      ["student-a", 70, 1],
    ]);
  });
});
