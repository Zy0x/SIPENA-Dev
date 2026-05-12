export const IMPORT_SOURCE_TYPES = [
  "official_exact",
  "official_modified",
  "official_damaged",
  "free_structured",
  "free_unstructured",
  "unsupported",
] as const;

export const UPDATE_MODES = [
  "fill_empty_only",
  "overwrite_existing",
  "overwrite_selected_columns",
  "skip_existing",
] as const;

export const RESERVED_COLUMN_HEADERS = [
  "no",
  "nomor",
  "nomor induk",
  "nomor induk siswa",
  "nis nisn",
  "nisn",
  "nis",
  "nama",
  "nama siswa",
  "nama peserta didik",
  "peserta didik",
  "siswa",
  "kelas",
  "rombel",
  "gender",
  "jk",
  "keterangan",
] as const;

export const DERIVED_COLUMN_HEADERS = [
  "predikat",
  "keterangan",
  "status",
  "rata rata",
  "rerata",
  "average",
  "jumlah",
  "total",
  "nilai akhir",
  "nilai tertinggi",
  "nilai terendah",
  "rapor",
  "ranking",
  "rank",
  "peringkat",
  "kkm",
] as const;

export const STS_ALIASES = [
  "sts",
  "uts",
  "pts",
  "sumatif tengah semester",
  "tengah semester",
] as const;

export const SAS_ALIASES = [
  "sas",
  "uas",
  "pas",
  "sumatif akhir semester",
  "akhir semester",
] as const;

export const DAILY_SCORE_ALIASES = [
  "uh",
  "ph",
  "harian",
  "nilai harian",
  "ulangan harian",
  "penilaian harian",
] as const;

export const REMEDIAL_ALIASES = [
  "remedial",
  "remidi",
  "perbaikan",
] as const;

export const TEXTUAL_GRADE_VALUES = [
  "tuntas",
  "tidak tuntas",
  "remedial",
  "lulus",
  "tidak lulus",
  "sangat baik",
  "baik",
  "cukup",
  "kurang",
  "a",
  "b",
  "c",
  "d",
  "e",
] as const;

export const EXCEL_ERROR_VALUES = [
  "#n/a",
  "#value!",
  "#div/0!",
  "#ref!",
  "#name?",
  "#num!",
  "#null!",
] as const;

export const EMPTY_GRADE_VALUES = [
  "-",
  "–",
  "—",
  "n/a",
  "na",
  "null",
  "kosong",
  "belum",
  "belum dinilai",
  "belum ada",
  "tdk ada",
  "tidak ada",
] as const;

export const ROMAN_NUMERAL_VALUES: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
  xi: 11,
  xii: 12,
};

export const MUHAMMAD_NAME_ALIASES = ["m", "muh", "muh.", "mhd", "muhammad"] as const;
