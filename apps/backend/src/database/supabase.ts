import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

if (!supabaseUrl) {
  throw new Error("Missing SUPABASE_URL / VITE_SUPABASE_URL environment variable.");
}

// Client admin dengan akses penuh (Service Role) untuk logic server-side terpercaya
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Helper untuk membuat client aman dengan otorisasi Bearer JWT milik user tertentu
export function createSupabaseUserClient(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
