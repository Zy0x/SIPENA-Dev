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

export const FEATURE_KEYS = {
  dashboard: "page.dashboard",
  classes: "page.classes",
  subjects: "page.subjects",
  grades: "page.grades",
  attendance: "page.attendance",
  reports: "page.reports",
  gradeReports: "page.reports.grades",
  rankings: "page.reports.rankings",
  parentPortal: "page.reports.portal",
  settings: "page.settings",
  help: "page.help",
  about: "page.about",
  morphe: "feature.morphe",
  attendanceV2Runtime: "attendance.v2.runtime",
} as const;

export const DEFAULT_FEATURE_DEFINITIONS: FeatureFlagDefinition[] = [
  { key: FEATURE_KEYS.dashboard, name: "Dashboard", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "low", metadata: { route: "/dashboard" } },
  { key: FEATURE_KEYS.classes, name: "Kelas & Murid", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", metadata: { route: "/classes" } },
  { key: FEATURE_KEYS.subjects, name: "Mata Pelajaran", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", metadata: { route: "/subjects" } },
  { key: FEATURE_KEYS.grades, name: "Input Nilai", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "high", metadata: { route: "/grades" } },
  { key: FEATURE_KEYS.attendance, name: "Presensi", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "high", metadata: { route: "/attendance" } },
  { key: FEATURE_KEYS.reports, name: "Laporan", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", metadata: { route: "/reports" } },
  { key: FEATURE_KEYS.gradeReports, name: "Laporan Nilai", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "high", metadata: { route: "/reports/grades" } },
  { key: FEATURE_KEYS.rankings, name: "Ranking Murid", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "high", metadata: { route: "/reports/rankings" } },
  { key: FEATURE_KEYS.parentPortal, name: "Portal Orang Tua", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", metadata: { route: "/reports/portal" } },
  { key: FEATURE_KEYS.settings, name: "Pengaturan", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", metadata: { route: "/settings" } },
  { key: FEATURE_KEYS.help, name: "Panduan", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "low", metadata: { route: "/help" } },
  { key: FEATURE_KEYS.about, name: "Tentang", type: "page", defaultEnabled: true, globalKillSwitch: true, riskLevel: "low", metadata: { route: "/about" } },
  { key: FEATURE_KEYS.morphe, name: "Morphe AI", type: "feature", defaultEnabled: true, globalKillSwitch: true, riskLevel: "medium", metadata: { route: "/morphe" } },
  { key: FEATURE_KEYS.attendanceV2Runtime, name: "Presensi V2 Runtime", type: "runtime", defaultEnabled: false, globalKillSwitch: true, riskLevel: "critical", metadata: { engine: "v2", fallback: "v1" } },
];

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
