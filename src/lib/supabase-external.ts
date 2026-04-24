/**
 * External Supabase Client Configuration
 * 
 * File ini mengkonfigurasi koneksi ke Supabase eksternal.
 * Semua operasi database akan menggunakan client ini.
 * 
 * PENTING: Semua edge functions harus dipanggil melalui EDGE_FUNCTIONS_URL
 * yang mengarah ke Supabase eksternal, bukan Lovable Cloud.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

// Kredensial Supabase Eksternal
const EXTERNAL_SUPABASE_URL = 'https://jdncrsmjvbweyxcbtnou.supabase.co';
const EXTERNAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkbmNyc21qdmJ3ZXl4Y2J0bm91Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Mzg5MjAsImV4cCI6MjA4NDExNDkyMH0.-pK8BeqAHiURkbjdF4s6Q60cI_CTg0D-5TFVbM9ZaCo';

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
export const EDGE_FUNCTIONS_URL = 'https://jdncrsmjvbweyxcbtnou.supabase.co/functions/v1';
export const SUPABASE_EXTERNAL_PROJECT_ID = 'jdncrsmjvbweyxcbtnou';
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
