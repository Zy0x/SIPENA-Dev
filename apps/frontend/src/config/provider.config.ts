import { env } from "./env";

export const providerConfig = {
  auth: env.VITE_AUTH_PROVIDER,
  data: env.VITE_DATA_PROVIDER,
  storage: env.VITE_STORAGE_PROVIDER,
  realtime: env.VITE_REALTIME_PROVIDER,
  functions: env.VITE_FUNCTION_PROVIDER,
  apiBaseUrl: env.VITE_API_BASE_URL,
};
