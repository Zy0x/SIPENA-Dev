import { logger } from "@/observability/logger";

export function captureError(error: unknown, context?: Record<string, unknown>) {
  logger.error("Captured error", { error, context });
}
