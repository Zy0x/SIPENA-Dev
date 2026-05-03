import { env } from "@/config/env";

const enabled = env.VITE_APP_ENV !== "production";

export const logger = {
  debug: (...args: unknown[]) => {
    if (enabled) console.debug("[sipena]", ...args);
  },
  info: (...args: unknown[]) => console.info("[sipena]", ...args),
  warn: (...args: unknown[]) => console.warn("[sipena]", ...args),
  error: (...args: unknown[]) => console.error("[sipena]", ...args),
};
