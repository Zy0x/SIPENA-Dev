export const MAX_LOGIN_FAILURES = 3;
export const LOGIN_LOCKOUT_STEPS_MS = [
  15 * 1000,
  60 * 1000,
  5 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
] as const;
export const LOGIN_LOCKOUT_MS = LOGIN_LOCKOUT_STEPS_MS[2];
export const LOGIN_LOCKOUT_RESET_REQUEST_MIN_LEVEL = 6;

const STORAGE_KEY = "sipena_login_attempt_guard";

type AttemptRecord = {
  failures: number;
  lockedUntil: number | null;
  lastFailureAt: number | null;
};

export type LoginAttemptSnapshot = {
  failures: number;
  attemptsRemaining: number;
  isLocked: boolean;
  lockedUntil: number | null;
  remainingMs: number;
  lockoutLevel: number;
  lockoutDurationMs: number;
  canRequestReset: boolean;
};

const memoryAttempts: Record<string, AttemptRecord> = {};

export function normalizeLoginIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function sanitizeRecord(record: Partial<AttemptRecord> | undefined): AttemptRecord {
  const failures = Number.isFinite(record?.failures) ? Math.max(0, Math.floor(record?.failures ?? 0)) : 0;
  const lockedUntil = Number.isFinite(record?.lockedUntil) && (record?.lockedUntil ?? 0) > 0
    ? Math.floor(record?.lockedUntil ?? 0)
    : null;
  const lastFailureAt = Number.isFinite(record?.lastFailureAt) && (record?.lastFailureAt ?? 0) > 0
    ? Math.floor(record?.lastFailureAt ?? 0)
    : null;

  return { failures, lockedUntil, lastFailureAt };
}

function readAttempts(): Record<string, AttemptRecord> {
  if (!canUseLocalStorage()) return { ...memoryAttempts };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, Partial<AttemptRecord>>;
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, sanitizeRecord(value)])
    );
  } catch {
    return {};
  }
}

function writeAttempts(attempts: Record<string, AttemptRecord>): void {
  Object.keys(memoryAttempts).forEach((key) => delete memoryAttempts[key]);
  Object.assign(memoryAttempts, attempts);

  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
  } catch {
    // Keep the in-memory fallback so the current page session remains protected.
  }
}

function toSnapshot(record: AttemptRecord, now: number): LoginAttemptSnapshot {
  const remainingMs = record.lockedUntil ? Math.max(0, record.lockedUntil - now) : 0;
  const isLocked = remainingMs > 0;
  const failures = record.failures;
  const failuresInCurrentGroup = failures % MAX_LOGIN_FAILURES;
  const attemptsRemaining = isLocked ? 0 : MAX_LOGIN_FAILURES - failuresInCurrentGroup;
  const lockoutLevel = isLocked ? getLockoutLevelForFailures(failures) : 0;
  const lockoutDurationMs = isLocked ? getLockoutDurationForLevel(lockoutLevel) : 0;

  return {
    failures,
    attemptsRemaining,
    isLocked,
    lockedUntil: isLocked ? record.lockedUntil : null,
    remainingMs,
    lockoutLevel,
    lockoutDurationMs,
    canRequestReset: isLocked && lockoutLevel >= LOGIN_LOCKOUT_RESET_REQUEST_MIN_LEVEL,
  };
}

export function getLockoutLevelForFailures(failures: number): number {
  if (failures < MAX_LOGIN_FAILURES) return 0;
  return Math.ceil(failures / MAX_LOGIN_FAILURES);
}

export function getLockoutDurationForLevel(level: number): number {
  if (level <= 0) return 0;
  return LOGIN_LOCKOUT_STEPS_MS[Math.min(level, LOGIN_LOCKOUT_STEPS_MS.length) - 1];
}

export function getLoginAttemptSnapshot(identifier: string, now = Date.now()): LoginAttemptSnapshot {
  const key = normalizeLoginIdentifier(identifier);
  if (!key) {
    return toSnapshot({ failures: 0, lockedUntil: null, lastFailureAt: null }, now);
  }

  const attempts = readAttempts();
  const record = sanitizeRecord(attempts[key]);

  if (record.lockedUntil && record.lockedUntil <= now) {
    record.lockedUntil = null;
    attempts[key] = record;
    writeAttempts(attempts);
  }

  return toSnapshot(record, now);
}

export function recordFailedLoginAttempt(identifier: string, now = Date.now()): LoginAttemptSnapshot {
  const key = normalizeLoginIdentifier(identifier);
  if (!key) {
    return toSnapshot({ failures: 0, lockedUntil: null, lastFailureAt: null }, now);
  }

  const attempts = readAttempts();
  const existing = sanitizeRecord(attempts[key]);

  if (existing.lockedUntil && existing.lockedUntil > now) {
    return toSnapshot(existing, now);
  }

  const failures = existing.failures + 1;
  const lockoutLevel = failures % MAX_LOGIN_FAILURES === 0 ? getLockoutLevelForFailures(failures) : 0;
  const lockedUntil = lockoutLevel > 0 ? now + getLockoutDurationForLevel(lockoutLevel) : null;
  const next = { failures, lockedUntil, lastFailureAt: now };
  attempts[key] = next;
  writeAttempts(attempts);

  return toSnapshot(next, now);
}

export function clearLoginAttempt(identifier: string): void {
  const key = normalizeLoginIdentifier(identifier);
  if (!key) return;

  const attempts = readAttempts();
  delete attempts[key];
  writeAttempts(attempts);
}

export function clearLoginLockout(identifier: string): LoginAttemptSnapshot {
  clearLoginAttempt(identifier);
  return getLoginAttemptSnapshot(identifier);
}

export function formatLoginLockDuration(remainingMs: number): string {
  if (remainingMs <= 0) return "sebentar";

  const totalSeconds = Math.ceil(remainingMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds} detik`;

  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} menit`;

  const totalHours = Math.ceil(totalMinutes / 60);
  return `${totalHours} jam`;
}
