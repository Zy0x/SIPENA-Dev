import { describe, expect, it } from "vitest";

import { gradeBatchChangeToBulkInput } from "./gradeBatchChangeMapper";

describe("gradeBatchChangeToBulkInput", () => {
  it("keeps import academic year and semester context in batch saves", () => {
    expect(gradeBatchChangeToBulkInput({
      studentId: "student-1",
      gradeType: "assignment",
      assignmentId: "assignment-1",
      academicYearId: "year-from-import",
      semesterId: "semester-from-import",
      value: 86,
    }, "subject-1")).toEqual({
      student_id: "student-1",
      subject_id: "subject-1",
      assignment_id: "assignment-1",
      academic_year_id: "year-from-import",
      semester_id: "semester-from-import",
      grade_type: "assignment",
      value: 86,
    });
  });
});
