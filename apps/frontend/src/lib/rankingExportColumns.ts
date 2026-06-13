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
  subjectGrades: Record<string, number | null>;
  overallAverage: number;
  rank: number;
  gradedSubjectCount: number;
}

function compactStudentNameForRankingExport(name: string) {
  return name.trim().replace(/\s+/g, " ").split(" ").slice(0, 2).join(" ");
}

function compactNisnForRankingExport(nisn: string) {
  return nisn.trim().slice(0, 17);
}

const SUBJECT_EXPORT_LABELS: Record<string, string> = {
  "bahasa indonesia": "B. Indo",
  "bahasa inggris": "B. Ing",
  "matematika": "MTK",
  "pendidikan pancasila": "PPKn",
  "pendidikan kewarganegaraan": "PKn",
  "pancasila": "PPKn",
  "ilmu pengetahuan alam dan sosial": "IPAS",
  "ipas": "IPAS",
  "pjok": "PJOK",
  "pendidikan jasmani olahraga dan kesehatan": "PJOK",
  "informatika": "TIK",
  "seni budaya": "Seni",
  "prakarya": "Prak.",
  "sejarah": "Sej.",
  "geografi": "Geo.",
  "fisika": "Fis.",
  "kimia": "Kim.",
  "biologi": "Bio.",
  "ekonomi": "Eko.",
  "sosiologi": "Sos.",
};

const SUBJECT_EXPORT_STOP_WORDS = new Set(["dan", "yang", "di", "ke", "dari", "untuk", "pada", "the", "of", "and"]);

function normalizeSubjectLabel(label: string) {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function shortenSubjectWord(word: string) {
  if (word.length <= 5) return word;
  return `${word.slice(0, 3)}.`;
}

export function compactSubjectLabelForRankingExport(label: string) {
  const normalized = normalizeSubjectLabel(label);
  const mapped = SUBJECT_EXPORT_LABELS[normalized];
  if (mapped) return mapped;

  const cleanLabel = label.trim().replace(/\s+/g, " ");
  if (!cleanLabel) return label;
  if (cleanLabel.length <= 5) return cleanLabel;

  const words = cleanLabel.split(" ");
  if (words.length === 1) {
    return shortenSubjectWord(words[0]);
  }

  const meaningfulWords = words.filter((word) => !SUBJECT_EXPORT_STOP_WORDS.has(word.toLowerCase()));
  const acronym = meaningfulWords
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 6);

  if (acronym.length >= 2) return acronym;
  return words.slice(0, 2).map(shortenSubjectWord).join(" ");
}

export function getRankingExportColumnLabel(column: RankingColumn) {
  return column.exportLabel ?? column.label;
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
    exportLabel: "Rank",
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
      exportLabel: compactSubjectLabelForRankingExport(subject.name),
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
    exportLabel: "Rata-rata",
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
        row[column.key] = compactStudentNameForRankingExport(ranking.student.name);
      } else if (column.id === "nisn") {
        row[column.key] = compactNisnForRankingExport(ranking.student.nisn);
      } else if (column.id.startsWith("subject_")) {
        const subjectId = column.subjectId;
        if (subjectId) {
          const value = ranking.subjectGrades[subjectId];
          row[column.key] = value === null || value === undefined ? "-" : formatGrade(value);
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
