import { describe, expect, it } from "vitest";

import type { RankingColumn } from "@/components/rankings/RankingColumnSelector";
import { buildRankingExportData } from "./rankingExportColumns";

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
  it("keeps exported names to two words and NISN to at most 17 characters", () => {
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

    expect(row?.Nama).toBe("Muhammad Akmal");
    expect(String(row?.NISN)).toBe("12345678901234567");
    expect(String(row?.NISN)).toHaveLength(17);
  });
});
