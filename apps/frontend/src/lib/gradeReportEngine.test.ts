import { describe, expect, it } from "vitest";

import { DEFAULT_FORMULA } from "@/lib/gradeFormula";
import { calculateStudentSubjectReport } from "./gradeReportEngine";

describe("gradeReportEngine rounding targets", () => {
  const baseInput = {
    studentId: "student-1",
    subjectId: "subject-1",
    semesterId: "semester-1",
    chapters: [{ id: "chapter-1", subject_id: "subject-1", semester_id: "semester-1" }],
    assignments: [
      { id: "assignment-1", chapter_id: "chapter-1", semester_id: "semester-1" },
      { id: "assignment-2", chapter_id: "chapter-1", semester_id: "semester-1" },
    ],
    grades: [
      {
        student_id: "student-1",
        subject_id: "subject-1",
        assignment_id: "assignment-1",
        grade_type: "assignment",
        value: 82,
        semester_id: "semester-1",
      },
      {
        student_id: "student-1",
        subject_id: "subject-1",
        assignment_id: "assignment-2",
        grade_type: "assignment",
        value: 83,
        semester_id: "semester-1",
      },
      {
        student_id: "student-1",
        subject_id: "subject-1",
        assignment_id: null,
        grade_type: "sts",
        value: 90,
        semester_id: "semester-1",
      },
      {
        student_id: "student-1",
        subject_id: "subject-1",
        assignment_id: null,
        grade_type: "sas",
        value: 85,
        semester_id: "semester-1",
      },
    ],
  };

  it("can round chapter averages without forcing report rounding", () => {
    const report = calculateStudentSubjectReport({
      ...baseInput,
      formula: {
        ...DEFAULT_FORMULA,
        reportRounding: { mode: "nearest_integer", target: "chapter_average" },
      },
    });

    expect(report.chapterDetails["chapter-1"]).toBe(83);
    expect(report.final).toBe(85.25);
  });

  it("can round both chapter averages and report values", () => {
    const report = calculateStudentSubjectReport({
      ...baseInput,
      formula: {
        ...DEFAULT_FORMULA,
        reportRounding: { mode: "nearest_integer", target: "all" },
      },
    });

    expect(report.chapterDetails["chapter-1"]).toBe(83);
    expect(report.final).toBe(85);
  });
});
