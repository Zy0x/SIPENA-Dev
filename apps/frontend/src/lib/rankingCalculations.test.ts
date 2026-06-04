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
import { calculateStudentSubjectReport } from "./gradeReportEngine";
import type { CustomFormula } from "@/lib/gradeFormula";

const students: RankingStudent[] = [
  { id: "student-a", name: "Alya", nisn: "001" },
  { id: "student-b", name: "Bima", nisn: "002" },
];

const chapters: RankingChapter[] = [
  { id: "math-chapter-s1", subject_id: "math", semester_id: "sem-1" },
  { id: "math-chapter-s2", subject_id: "math", semester_id: "sem-2" },
  { id: "math-legacy-chapter", subject_id: "math", semester_id: null },
  { id: "science-chapter-s1", subject_id: "science", semester_id: "sem-1" },
  { id: "science-chapter-s2", subject_id: "science", semester_id: "sem-2" },
  { id: "legacy-chapter", subject_id: "legacy", semester_id: null },
];

const assignments: RankingAssignment[] = [
  { id: "math-task-s1", chapter_id: "math-chapter-s1", semester_id: "sem-1" },
  { id: "math-task-s2", chapter_id: "math-chapter-s2", semester_id: "sem-2" },
  { id: "math-legacy-task", chapter_id: "math-legacy-chapter", semester_id: null },
  { id: "science-task-s1", chapter_id: "science-chapter-s1", semester_id: "sem-1" },
  { id: "science-task-s2", chapter_id: "science-chapter-s2", semester_id: "sem-2" },
  { id: "legacy-task", chapter_id: "legacy-chapter", semester_id: null },
];

const grade = (
  studentId: string,
  subjectId: string,
  gradeType: "assignment" | "sts" | "sas",
  value: number | null,
  semesterId: string | null,
  assignmentId: string | null = null,
  updatedAt?: string,
): RankingGrade => ({
  student_id: studentId,
  subject_id: subjectId,
  grade_type: gradeType,
  value,
  semester_id: semesterId,
  assignment_id: assignmentId,
  updated_at: updatedAt,
});

const grades: RankingGrade[] = [
  grade("student-a", "math", "assignment", 80, "sem-1", "math-task-s1"),
  grade("student-a", "math", "sts", 70, "sem-1"),
  grade("student-a", "math", "sas", 90, "sem-1"),
  grade("student-a", "math", "assignment", 100, "sem-2", "math-task-s2"),
  grade("student-a", "math", "sts", 80, "sem-2"),
  grade("student-a", "math", "sas", 100, "sem-2"),
  grade("student-a", "math", "assignment", 100, null, "math-legacy-task"),
  grade("student-a", "math", "sts", 100, null),
  grade("student-a", "math", "sas", 100, null),
  grade("student-b", "math", "assignment", 90, "sem-1", "math-task-s1"),
  grade("student-b", "math", "sts", 90, "sem-1"),
  grade("student-b", "math", "sas", 90, "sem-1"),
  grade("student-b", "math", "assignment", 90, "sem-2", "math-task-s2"),
  grade("student-b", "math", "sts", 90, "sem-2"),
  grade("student-b", "math", "sas", 90, "sem-2"),
  grade("student-b", "math", "assignment", 100, null, "math-legacy-task"),
  grade("student-b", "math", "sts", 100, null),
  grade("student-b", "math", "sas", 100, null),
  grade("student-a", "science", "assignment", 70, "sem-1", "science-task-s1"),
  grade("student-a", "science", "sts", 70, "sem-1"),
  grade("student-a", "science", "sas", 70, "sem-1"),
  grade("student-b", "science", "assignment", 95, "sem-1", "science-task-s1"),
  grade("student-b", "science", "sts", 95, "sem-1"),
  grade("student-b", "science", "sas", 95, "sem-1"),
  grade("student-a", "legacy", "assignment", 76, null, "legacy-task"),
  grade("student-a", "legacy", "sts", 78, null),
  grade("student-a", "legacy", "sas", 80, null),
];

describe("ranking calculations", () => {
  it("calculates per-subject averages from the selected semester only", () => {
    const semester1Average = calculateRankingSubjectAverage({
      studentId: "student-a",
      subjectId: "math",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });
    const semester2Average = calculateRankingSubjectAverage({
      studentId: "student-a",
      subjectId: "math",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-2"],
    });

    expect(semester1Average).toBe(80);
    expect(semester2Average).toBe(95);
  });

  it("does not mix legacy null-semester chapters into a populated selected semester", () => {
    const average = calculateRankingSubjectAverage({
      studentId: "student-a",
      subjectId: "math",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(average).toBe(80);
  });

  it("uses legacy null-semester data when selected-semester data is absent", () => {
    const average = calculateRankingSubjectAverage({
      studentId: "student-a",
      subjectId: "legacy",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(average).toBe(77.5);
  });

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

  it("matches the grade input report formula when SAS is still empty", () => {
    const semester2 = "sem-2";
    const subjectId = "indonesian";
    const subjectChapters: RankingChapter[] = [
      { id: "indo-chapter-5", subject_id: subjectId, semester_id: semester2 },
      { id: "indo-chapter-6", subject_id: subjectId, semester_id: semester2 },
      { id: "indo-chapter-7", subject_id: subjectId, semester_id: semester2 },
      { id: "indo-chapter-8", subject_id: subjectId, semester_id: semester2 },
    ];
    const subjectAssignments: RankingAssignment[] = [
      { id: "indo-5-a", chapter_id: "indo-chapter-5", semester_id: semester2 },
      { id: "indo-5-b", chapter_id: "indo-chapter-5", semester_id: semester2 },
      { id: "indo-6-a", chapter_id: "indo-chapter-6", semester_id: semester2 },
      { id: "indo-6-b", chapter_id: "indo-chapter-6", semester_id: semester2 },
      { id: "indo-7-a", chapter_id: "indo-chapter-7", semester_id: semester2 },
      { id: "indo-7-b", chapter_id: "indo-chapter-7", semester_id: semester2 },
      { id: "indo-7-c", chapter_id: "indo-chapter-7", semester_id: semester2 },
      { id: "indo-8-a", chapter_id: "indo-chapter-8", semester_id: semester2 },
      { id: "indo-8-b", chapter_id: "indo-chapter-8", semester_id: semester2 },
      { id: "indo-8-c", chapter_id: "indo-chapter-8", semester_id: semester2 },
    ];
    const subjectGrades: RankingGrade[] = [
      grade("student-a", subjectId, "assignment", 80, semester2, "indo-5-a"),
      grade("student-a", subjectId, "assignment", 80, semester2, "indo-5-b"),
      grade("student-a", subjectId, "assignment", 100, semester2, "indo-6-a"),
      grade("student-a", subjectId, "assignment", 100, semester2, "indo-6-b"),
      grade("student-a", subjectId, "assignment", 100, semester2, "indo-7-a"),
      grade("student-a", subjectId, "assignment", 100, semester2, "indo-7-b"),
      grade("student-a", subjectId, "assignment", 100, semester2, "indo-7-c"),
      grade("student-a", subjectId, "assignment", 80, semester2, "indo-8-a"),
      grade("student-a", subjectId, "assignment", 100, semester2, "indo-8-b"),
      grade("student-a", subjectId, "assignment", 100, semester2, "indo-8-c"),
      grade("student-a", subjectId, "sts", 73, semester2),
    ];

    const average = calculateRankingSubjectAverage({
      studentId: "student-a",
      subjectId,
      grades: subjectGrades,
      chapters: subjectChapters,
      assignments: subjectAssignments,
      semesterIds: [semester2],
    });

    expect(average).toBeCloseTo(64.9167, 4);
  });

  it("uses the selected subject custom formula when provided", () => {
    const formula: CustomFormula = {
      enabled: true,
      reportRounding: { mode: "default" },
      components: [
        { id: "grandAvg", name: "Rata-rata BAB", enabled: true, weight: 60 },
        { id: "sts", name: "Nilai STS", enabled: true, weight: 40 },
        { id: "sas", name: "Nilai SAS", enabled: false, weight: 0 },
      ],
    };

    const average = calculateRankingSubjectAverage({
      studentId: "student-a",
      subjectId: "math",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1"],
      formula,
    });

    expect(average).toBe(76);
  });

  it("matches the grade input fallback when selected-semester component values are blank", () => {
    const scopedGrades = [
      grade("student-a", "math", "assignment", 80, "sem-1", "math-task-s1"),
      grade("student-a", "math", "sts", 80, "sem-1"),
      grade("student-a", "math", "sas", 80, "sem-1"),
      grade("student-b", "math", "assignment", 100, null, "math-legacy-task"),
      grade("student-b", "math", "sts", 100, null),
      grade("student-b", "math", "sas", 100, null),
    ];

    const average = calculateRankingSubjectAverage({
      studentId: "student-b",
      subjectId: "math",
      grades: scopedGrades,
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(average).toBe(50);
  });

  it("uses the newest duplicate grade row for the same component", () => {
    const average = calculateRankingSubjectAverage({
      studentId: "student-a",
      subjectId: "math",
      grades: [
        grade("student-a", "math", "assignment", 40, "sem-1", "math-task-s1", "2026-01-01T00:00:00Z"),
        grade("student-a", "math", "assignment", 90, "sem-1", "math-task-s1", "2026-01-02T00:00:00Z"),
        grade("student-a", "math", "sts", 40, "sem-1", null, "2026-01-01T00:00:00Z"),
        grade("student-a", "math", "sts", 90, "sem-1", null, "2026-01-02T00:00:00Z"),
        grade("student-a", "math", "sas", 40, "sem-1", null, "2026-01-01T00:00:00Z"),
        grade("student-a", "math", "sas", 90, "sem-1", null, "2026-01-02T00:00:00Z"),
      ],
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(average).toBe(90);
  });

  it("ranks per subject using the selected semester subject average", () => {
    const rankings = buildSubjectRankings({
      students,
      subjectId: "math",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(rankings.map((entry) => [entry.student.id, entry.overallAverage, entry.rank])).toEqual([
      ["student-b", 90, 1],
      ["student-a", 80, 2],
    ]);
  });

  it("uses the same report grade as the grade input page for per-subject ranking", () => {
    const report = calculateStudentSubjectReport({
      studentId: "student-a",
      subjectId: "math",
      grades: grades.filter((item) => item.subject_id === "math"),
      chapters,
      assignments,
      semesterId: "sem-1",
    });
    const rankings = buildSubjectRankings({
      students,
      subjectId: "math",
      grades,
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(rankings.find((entry) => entry.student.id === "student-a")?.overallAverage).toBe(report.final);
  });

  it("ranks per subject as yearly data only when all semesters are explicitly selected", () => {
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

  it("counts blank report grades as zero in the overall denominator", () => {
    const rankings = buildOverallRankings({
      students: [students[0]],
      subjectIds: ["math", "science"],
      grades: grades.filter((item) => item.student_id === "student-a" && item.subject_id === "math"),
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(rankings.map((entry) => [entry.student.id, entry.overallAverage, entry.gradedSubjectCount])).toEqual([
      ["student-a", 40, 2],
    ]);
    expect(rankings[0].subjectGrades).toEqual({ math: 80, science: 0 });
  });

  it("divides selected multi-subject ranking by the number of selected subjects", () => {
    const rankings = buildOverallRankings({
      students: [students[0]],
      subjectIds: ["math", "science", "legacy"],
      grades: grades.filter((item) => item.student_id === "student-a" && item.subject_id !== "legacy"),
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(rankings.map((entry) => [entry.student.id, entry.overallAverage, entry.gradedSubjectCount])).toEqual([
      ["student-a", 50, 3],
    ]);
  });

  it("uses dense ranks for tied rounded averages", () => {
    const rankings = buildOverallRankings({
      students,
      subjectIds: ["math"],
      grades: [
        grade("student-a", "math", "assignment", 90, "sem-1", "math-task-s1"),
        grade("student-a", "math", "sts", 90, "sem-1"),
        grade("student-a", "math", "sas", 90, "sem-1"),
        grade("student-b", "math", "assignment", 90, "sem-1", "math-task-s1"),
        grade("student-b", "math", "sts", 90, "sem-1"),
        grade("student-b", "math", "sas", 90, "sem-1"),
      ],
      chapters,
      assignments,
      semesterIds: ["sem-1"],
    });

    expect(rankings.map((entry) => [entry.student.name, entry.rank])).toEqual([
      ["Alya", 1],
      ["Bima", 1],
    ]);
  });

  it("sorts tied rounded averages by student name", () => {
    const tiedStudents: RankingStudent[] = [
      { id: "student-z", name: "Zaki", nisn: "003" },
      { id: "student-a", name: "Alya", nisn: "001" },
    ];
    const tiedChapters: RankingChapter[] = [
      { id: "tie-chapter", subject_id: "math", semester_id: "sem-1" },
    ];
    const tiedAssignments: RankingAssignment[] = [
      { id: "tie-task", chapter_id: "tie-chapter", semester_id: "sem-1" },
    ];
    const tiedGrades: RankingGrade[] = [
      grade("student-z", "math", "assignment", 90.04, "sem-1", "tie-task"),
      grade("student-z", "math", "sts", 90.04, "sem-1"),
      grade("student-z", "math", "sas", 90.04, "sem-1"),
      grade("student-a", "math", "assignment", 90.01, "sem-1", "tie-task"),
      grade("student-a", "math", "sts", 90.01, "sem-1"),
      grade("student-a", "math", "sas", 90.01, "sem-1"),
    ];

    const rankings = buildSubjectRankings({
      students: tiedStudents,
      subjectId: "math",
      grades: tiedGrades,
      chapters: tiedChapters,
      assignments: tiedAssignments,
      semesterIds: ["sem-1"],
    });

    expect(rankings.map((entry) => [entry.student.name, entry.rank])).toEqual([
      ["Alya", 1],
      ["Zaki", 1],
    ]);
  });
});
