export type FeatureType = "page" | "feature" | "runtime";
export type FeatureRiskLevel = "low" | "medium" | "high" | "critical";
export type FeatureAccessStatus = "loading" | "allowed" | "denied" | "error";
export type FeatureAccessReason =
  | "global_kill_switch_off"
  | "user"
  | "role"
  | "all_users"
  | "default_enabled"
  | "default_disabled"
  | "fallback_default";

export interface FeatureAccessState {
  key: string;
  name: string;
  type: FeatureType;
  enabled: boolean;
  reason: FeatureAccessReason | string;
  riskLevel: FeatureRiskLevel;
  defaultEnabled: boolean;
  globalKillSwitch: boolean;
  metadata: Record<string, unknown>;
}

export interface FeatureAudienceRule {
  targetType: "all_users" | "role" | "user";
  targetValue: string | null;
  enabled: boolean;
}

export interface FeatureFlagDefinition {
  key: string;
  name: string;
  type: FeatureType;
  defaultEnabled: boolean;
  globalKillSwitch: boolean;
  riskLevel: FeatureRiskLevel;
  metadata?: Record<string, unknown>;
}

export interface FeatureRegistryEntry extends FeatureFlagDefinition {
  id: string;
  description: string;
  owner: string;
  isMajor: boolean;
}

export const FEATURE_REGISTRY = [
  { id: "dashboard", key: "page.dashboard", name: "Dashboard", description: "Halaman ringkasan utama.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "low", owner: "core", isMajor: true, metadata: { route: "/dashboard", owner: "core", isMajor: true } },
  { id: "classes", key: "page.classes", name: "Kelas & Murid", description: "Halaman pengelolaan kelas dan murid.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", owner: "academic", isMajor: true, metadata: { route: "/classes", owner: "academic", isMajor: true } },
  { id: "subjects", key: "page.subjects", name: "Mata Pelajaran", description: "Halaman pengelolaan mata pelajaran dan KKM.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", owner: "academic", isMajor: true, metadata: { route: "/subjects", owner: "academic", isMajor: true } },
  { id: "grades", key: "page.grades", name: "Input Nilai", description: "Halaman input nilai dan spreadsheet nilai.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "high", owner: "grades", isMajor: true, metadata: { route: "/grades", owner: "grades", isMajor: true } },
  { id: "attendance", key: "page.attendance", name: "Presensi", description: "Halaman presensi utama. V1 tetap menjadi default dan fallback.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "high", owner: "attendance", isMajor: true, metadata: { route: "/attendance", owner: "attendance", isMajor: true, engine: "v1" } },
  { id: "attendanceV2", key: "page.attendance-v2", name: "Presensi V2 (Mirror V1)", description: "Halaman uji Presensi V2. Tampilan harus identik dengan V1 sampai engine V2 siap.", type: "page", defaultEnabled: false, globalKillSwitch: true, riskLevel: "critical", owner: "attendance", isMajor: true, metadata: { route: "/attendance-v2", owner: "attendance", isMajor: true, mirrorOf: "/attendance", defaultEngine: "v1" } },
  { id: "reports", key: "page.reports", name: "Laporan", description: "Halaman induk laporan.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", owner: "reports", isMajor: true, metadata: { route: "/reports", owner: "reports", isMajor: true } },
  { id: "gradeReports", key: "page.reports.grades", name: "Laporan Nilai", description: "Halaman laporan nilai.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "high", owner: "reports", isMajor: true, metadata: { route: "/reports/grades", owner: "reports", isMajor: true, parent: "page.reports" } },
  { id: "rankings", key: "page.reports.rankings", name: "Ranking Murid", description: "Halaman ranking keseluruhan.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "high", owner: "reports", isMajor: true, metadata: { route: "/reports/rankings", owner: "reports", isMajor: true, parent: "page.reports" } },
  { id: "parentPortal", key: "page.reports.portal", name: "Portal Orang Tua", description: "Halaman konfigurasi portal orang tua.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", owner: "reports", isMajor: true, metadata: { route: "/reports/portal", owner: "reports", isMajor: true, parent: "page.reports" } },
  { id: "settings", key: "page.settings", name: "Pengaturan", description: "Halaman pengaturan akun dan aplikasi.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", owner: "core", isMajor: true, metadata: { route: "/settings", owner: "core", isMajor: true } },
  { id: "help", key: "page.help", name: "Panduan", description: "Halaman panduan penggunaan SIPENA.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "low", owner: "core", isMajor: true, metadata: { route: "/help", owner: "core", isMajor: true } },
  { id: "about", key: "page.about", name: "Tentang", description: "Halaman informasi aplikasi.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "low", owner: "core", isMajor: true, metadata: { route: "/about", owner: "core", isMajor: true } },
  { id: "morphe", key: "feature.morphe", name: "Morphe AI", description: "Fitur asisten AI Morphe.", type: "feature", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", owner: "ai", isMajor: true, metadata: { route: "/morphe", owner: "ai", isMajor: true } },
  { id: "ocr", key: "feature.ocr", name: "OCR Smart Import", description: "Fitur OCR untuk import data dari gambar.", type: "feature", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", owner: "import", isMajor: true, metadata: { module: "grades", owner: "import", isMajor: true } },
  { id: "exportStudio", key: "feature.export-studio", name: "Export Studio", description: "Fitur studio ekspor dokumen dan laporan.", type: "feature", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", owner: "export", isMajor: true, metadata: { owner: "export", isMajor: true } },
  { id: "changelog", key: "page.changelog", name: "Changelog", description: "Halaman catatan perubahan aplikasi.", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "low", owner: "core", isMajor: true, metadata: { route: "/changelog", owner: "core", isMajor: true } },
  { id: "attendanceV2Runtime", key: "attendance.v2.runtime", name: "Presensi V2 Runtime", description: "Mengaktifkan engine Presensi V2 untuk akun terpilih. Jika mati, V1 tetap digunakan.", type: "runtime", defaultEnabled: false, globalKillSwitch: true, riskLevel: "critical", owner: "attendance", isMajor: true, metadata: { engine: "v2", fallback: "v1", owner: "attendance", isMajor: true } },
] as const satisfies readonly FeatureRegistryEntry[];

export type FeatureRegistryId = (typeof FEATURE_REGISTRY)[number]["id"];

export const FEATURE_KEYS = Object.fromEntries(
  FEATURE_REGISTRY.map((feature) => [feature.id, feature.key]),
) as Record<FeatureRegistryId, string>;

export const DEFAULT_FEATURE_DEFINITIONS: FeatureFlagDefinition[] = FEATURE_REGISTRY.map(
  ({ key, name, type, defaultEnabled, globalKillSwitch, riskLevel, metadata }) => ({
    key,
    name,
    type,
    defaultEnabled,
    globalKillSwitch,
    riskLevel,
    metadata,
  }),
);

export const FEATURE_CATALOG_SYNC_PAYLOAD = FEATURE_REGISTRY.map((feature) => ({
  featureKey: feature.key,
  name: feature.name,
  description: feature.description,
  featureType: feature.type,
  defaultEnabled: feature.defaultEnabled,
  globalKillSwitch: feature.globalKillSwitch,
  riskLevel: feature.riskLevel,
  metadata: feature.metadata || {},
}));

export const DEFAULT_FEATURE_MAP = new Map(
  DEFAULT_FEATURE_DEFINITIONS.map((feature) => [
    feature.key,
    {
      key: feature.key,
      name: feature.name,
      type: feature.type,
      enabled: feature.defaultEnabled && feature.globalKillSwitch,
      reason: feature.defaultEnabled ? "default_enabled" : "default_disabled",
      riskLevel: feature.riskLevel,
      defaultEnabled: feature.defaultEnabled,
      globalKillSwitch: feature.globalKillSwitch,
      metadata: feature.metadata || {},
    } satisfies FeatureAccessState,
  ]),
);

export function evaluateFeatureAccess(
  feature: FeatureFlagDefinition,
  audiences: FeatureAudienceRule[],
  userId: string | null,
  roles: string[],
): Pick<FeatureAccessState, "enabled" | "reason"> {
  if (!feature.globalKillSwitch) {
    return { enabled: false, reason: "global_kill_switch_off" };
  }

  if (
    userId &&
    audiences.some(
      (audience) =>
        audience.enabled &&
        audience.targetType === "user" &&
        audience.targetValue === userId,
    )
  ) {
    return { enabled: true, reason: "user" };
  }

  if (
    audiences.some(
      (audience) =>
        audience.enabled &&
        audience.targetType === "role" &&
        audience.targetValue != null &&
        roles.includes(audience.targetValue),
    )
  ) {
    return { enabled: true, reason: "role" };
  }

  if (audiences.some((audience) => audience.enabled && audience.targetType === "all_users")) {
    return { enabled: true, reason: "all_users" };
  }

  return {
    enabled: feature.defaultEnabled,
    reason: feature.defaultEnabled ? "default_enabled" : "default_disabled",
  };
}

export function buildFallbackFeatureState(featureKey: string): FeatureAccessState {
  return (
    DEFAULT_FEATURE_MAP.get(featureKey) || {
      key: featureKey,
      name: featureKey,
      type: "feature",
      enabled: false,
      reason: "fallback_default",
      riskLevel: "medium",
      defaultEnabled: false,
      globalKillSwitch: true,
      metadata: {},
    }
  );
}
