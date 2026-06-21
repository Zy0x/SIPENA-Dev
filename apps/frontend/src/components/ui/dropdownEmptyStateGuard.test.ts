import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../../..");
const readSource = (path: string) => readFileSync(resolve(repoRoot, path), "utf8");

describe("contextual dropdown empty-state contract", () => {
  it("exposes a shared empty-state API for select and dropdown content", () => {
    const selectSource = readSource("apps/frontend/src/components/ui/select.tsx");
    const dropdownSource = readSource("apps/frontend/src/components/ui/dropdown-menu.tsx");

    expect(selectSource).toContain("isEmpty?: boolean");
    expect(selectSource).toContain('emptyLabel = "Tidak ada pilihan"');
    expect(selectSource).toContain("data-select-empty");
    expect(dropdownSource).toContain("isEmpty?: boolean");
    expect(dropdownSource).toContain("data-dropdown-empty");
  });

  it.each([
    ["apps/frontend/src/pages/Grades.tsx", "Tidak ada pilihan Kelas", "Tidak ada pilihan Mata Pelajaran"],
    ["apps/frontend/src/pages/GradeReports.tsx", "Tidak ada pilihan Kelas", "Tidak ada pilihan Mata Pelajaran"],
    ["apps/frontend/src/components/subjects/ImportSubjectsDialog.tsx", "Tidak ada pilihan Tahun Ajaran", "Tidak ada pilihan Kelas Sumber"],
    ["apps/frontend/src/components/import/OCRImportDialog.tsx", "Tidak ada pilihan Kelas", "Tidak ada pilihan Tugas"],
    ["apps/frontend/src/components/settings/AcademicYearSelector.tsx", "Tidak ada pilihan Tahun Ajaran", "Tidak ada pilihan Semester"],
    ["apps/frontend/src/pages/Attendance.tsx", "Tidak ada pilihan Kelas", "isEmpty"],
    ["apps/frontend/src/pages/StudentRankings.tsx", "Tidak ada pilihan Kelas", "isEmpty"],
    ["apps/frontend/src/pages/ParentPortal.tsx", "Tidak ada pilihan Kelas", "isEmpty"],
  ])("keeps contextual wording in %s", (path, firstLabel, secondLabel) => {
    const source = readSource(path);
    expect(source).toContain(firstLabel);
    expect(source).toContain(secondLabel);
  });
});
