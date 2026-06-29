import { describe, expect, it } from "vitest";
import { evaluateFeatureAccess, FEATURE_KEYS, type FeatureFlagDefinition } from "./featureAccess";
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
  it("keeps new runtime features disabled by default", () => {
    const result = evaluateFeatureAccess(baseFeature, [], "user-1", []);
    expect(result).toEqual({ enabled: false, reason: "default_disabled" });
  });

  it("uses global kill switch before every grant", () => {
    const result = evaluateFeatureAccess(
      { ...baseFeature, globalKillSwitch: false },
      [
        { targetType: "all_users", targetValue: null, enabled: true },
        { targetType: "role", targetValue: "tester", enabled: true },
        { targetType: "user", targetValue: "user-1", enabled: true },
      ],
      "user-1",
      ["tester"],
    );
    expect(result).toEqual({ enabled: false, reason: "global_kill_switch_off" });
  });

  it("prioritizes explicit user grant over role and all users", () => {
    const result = evaluateFeatureAccess(
      baseFeature,
      [
        { targetType: "all_users", targetValue: null, enabled: true },
        { targetType: "role", targetValue: "tester", enabled: true },
        { targetType: "user", targetValue: "user-1", enabled: true },
      ],
      "user-1",
      ["tester"],
    );
    expect(result).toEqual({ enabled: true, reason: "user" });
  });

  it("allows role grant before all users fallback", () => {
    const result = evaluateFeatureAccess(
      baseFeature,
      [
        { targetType: "all_users", targetValue: null, enabled: true },
        { targetType: "role", targetValue: "tester", enabled: true },
      ],
      "user-2",
      ["tester"],
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
