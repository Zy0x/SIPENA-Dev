import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEATURE_DEFINITIONS,
  evaluateFeatureAccess,
  FEATURE_CATALOG_SYNC_PAYLOAD,
  FEATURE_KEYS,
  FEATURE_REGISTRY,
  type FeatureFlagDefinition,
} from "./featureAccess";
import { createFallbackFeatureFlagContext } from "./featureFlagContext";

const baseFeature: FeatureFlagDefinition = {
  key: FEATURE_KEYS.attendanceV2Runtime,
  name: "Presensi V2 Runtime",
  type: "runtime",
  defaultEnabled: false,
  globalKillSwitch: true,
  riskLevel: "critical",
};

describe("feature access evaluation", () => {
  it("derives feature keys and default definitions from the feature registry", () => {
    const registryKeys = FEATURE_REGISTRY.map((feature) => feature.key);
    const defaultKeys = DEFAULT_FEATURE_DEFINITIONS.map((feature) => feature.key);
    const syncKeys = FEATURE_CATALOG_SYNC_PAYLOAD.map((feature) => feature.featureKey);

    expect(defaultKeys).toEqual(registryKeys);
    expect(syncKeys).toEqual(registryKeys);
    expect(Object.values(FEATURE_KEYS)).toEqual(registryKeys);
  });

  it("keeps attendance v2 page and runtime closed by default", () => {
    const attendanceV2Page = DEFAULT_FEATURE_DEFINITIONS.find((feature) => feature.key === FEATURE_KEYS.attendanceV2);
    const attendanceV2Runtime = DEFAULT_FEATURE_DEFINITIONS.find((feature) => feature.key === FEATURE_KEYS.attendanceV2Runtime);

    expect(attendanceV2Page?.defaultEnabled).toBe(false);
    expect(attendanceV2Page?.riskLevel).toBe("critical");
    expect(attendanceV2Runtime?.defaultEnabled).toBe(false);
    expect(attendanceV2Runtime?.riskLevel).toBe("critical");
  });

  it("registers only major page or feature keys in the catalog", () => {
    expect(FEATURE_REGISTRY.every((feature) => feature.isMajor)).toBe(true);
    expect(FEATURE_REGISTRY.every((feature) => Boolean(feature.owner))).toBe(true);
    expect(FEATURE_REGISTRY.some((feature) => feature.key === "page.attendance-v2")).toBe(true);
  });

  it("keeps new runtime features disabled by default", () => {
    const result = evaluateFeatureAccess(baseFeature, [], "user-1", []);
    expect(result).toEqual({ enabled: false, reason: "default_disabled" });
  });

  it("uses global kill switch before every grant", () => {
    const result = evaluateFeatureAccess(
      { ...baseFeature, globalKillSwitch: false },
      [
        { targetType: "all_users", targetValue: null, enabled: true },
        { targetType: "role", targetValue: "beta_user", enabled: true },
        { targetType: "user", targetValue: "user-1", enabled: true },
      ],
      "user-1",
      ["beta_user"],
    );
    expect(result).toEqual({ enabled: false, reason: "global_kill_switch_off" });
  });

  it("prioritizes explicit user grant over role and all users", () => {
    const result = evaluateFeatureAccess(
      baseFeature,
      [
        { targetType: "all_users", targetValue: null, enabled: true },
        { targetType: "role", targetValue: "beta_user", enabled: true },
        { targetType: "user", targetValue: "user-1", enabled: true },
      ],
      "user-1",
      ["beta_user"],
    );
    expect(result).toEqual({ enabled: true, reason: "user" });
  });

  it("allows role grant before all users fallback", () => {
    const result = evaluateFeatureAccess(
      baseFeature,
      [
        { targetType: "all_users", targetValue: null, enabled: true },
        { targetType: "role", targetValue: "beta_user", enabled: true },
      ],
      "user-2",
      ["beta_user"],
    );
    expect(result).toEqual({ enabled: true, reason: "role" });
  });

  it("allows all users when no user or role grant matches", () => {
    const result = evaluateFeatureAccess(
      baseFeature,
      [{ targetType: "all_users", targetValue: null, enabled: true }],
      "user-3",
      ["teacher"],
    );
    expect(result).toEqual({ enabled: true, reason: "all_users" });
  });

  it("keeps fallback context closed while feature access is not ready", () => {
    const context = createFallbackFeatureFlagContext();
    expect(context.isReady).toBe(false);
    expect(context.isLoading).toBe(true);
    expect(context.getAccessStatus(FEATURE_KEYS.dashboard)).toBe("loading");
    expect(context.canAccess(FEATURE_KEYS.dashboard)).toBe(false);
    expect(context.canAccessNow(FEATURE_KEYS.dashboard)).toBe(false);
  });
});
