import { logger } from "@/observability/logger";

export function markPerformance(label: string) {
  if (typeof performance === "undefined") return;
  performance.mark(label);
  logger.debug("Performance mark", label);
}
