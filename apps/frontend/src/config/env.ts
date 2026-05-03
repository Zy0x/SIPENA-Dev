import { z } from "zod";

const envSchema = z.object({
  VITE_APP_NAME: z.string().default("SIPENA"),
  VITE_APP_ENV: z.string().default("development"),
  VITE_AUTH_PROVIDER: z.enum(["supabase", "http", "mock"]).default("supabase"),
  VITE_DATA_PROVIDER: z.enum(["supabase", "http", "mock"]).default("supabase"),
  VITE_STORAGE_PROVIDER: z.enum(["supabase", "http", "cloudflare-r2", "mock"]).default("supabase"),
  VITE_REALTIME_PROVIDER: z.enum(["supabase", "http", "websocket", "sse", "mock"]).default("supabase"),
  VITE_FUNCTION_PROVIDER: z.enum(["netlify", "cloudflare", "http", "mock"]).default("netlify"),
  VITE_API_BASE_URL: z.string().default("http://localhost:3000/api"),
  VITE_SUPABASE_URL: z.string().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  VITE_FEATURE_PWA_INSTALL: z.coerce.boolean().default(true),
  VITE_FEATURE_OFFLINE_MODE: z.coerce.boolean().default(true),
  VITE_FEATURE_REALTIME: z.coerce.boolean().default(true),
  VITE_FEATURE_ANALYTICS: z.coerce.boolean().default(false),
  VITE_FEATURE_PAYMENTS: z.coerce.boolean().default(false),
  VITE_FEATURE_BETA_DASHBOARD: z.coerce.boolean().default(false),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

if (!parsedEnv.success) {
  console.error("[config] Invalid frontend environment", parsedEnv.error.flatten().fieldErrors);
}

export const env = parsedEnv.success ? parsedEnv.data : envSchema.parse({});
