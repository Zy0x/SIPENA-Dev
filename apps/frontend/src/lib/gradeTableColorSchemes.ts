export type GradeTableColorSchemeId = "classic" | "current" | "future";

export type GradeTableColumnToneKey = "sts" | "sas" | "final" | "status";

export type GradeTableColumnType =
  | "index"
  | "name"
  | "assignment"
  | "chapter_avg"
  | "sts"
  | "sas"
  | "final"
  | "status";

export interface GradeTableTone {
  header: string;
  body: string | null;
}

export interface GradeTableColorSchemeConfig {
  id: GradeTableColorSchemeId;
  label: string;
  shortLabel: string;
  description: string;
  selectable: boolean;
  previewSwatches: readonly string[];
  chapterHeaderTones: readonly GradeTableTone[];
  assignmentHeaderTone: string | null;
  finalColumnTones: Record<GradeTableColumnToneKey, GradeTableTone>;
  averageHeaderTone: string;
  averageBodyTone: string;
  averageCellTone: string;
  averageHoverTone: string;
}

const CLASSIC_CHAPTER_HEADER_TONE: GradeTableTone = {
  header: "bg-primary/10 text-primary border-primary/20 dark:bg-blue-950/45 dark:text-blue-100 dark:border-blue-800/60",
  body: null,
};

const FINAL_STS_TONE: GradeTableTone = {
  header: "bg-indigo-100 text-indigo-950 border-indigo-200 dark:bg-indigo-900/65 dark:text-indigo-50 dark:border-indigo-700/70",
  body: "bg-indigo-100/45 dark:bg-indigo-950/35",
};

const FINAL_SAS_TONE: GradeTableTone = {
  header: "bg-purple-100 text-purple-950 border-purple-200 dark:bg-purple-900/65 dark:text-purple-50 dark:border-purple-700/70",
  body: "bg-purple-100/45 dark:bg-purple-950/35",
};

const FINAL_RAPOR_TONE: GradeTableTone = {
  header: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/70 dark:text-slate-100 dark:border-slate-700",
  body: "bg-slate-50/55 dark:bg-slate-900/20",
};

const CURRENT_CHAPTER_HEADER_TONES = [
  {
    header: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/45 dark:text-sky-100 dark:border-sky-800/60",
    body: null,
  },
  {
    header: "bg-indigo-100 text-indigo-900 border-indigo-200 dark:bg-indigo-950/45 dark:text-indigo-100 dark:border-indigo-800/60",
    body: null,
  },
  {
    header: "bg-cyan-100 text-cyan-900 border-cyan-200 dark:bg-cyan-950/45 dark:text-cyan-100 dark:border-cyan-800/60",
    body: null,
  },
  {
    header: "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-950/45 dark:text-violet-100 dark:border-violet-800/60",
    body: null,
  },
  {
    header: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950/45 dark:text-blue-100 dark:border-blue-800/60",
    body: null,
  },
  {
    header: "bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800/70 dark:text-slate-100 dark:border-slate-700",
    body: null,
  },
] as const;

const CLASSIC_FINAL_COLUMN_TONES: Record<GradeTableColumnToneKey, GradeTableTone> = {
  sts: FINAL_STS_TONE,
  sas: FINAL_SAS_TONE,
  final: FINAL_RAPOR_TONE,
  status: {
    header: "bg-muted text-muted-foreground border-border",
    body: null,
  },
};

const CURRENT_FINAL_COLUMN_TONES: Record<GradeTableColumnToneKey, GradeTableTone> = {
  sts: FINAL_STS_TONE,
  sas: FINAL_SAS_TONE,
  final: FINAL_RAPOR_TONE,
  status: {
    header: "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/70 dark:text-slate-100 dark:border-slate-700",
    body: "bg-slate-50/45 dark:bg-slate-900/20",
  },
};

export const DEFAULT_GRADE_TABLE_COLOR_SCHEME: GradeTableColorSchemeId = "classic";
export const GRADE_TABLE_COLOR_SCHEME_STORAGE_KEY = "sipena:grade-table-color-scheme";
export const GRADE_TABLE_COLOR_SCHEME_EVENT = "sipena:grade-table-color-scheme";

export const GRADE_TABLE_COLOR_SCHEMES: Record<GradeTableColorSchemeId, GradeTableColorSchemeConfig> = {
  classic: {
    id: "classic",
    label: "Setting A",
    shortLabel: "Awal SIPENA",
    description: "Tampilan ringan seperti SIPENA awal: header BAB biru, tugas tetap bersih.",
    selectable: true,
    previewSwatches: ["#dbeafe", "#3b82f6", "#f1f5f9", "#e2e8f0"],
    chapterHeaderTones: [CLASSIC_CHAPTER_HEADER_TONE],
    assignmentHeaderTone: "bg-background text-foreground border-border dark:bg-slate-950 dark:text-slate-100 dark:border-slate-800",
    finalColumnTones: CLASSIC_FINAL_COLUMN_TONES,
    averageHeaderTone: "bg-primary/10 text-primary border-primary/20 dark:bg-blue-950/45 dark:text-blue-100 dark:border-blue-800/60",
    averageBodyTone: "bg-primary/5 dark:bg-primary/10",
    averageCellTone:
      "border-primary/20 bg-primary/10 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-primary/30 dark:bg-primary/15",
    averageHoverTone:
      "bg-primary/15 border-primary/35 ring-1 ring-inset ring-primary/20 dark:bg-primary/20 dark:border-primary/40 dark:ring-primary/30",
  },
  current: {
    id: "current",
    label: "Setting B",
    shortLabel: "Warna Sekarang",
    description: "Header BAB berwarna per bagian, Rata-rata, STS, dan SAS lebih tegas.",
    selectable: true,
    previewSwatches: ["#e0f2fe", "#e0e7ff", "#f3e8ff", "#cbd5e1"],
    chapterHeaderTones: CURRENT_CHAPTER_HEADER_TONES,
    assignmentHeaderTone: null,
    finalColumnTones: CURRENT_FINAL_COLUMN_TONES,
    averageHeaderTone: "bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800/75 dark:text-slate-100 dark:border-slate-700",
    averageBodyTone: "bg-slate-200/70 dark:bg-slate-800/60",
    averageCellTone:
      "border-slate-300/70 bg-slate-300/55 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-slate-600/70 dark:bg-slate-700/60",
    averageHoverTone:
      "bg-slate-300/85 border-slate-400/80 ring-1 ring-inset ring-slate-300/80 dark:bg-slate-700/75 dark:border-slate-500/80 dark:ring-slate-600/70",
  },
  future: {
    id: "future",
    label: "Setting C",
    shortLabel: "Akan Datang",
    description: "Slot opsi berikutnya. Belum aktif sampai warna final ditentukan.",
    selectable: false,
    previewSwatches: ["#f8fafc", "#94a3b8", "#64748b", "#334155"],
    chapterHeaderTones: CURRENT_CHAPTER_HEADER_TONES,
    assignmentHeaderTone: null,
    finalColumnTones: CURRENT_FINAL_COLUMN_TONES,
    averageHeaderTone: "bg-slate-200 text-slate-900 border-slate-300 dark:bg-slate-800/75 dark:text-slate-100 dark:border-slate-700",
    averageBodyTone: "bg-slate-200/70 dark:bg-slate-800/60",
    averageCellTone:
      "border-slate-300/70 bg-slate-300/55 font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-slate-600/70 dark:bg-slate-700/60",
    averageHoverTone:
      "bg-slate-300/85 border-slate-400/80 ring-1 ring-inset ring-slate-300/80 dark:bg-slate-700/75 dark:border-slate-500/80 dark:ring-slate-600/70",
  },
};

function isBrowser() {
  return typeof window !== "undefined";
}

function isKnownGradeTableColorScheme(value?: string | null): value is GradeTableColorSchemeId {
  return value === "classic" || value === "current" || value === "future";
}

export function normalizeGradeTableColorScheme(value?: string | null): GradeTableColorSchemeId {
  if (!isKnownGradeTableColorScheme(value)) return DEFAULT_GRADE_TABLE_COLOR_SCHEME;
  return GRADE_TABLE_COLOR_SCHEMES[value].selectable ? value : DEFAULT_GRADE_TABLE_COLOR_SCHEME;
}

export function isSelectableGradeTableColorScheme(value?: string | null): value is GradeTableColorSchemeId {
  return isKnownGradeTableColorScheme(value) && GRADE_TABLE_COLOR_SCHEMES[value].selectable;
}

export function readStoredGradeTableColorScheme(): GradeTableColorSchemeId {
  if (!isBrowser()) return DEFAULT_GRADE_TABLE_COLOR_SCHEME;
  return normalizeGradeTableColorScheme(window.localStorage.getItem(GRADE_TABLE_COLOR_SCHEME_STORAGE_KEY));
}

export function writeStoredGradeTableColorScheme(value: GradeTableColorSchemeId) {
  if (!isBrowser()) return;
  window.localStorage.setItem(GRADE_TABLE_COLOR_SCHEME_STORAGE_KEY, normalizeGradeTableColorScheme(value));
}

export function emitGradeTableColorScheme(value: GradeTableColorSchemeId) {
  if (!isBrowser()) return;
  window.dispatchEvent(
    new CustomEvent<GradeTableColorSchemeId>(GRADE_TABLE_COLOR_SCHEME_EVENT, {
      detail: normalizeGradeTableColorScheme(value),
    }),
  );
}

export function applyGradeTableColorScheme(value?: string | null): GradeTableColorSchemeId {
  const normalized = normalizeGradeTableColorScheme(value);
  writeStoredGradeTableColorScheme(normalized);
  emitGradeTableColorScheme(normalized);
  return normalized;
}

export function getGradeTableColorSchemeConfig(value?: string | null): GradeTableColorSchemeConfig {
  return GRADE_TABLE_COLOR_SCHEMES[normalizeGradeTableColorScheme(value)];
}

export function getGradeTableChapterTone(value: string | null | undefined, index = 0): GradeTableTone {
  const scheme = getGradeTableColorSchemeConfig(value);
  return scheme.chapterHeaderTones[index % scheme.chapterHeaderTones.length];
}

export function getGradeTableColumnHeaderTone(
  value: string | null | undefined,
  column: { type: GradeTableColumnType; chapterIndex?: number },
): string {
  const scheme = getGradeTableColorSchemeConfig(value);

  if (column.type === "chapter_avg" || column.type === "final") return scheme.averageHeaderTone;
  if (column.type === "assignment") {
    return scheme.assignmentHeaderTone || getGradeTableChapterTone(value, column.chapterIndex || 0).header;
  }
  if (column.type === "sts" || column.type === "sas" || column.type === "status") {
    return scheme.finalColumnTones[column.type].header;
  }

  return "bg-muted text-muted-foreground border-border";
}

export function getGradeTableColumnBodyTone(
  value: string | null | undefined,
  column: { type: GradeTableColumnType },
): string | null {
  const scheme = getGradeTableColorSchemeConfig(value);

  if (column.type === "chapter_avg" || column.type === "final") return scheme.averageBodyTone;
  if (column.type === "sts" || column.type === "sas" || column.type === "status") {
    return scheme.finalColumnTones[column.type].body;
  }

  return null;
}

export function getGradeTableAverageCellTone(value?: string | null): string {
  return getGradeTableColorSchemeConfig(value).averageCellTone;
}

export function getGradeTableAverageHoverTone(value?: string | null): string {
  return getGradeTableColorSchemeConfig(value).averageHoverTone;
}
