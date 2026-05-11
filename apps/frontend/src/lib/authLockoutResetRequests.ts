import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import type { LoginAttemptSnapshot } from "./authLoginAttemptGuard";

const FUNCTION_NAME = "auth-lockout-reset";
const REQUEST_STORAGE_KEY = "sipena_auth_lockout_reset_request";

export type AuthLockoutResetRequestStatus = "pending" | "approved" | "rejected" | "auto_approved";

export type AuthLockoutResetRequest = {
  id: string;
  email: string;
  normalized_email: string;
  reason: string;
  status: AuthLockoutResetRequestStatus;
  lockout_level: number;
  failure_count: number;
  locked_until: string | null;
  auto_approve_at: string;
  processed_at: string | null;
  processed_by: string | null;
  admin_response: string | null;
  created_at: string;
};

export type AuthLockoutResetSettings = {
  auto_approve_enabled: boolean;
  auto_approve_hours: number;
};

export type StoredAuthLockoutResetRequest = {
  id: string;
  email: string;
};

async function callAuthLockoutReset<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${EDGE_FUNCTIONS_URL}/${FUNCTION_NAME}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || "Gagal memproses request reset waiting time.");
  }

  return data as T;
}

export function getStoredAuthLockoutResetRequest(): StoredAuthLockoutResetRequest | null {
  try {
    const raw = window.localStorage.getItem(REQUEST_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredAuthLockoutResetRequest;
    if (!parsed?.id || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function storeAuthLockoutResetRequest(request: StoredAuthLockoutResetRequest): void {
  window.localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(request));
}

export function clearStoredAuthLockoutResetRequest(): void {
  window.localStorage.removeItem(REQUEST_STORAGE_KEY);
}

export async function createAuthLockoutResetRequest(args: {
  email: string;
  reason: string;
  captchaToken: string | null;
  snapshot: LoginAttemptSnapshot;
}): Promise<{ success: true; request: AuthLockoutResetRequest; message: string }> {
  return callAuthLockoutReset({
    action: "request",
    email: args.email,
    reason: args.reason,
    captchaToken: args.captchaToken,
    lockoutLevel: args.snapshot.lockoutLevel,
    failureCount: args.snapshot.failures,
    lockedUntil: args.snapshot.lockedUntil ? new Date(args.snapshot.lockedUntil).toISOString() : null,
  });
}

export async function checkAuthLockoutResetRequest(args: {
  requestId: string;
  email: string;
}): Promise<{ success: true; request: AuthLockoutResetRequest; settings: AuthLockoutResetSettings }> {
  return callAuthLockoutReset({
    action: "check",
    requestId: args.requestId,
    email: args.email,
  });
}

export async function listAuthLockoutResetRequests(adminPassword: string): Promise<{
  success: true;
  requests: AuthLockoutResetRequest[];
  settings: AuthLockoutResetSettings;
}> {
  return callAuthLockoutReset({
    action: "admin_list",
    adminPassword,
  });
}

export async function processAuthLockoutResetRequest(args: {
  requestId: string;
  adminPassword: string;
  decision: "approve" | "reject";
  adminResponse?: string;
}): Promise<{ success: true; request: AuthLockoutResetRequest; message: string }> {
  return callAuthLockoutReset({
    action: args.decision === "approve" ? "admin_approve" : "admin_reject",
    requestId: args.requestId,
    adminPassword: args.adminPassword,
    adminResponse: args.adminResponse,
  });
}

export async function processExpiredAuthLockoutResetRequests(adminPassword: string): Promise<{
  success: true;
  processed: number;
  settings: AuthLockoutResetSettings;
}> {
  return callAuthLockoutReset({
    action: "process_expired",
    adminPassword,
  });
}

export async function updateAuthLockoutResetSettings(args: {
  adminPassword: string;
  autoApproveEnabled: boolean;
}): Promise<{ success: true; settings: AuthLockoutResetSettings }> {
  return callAuthLockoutReset({
    action: "admin_update_settings",
    adminPassword: args.adminPassword,
    autoApproveEnabled: args.autoApproveEnabled,
  });
}
