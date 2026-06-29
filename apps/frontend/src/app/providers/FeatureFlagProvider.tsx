import { useCallback, useMemo, type PropsWithChildren } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  EDGE_FUNCTIONS_URL,
  SUPABASE_EXTERNAL_ANON_KEY,
} from "@/core/repositories/supabase-compat.repository";
import {
  buildFallbackFeatureState,
  DEFAULT_FEATURE_DEFINITIONS,
  DEFAULT_FEATURE_MAP,
  FEATURE_KEYS,
  type FeatureAccessState,
} from "./featureAccess";
import { FeatureFlagContext, type FeatureFlagContextValue } from "./featureFlagContext";

interface FeatureEvaluationResponse {
  success: boolean;
  roles?: string[];
  features?: FeatureAccessState[];
  error?: string;
}

async function fetchFeatureEvaluation(accessToken: string): Promise<FeatureEvaluationResponse> {
  const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-feature-access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_EXTERNAL_ANON_KEY,
    },
    body: JSON.stringify({ action: "evaluate" }),
  });

  const payload = (await response.json().catch(() => ({}))) as FeatureEvaluationResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Gagal memuat kontrol fitur");
  }
  return payload;
}

function mergeWithDefaults(remoteFeatures: FeatureAccessState[] | undefined): Map<string, FeatureAccessState> {
  const merged = new Map(DEFAULT_FEATURE_MAP);
  for (const feature of remoteFeatures || []) {
    merged.set(feature.key, feature);
  }

  for (const definition of DEFAULT_FEATURE_DEFINITIONS) {
    if (!merged.has(definition.key)) {
      merged.set(definition.key, buildFallbackFeatureState(definition.key));
    }
  }

  return merged;
}

export function FeatureFlagProvider({ children }: PropsWithChildren) {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  const accessToken = session?.access_token ?? null;

  const query = useQuery({
    queryKey: ["feature-access", session?.user?.id ?? "anonymous"],
    queryFn: () => fetchFeatureEvaluation(accessToken || ""),
    enabled: !loading && !!accessToken,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    retry: 1,
  });

  const features = useMemo(() => mergeWithDefaults(query.data?.features), [query.data?.features]);
  const roles = useMemo(() => query.data?.roles || [], [query.data?.roles]);
  const error = query.error instanceof Error ? query.error.message : null;
  const isFallback = !query.data?.success;

  const getFeature = useCallback(
    (featureKey: string) => features.get(featureKey) || buildFallbackFeatureState(featureKey),
    [features],
  );

  const canAccess = useCallback(
    (featureKey: string) => getFeature(featureKey).enabled,
    [getFeature],
  );

  const resolveRuntime = useCallback(
    (featureKey: string) => {
      if (featureKey === FEATURE_KEYS.attendanceV2Runtime && canAccess(featureKey)) {
        return "v2";
      }
      return "v1";
    },
    [canAccess],
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["feature-access"] });
  }, [queryClient]);

  const value = useMemo<FeatureFlagContextValue>(
    () => ({
      features,
      roles,
      isLoading: query.isFetching && !query.data && !!accessToken,
      isFallback,
      error,
      canAccess,
      getFeature,
      resolveRuntime,
      refresh,
    }),
    [accessToken, canAccess, error, features, getFeature, isFallback, query.data, query.isFetching, refresh, roles, resolveRuntime],
  );

  return <FeatureFlagContext.Provider value={value}>{children}</FeatureFlagContext.Provider>;
}
