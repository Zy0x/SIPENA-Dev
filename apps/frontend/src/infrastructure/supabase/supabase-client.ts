/**
 * Supabase infrastructure client.
 *
 * This is the only frontend module allowed to create a Supabase client.
 * UI/components/pages should depend on repositories/use-cases. Existing code
 * is temporarily bridged through core/repositories/supabase-compat.repository
 * until feature-by-feature ports are completed.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './supabase.types';

const EXTERNAL_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const EXTERNAL_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const parsedProjectId = (() => {
  try {
    return new URL(EXTERNAL_SUPABASE_URL).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
})();

if (!EXTERNAL_SUPABASE_URL || !EXTERNAL_SUPABASE_ANON_KEY) {
  console.warn(
    "[config] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Supabase provider calls will fail until env is configured.",
  );
}

/**
 * Supabase client yang terhubung ke database eksternal
 * Gunakan client ini untuk semua operasi database
 */
export const supabaseExternal = createClient<Database>(
  EXTERNAL_SUPABASE_URL, 
  EXTERNAL_SUPABASE_ANON_KEY, 
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'sipena-external-auth',
    }
  }
);

// Export URL untuk edge functions - SELALU gunakan URL Supabase eksternal
export const SUPABASE_EXTERNAL_URL = EXTERNAL_SUPABASE_URL;
export const EDGE_FUNCTIONS_URL = EXTERNAL_SUPABASE_URL ? `${EXTERNAL_SUPABASE_URL}/functions/v1` : "";
export const SUPABASE_EXTERNAL_PROJECT_ID = parsedProjectId;
export const SUPABASE_EXTERNAL_ANON_KEY = EXTERNAL_SUPABASE_ANON_KEY;

// ============================================================================
// ADMIN AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Admin login via edge function
 * Menggunakan password yang tersimpan di Supabase Secret (ADMIN_DB_PASSWORD)
 */
export async function adminLogin(password: string) {
  try {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "login",
        password,
      }),
    });

    const result = await response.json();

    if (result.success) {
      return {
        success: true,
        token: result.token,
        message: result.message,
      };
    } else {
      return {
        success: false,
        error: result.error || "Login failed",
      };
    }
  } catch (error) {
    console.error("Admin login error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify admin session token
 * Token berlaku 24 jam sejak login
 */
export async function verifyAdminToken(token: string): Promise<{
  success: boolean;
  valid: boolean;
  error?: string;
}> {
  try {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "verify",
        token,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Token verification error:", error);
    return { success: false, valid: false, error: "Koneksi gagal" };
  }
}

/**
 * Validate password untuk operasi backend lainnya
 * Digunakan oleh fungsi-fungsi yang memerlukan admin password
 */
export async function validateAdminPassword(password: string): Promise<{
  success: boolean;
  valid: boolean;
}> {
  try {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: "validate-password",
        password,
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Password validation error:", error);
    return { success: false, valid: false };
  }
}
