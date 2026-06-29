import { useContext } from "react";
import {
  createFallbackFeatureFlagContext,
  FeatureFlagContext,
} from "./featureFlagContext";

export function useFeatureFlags() {
  return useContext(FeatureFlagContext) || createFallbackFeatureFlagContext();
}
