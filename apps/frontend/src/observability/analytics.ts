import { env } from "@/config/env";
import { logger } from "@/observability/logger";

export function trackEvent(name: string, properties?: Record<string, unknown>) {
  if (!env.VITE_FEATURE_ANALYTICS) return;
  logger.debug("Analytics event", { name, properties });
}
