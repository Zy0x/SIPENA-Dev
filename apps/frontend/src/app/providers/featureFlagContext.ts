import { createContext } from "react";
import {
  buildFallbackFeatureState,
  DEFAULT_FEATURE_MAP,
  type FeatureAccessStatus,
  type FeatureAccessState,
} from "./featureAccess";

export type AttendanceResolvedRuntime = "v1" | "v2";

export interface FeatureFlagContextValue {
  features: Map<string, FeatureAccessState>;
  roles: string[];
  isReady: boolean;
  isLoading: boolean;
  isFallback: boolean;
  error: string | null;
  canAccess: (featureKey: string) => boolean;
  canAccessNow: (featureKey: string) => boolean;
  getAccessStatus: (featureKey: string) => FeatureAccessStatus;
  getFeature: (featureKey: string) => FeatureAccessState;
  resolveRuntime: (featureKey: string) => AttendanceResolvedRuntime;
  refresh: () => Promise<void>;
}

export const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

export function createFallbackFeatureFlagContext(): FeatureFlagContextValue {
  const features = new Map(DEFAULT_FEATURE_MAP);
  return {
    features,
    roles: [],
    isReady: false,
    isLoading: true,
    isFallback: true,
    error: null,
    canAccess: () => false,
    canAccessNow: () => false,
    getAccessStatus: () => "loading",
    getFeature: (featureKey) => features.get(featureKey) || buildFallbackFeatureState(featureKey),
    resolveRuntime: () => "v1",
    refresh: async () => undefined,
  };
}
