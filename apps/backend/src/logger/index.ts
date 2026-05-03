export const backendLogger = {
  info: (...args: unknown[]) => console.info("[sipena-api]", ...args),
  error: (...args: unknown[]) => console.error("[sipena-api]", ...args),
};
