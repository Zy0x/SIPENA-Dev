import type { RankingColumn } from "@/components/rankings/RankingColumnSelector";

interface Subject {
  id: string;
  name: string;
  kkm: number;
}

interface StudentRankingEntry {
  student: {
    id: string;
    name: string;
    nisn: string;
  };
  subjectGrades: Record<string, number>;
  overallAverage: number;
  rank: number;
  gradedSubjectCount: number;
}

/**
 * Build default ranking export columns based on subjects
 * Includes identity, per-subject grades, and summary columns
 */
export function buildRankingExportColumns(
  subjects: Subject[]
): RankingColumn[] {
  const columns: RankingColumn[] = [];

  // Identity columns (required)
  columns.push({
    id: "rank",
    label: "Peringkat",
    key: "Peringkat",
    category: "identity",
    description: "Nomor urut ranking siswa",
    required: true,
  });

  columns.push({
    id: "name",
    label: "Nama Siswa",
    key: "Nama",
    category: "identity",
    description: "Nama lengkap siswa",
    required: true,
  });

  columns.push({
    id: "nisn",
    label: "NISN",
    key: "NISN",
    category: "identity",
    description: "Nomor Induk Siswa Nasional",
    required: true,
  });

  // Per-subject grade columns
  subjects.forEach((subject) => {
    columns.push({
      id: `subject_${subject.id}`,
      label: subject.name,
      key: subject.name,
      category: "grades",
      description: `Nilai rata-rata ${subject.name} (KKM: ${subject.kkm})`,
      subjectId: subject.id,
      subjectName: subject.name,
    });
  });

  // Summary columns (required)
  columns.push({
    id: "average",
    label: "Rata-rata Keseluruhan",
    key: "Rata-rata",
    category: "summary",
    description: "Rata-rata nilai dari semua mata pelajaran",
    required: true,
  });

  columns.push({
    id: "status",
    label: "Status",
    key: "Status",
    category: "summary",
    description: "Status kelulusan berdasarkan KKM kelas",
  });

  return columns;
}

/**
 * Get default selected column IDs (all columns selected by default)
 */
export function getDefaultSelectedColumns(columns: RankingColumn[]): string[] {
  return columns.map((c) => c.id);
}

/**
 * Build export data based on selected columns
 */
export function buildRankingExportData(
  rankings: StudentRankingEntry[],
  columns: RankingColumn[],
  selectedColumnIds: string[],
  classKkm: number,
  formatGrade: (value: number) => string
): Record<string, string | number>[] {
  const selectedColumns = columns.filter((c) =>
    selectedColumnIds.includes(c.id)
  );

  return rankings.map((ranking) => {
    const row: Record<string, string | number> = {};

    selectedColumns.forEach((column) => {
      if (column.id === "rank") {
        row[column.key] = ranking.rank;
      } else if (column.id === "name") {
        row[column.key] = ranking.student.name;
      } else if (column.id === "nisn") {
        row[column.key] = ranking.student.nisn;
      } else if (column.id.startsWith("subject_")) {
        const subjectId = column.subjectId;
        if (subjectId) {
          row[column.key] = formatGrade(ranking.subjectGrades[subjectId] || 0);
        }
      } else if (column.id === "average") {
        row[column.key] = formatGrade(ranking.overallAverage);
      } else if (column.id === "status") {
        row[column.key] =
          ranking.overallAverage >= classKkm ? "Lulus" : "Belum Lulus";
      }
    });

    return row;
  });
}

/**
 * Get column headers in order
 */
export function getColumnHeaders(
  columns: RankingColumn[],
  selectedColumnIds: string[]
): string[] {
  return columns
    .filter((c) => selectedColumnIds.includes(c.id))
    .map((c) => c.key);
}
