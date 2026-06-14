import { describe, expect, it } from "vitest";

import type { RankingColumn } from "@/components/rankings/RankingColumnSelector";
import {
  buildRankingExportColumns,
  buildRankingExportData,
  compactSubjectLabelForRankingExport,
  getRankingExportColumnLabel,
} from "./rankingExportColumns";

const columns: RankingColumn[] = [
  {
    id: "rank",
    label: "Peringkat",
    key: "Peringkat",
    category: "identity",
    description: "Nomor urut ranking siswa",
    required: true,
  },
  {
    id: "name",
    label: "Nama Siswa",
    key: "Nama",
    category: "identity",
    description: "Nama lengkap siswa",
    required: true,
  },
  {
    id: "nisn",
    label: "NISN",
    key: "NISN",
    category: "identity",
    description: "Nomor Induk Siswa Nasional",
    required: true,
  },
];

describe("ranking export columns", () => {
  it("keeps full exported names for wrapping and NISN to at most 17 characters", () => {
    const [row] = buildRankingExportData(
      [{
        student: {
          id: "s-1",
          name: "Muhammad Akmal Zain Malik Firdaus",
          nisn: "12345678901234567890",
        },
        subjectGrades: {},
        overallAverage: 88,
        rank: 1,
        gradedSubjectCount: 0,
      }],
      columns,
      columns.map((column) => column.id),
      75,
      (value) => String(value),
    );

    expect(row?.Nama).toBe("Muhammad Akmal Zain Malik Firdaus");
    expect(String(row?.NISN)).toBe("12345678901234567");
    expect(String(row?.NISN)).toHaveLength(17);
  });

  it("uses compact export-only labels so ranking headers do not split words", () => {
    const exportColumns = buildRankingExportColumns([
      { id: "subject-1", name: "Bahasa Indonesia", kkm: 75 },
      { id: "subject-2", name: "Matematika", kkm: 75 },
      { id: "subject-3", name: "Pendidikan Pancasila", kkm: 75 },
      { id: "subject-4", name: "Matematika Tingkat Lanjut", kkm: 75 },
      { id: "subject-5", name: "Biologi", kkm: 75 },
    ]);

    expect(getRankingExportColumnLabel(exportColumns.find((column) => column.id === "rank")!)).toBe("Rank");
    expect(getRankingExportColumnLabel(exportColumns.find((column) => column.id === "subject_subject-1")!)).toBe("B. Indo");
    expect(getRankingExportColumnLabel(exportColumns.find((column) => column.id === "subject_subject-2")!)).toBe("MTK");
    expect(getRankingExportColumnLabel(exportColumns.find((column) => column.id === "subject_subject-3")!)).toBe("PPKn");
    expect(getRankingExportColumnLabel(exportColumns.find((column) => column.id === "subject_subject-4")!)).toBe("MTL");
    expect(getRankingExportColumnLabel(exportColumns.find((column) => column.id === "subject_subject-5")!)).toBe("Bio.");
    expect(getRankingExportColumnLabel(exportColumns.find((column) => column.id === "average")!)).toBe("Rata-rata");
  });

  it("falls back to short subject labels for custom long subject names", () => {
    expect(compactSubjectLabelForRankingExport("Teknologi Informasi dan Komunikasi")).toBe("TIK");
    expect(compactSubjectLabelForRankingExport("Antropologi")).toBe("Ant.");
    expect(compactSubjectLabelForRankingExport("Robotika dan AI")).toBe("RA");
  });
});
