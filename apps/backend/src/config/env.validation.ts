export function validateBackendEnv() {
  const missing = ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"].filter((key) => !process.env[key]);
  if (process.env.NODE_ENV === "production" && missing.length) {
    throw new Error(`Missing backend environment variables: ${missing.join(", ")}`);
  }
}
