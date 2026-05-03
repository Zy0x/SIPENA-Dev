import type { ExportConfig, ExportMetaGroup } from "@/lib/reportExportLayout";

export function getExportTitle(config: ExportConfig) {
  return config.documentTitle?.trim() || "LAPORAN NILAI SISWA";
}

export function getExportContinuationTitle(config: ExportConfig) {
  return config.continuationTitle?.trim() || `Lanjutan ${getExportTitle(config)}`;
}

export function getExportMetaGroups(config: ExportConfig): ExportMetaGroup[] {
  if (config.metaGroups?.length) {
    return config.metaGroups;
  }

  return [
    {
      align: "left",
      items: [
        { label: "Kelas", value: config.className },
        { label: "Mata Pelajaran", value: config.subjectName },
      ],
    },
    {
      align: "center",
      items: [
        { label: "KKM", value: config.kkm },
        { label: "Periode", value: config.periodLabel },
      ],
    },
    {
      align: "right",
      items: [
        { label: "Tanggal", value: config.dateStr },
        { label: "Jumlah Siswa", value: config.studentCount },
      ],
    },
  ];
}

function sanitizeFileSegment(value: string | number | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "_");
}

export function getExportFileBaseName(config: ExportConfig, fallbackPrefix = "Laporan") {
  if (config.fileBaseName?.trim()) {
    return sanitizeFileSegment(config.fileBaseName);
  }

  const parts = [
    fallbackPrefix,
    config.className,
    config.subjectName,
    config.periodLabel,
  ]
    .map(sanitizeFileSegment)
    .filter(Boolean);

  return parts.join("_");
}
