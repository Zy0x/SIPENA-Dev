import { env } from "@/config/env";
import type { AuthPort } from "@/core/ports/auth.port";
import type { DatabasePort } from "@/core/ports/database.port";
import type { RealtimePort } from "@/core/ports/realtime.port";
import type { StoragePort } from "@/core/ports/storage.port";
import { HttpAuthAdapter } from "@/infrastructure/http/http-auth.adapter";
import { HttpDatabaseAdapter } from "@/infrastructure/http/http-database.adapter";
import { HttpRealtimeAdapter } from "@/infrastructure/http/http-realtime.adapter";
import { HttpStorageAdapter } from "@/infrastructure/http/http-storage.adapter";
import { MockAuthAdapter } from "@/infrastructure/mock/mock-auth.adapter";
import { MockDatabaseAdapter } from "@/infrastructure/mock/mock-database.adapter";
import { MockRealtimeAdapter } from "@/infrastructure/mock/mock-realtime.adapter";
import { MockStorageAdapter } from "@/infrastructure/mock/mock-storage.adapter";
import { SupabaseAuthAdapter } from "@/infrastructure/supabase/supabase-auth.adapter";
import { SupabaseDatabaseAdapter } from "@/infrastructure/supabase/supabase-database.adapter";
import { SupabaseRealtimeAdapter } from "@/infrastructure/supabase/supabase-realtime.adapter";
import { SupabaseStorageAdapter } from "@/infrastructure/supabase/supabase-storage.adapter";

function unsupportedProvider(kind: string, provider: string): never {
  throw new Error(
    `Provider ${provider} belum tersedia untuk ${kind}. Gunakan provider supabase, http, atau mock melalui environment.`,
  );
}

export interface AppProviders {
  auth: AuthPort;
  database: DatabasePort;
  storage: StoragePort;
  realtime: RealtimePort;
}

export function createAppProviders(): AppProviders {
  const auth =
    env.VITE_AUTH_PROVIDER === "supabase"
      ? new SupabaseAuthAdapter()
      : env.VITE_AUTH_PROVIDER === "http"
        ? new HttpAuthAdapter()
        : env.VITE_AUTH_PROVIDER === "mock"
          ? new MockAuthAdapter()
          : unsupportedProvider("auth", env.VITE_AUTH_PROVIDER);

  const database =
    env.VITE_DATA_PROVIDER === "supabase"
      ? new SupabaseDatabaseAdapter()
      : env.VITE_DATA_PROVIDER === "http"
        ? new HttpDatabaseAdapter()
        : env.VITE_DATA_PROVIDER === "mock"
          ? new MockDatabaseAdapter()
          : unsupportedProvider("data", env.VITE_DATA_PROVIDER);

  const storage =
    env.VITE_STORAGE_PROVIDER === "supabase"
      ? new SupabaseStorageAdapter()
      : env.VITE_STORAGE_PROVIDER === "http"
        ? new HttpStorageAdapter()
        : env.VITE_STORAGE_PROVIDER === "mock"
          ? new MockStorageAdapter()
          : unsupportedProvider("storage", env.VITE_STORAGE_PROVIDER);

  const realtime =
    env.VITE_REALTIME_PROVIDER === "supabase"
      ? new SupabaseRealtimeAdapter()
      : env.VITE_REALTIME_PROVIDER === "http" ||
          env.VITE_REALTIME_PROVIDER === "websocket" ||
          env.VITE_REALTIME_PROVIDER === "sse"
        ? new HttpRealtimeAdapter()
        : env.VITE_REALTIME_PROVIDER === "mock"
          ? new MockRealtimeAdapter()
          : unsupportedProvider("realtime", env.VITE_REALTIME_PROVIDER);

  return { auth, database, storage, realtime };
}

export const appProviders = createAppProviders();
