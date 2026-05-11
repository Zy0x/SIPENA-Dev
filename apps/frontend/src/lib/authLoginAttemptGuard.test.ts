import { beforeEach, describe, expect, it } from "vitest";
import {
  clearLoginAttempt,
  formatLoginLockDuration,
  getLoginAttemptSnapshot,
  getLockoutDurationForLevel,
  LOGIN_LOCKOUT_MS,
  LOGIN_LOCKOUT_RESET_REQUEST_MIN_LEVEL,
  LOGIN_LOCKOUT_STEPS_MS,
  MAX_LOGIN_FAILURES,
  normalizeLoginIdentifier,
  recordFailedLoginAttempt,
} from "./authLoginAttemptGuard";

describe("authLoginAttemptGuard", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes login identifiers before storing attempts", () => {
    expect(normalizeLoginIdentifier("  Guru@Sekolah.ID ")).toBe("guru@sekolah.id");
  });

  it("locks login after three failed attempts with the first-tier duration", () => {
    const now = 1_000;

    expect(recordFailedLoginAttempt("Guru@Sekolah.ID", now)).toMatchObject({
      failures: 1,
      attemptsRemaining: MAX_LOGIN_FAILURES - 1,
      isLocked: false,
    });
    expect(recordFailedLoginAttempt(" guru@sekolah.id ", now + 1)).toMatchObject({
      failures: 2,
      attemptsRemaining: MAX_LOGIN_FAILURES - 2,
      isLocked: false,
    });

    const locked = recordFailedLoginAttempt("GURU@SEKOLAH.ID", now + 2);

    expect(locked.failures).toBe(MAX_LOGIN_FAILURES);
    expect(locked.attemptsRemaining).toBe(0);
    expect(locked.isLocked).toBe(true);
    expect(locked.lockoutLevel).toBe(1);
    expect(locked.lockedUntil).toBe(now + 2 + LOGIN_LOCKOUT_STEPS_MS[0]);
  });

  it("does not extend an active lockout when login is retried", () => {
    const now = 10_000;

    recordFailedLoginAttempt("guru@sekolah.id", now);
    recordFailedLoginAttempt("guru@sekolah.id", now + 1);
    const locked = recordFailedLoginAttempt("guru@sekolah.id", now + 2);
    const retried = recordFailedLoginAttempt("guru@sekolah.id", now + 5_000);

    expect(retried.isLocked).toBe(true);
    expect(retried.lockedUntil).toBe(locked.lockedUntil);
  });

  it("keeps the failure tier after an expired lockout and escalates every three failures", () => {
    const now = 20_000;

    recordFailedLoginAttempt("guru@sekolah.id", now);
    recordFailedLoginAttempt("guru@sekolah.id", now + 1);
    recordFailedLoginAttempt("guru@sekolah.id", now + 2);

    expect(getLoginAttemptSnapshot("guru@sekolah.id", now + LOGIN_LOCKOUT_STEPS_MS[0] + 3)).toMatchObject({
      failures: 3,
      isLocked: false,
      attemptsRemaining: MAX_LOGIN_FAILURES,
    });

    recordFailedLoginAttempt("guru@sekolah.id", now + LOGIN_LOCKOUT_STEPS_MS[0] + 4);
    recordFailedLoginAttempt("guru@sekolah.id", now + LOGIN_LOCKOUT_STEPS_MS[0] + 5);
    const secondLock = recordFailedLoginAttempt("guru@sekolah.id", now + LOGIN_LOCKOUT_STEPS_MS[0] + 6);

    expect(secondLock).toMatchObject({
      failures: 6,
      isLocked: true,
      lockoutLevel: 2,
      lockoutDurationMs: LOGIN_LOCKOUT_STEPS_MS[1],
    });
  });

  it("clears records after successful login or approved reset", () => {
    const now = 30_000;

    recordFailedLoginAttempt("guru@sekolah.id", now);
    clearLoginAttempt("guru@sekolah.id");

    expect(getLoginAttemptSnapshot("guru@sekolah.id", now + 1)).toMatchObject({
      failures: 0,
      isLocked: false,
    });
  });

  it("uses the requested lockout duration ladder and reset request threshold", () => {
    expect(LOGIN_LOCKOUT_MS).toBe(LOGIN_LOCKOUT_STEPS_MS[2]);
    expect(LOGIN_LOCKOUT_STEPS_MS).toEqual([
      15 * 1000,
      60 * 1000,
      5 * 60 * 1000,
      30 * 60 * 1000,
      60 * 60 * 1000,
      6 * 60 * 60 * 1000,
      12 * 60 * 60 * 1000,
      24 * 60 * 60 * 1000,
    ]);
    expect(getLockoutDurationForLevel(99)).toBe(24 * 60 * 60 * 1000);

    const now = 40_000;
    window.localStorage.setItem("sipena_login_attempt_guard", JSON.stringify({
      "guru@sekolah.id": {
        failures: (LOGIN_LOCKOUT_RESET_REQUEST_MIN_LEVEL * MAX_LOGIN_FAILURES) - 1,
        lockedUntil: null,
        lastFailureAt: now,
      },
    }));
    const sixthLevel = recordFailedLoginAttempt(
      "guru@sekolah.id",
      now + 1
    );
    expect(sixthLevel.lockoutLevel).toBe(LOGIN_LOCKOUT_RESET_REQUEST_MIN_LEVEL);
    expect(sixthLevel.canRequestReset).toBe(true);
  });

  it("formats remaining lock duration for auth feedback", () => {
    expect(formatLoginLockDuration(0)).toBe("sebentar");
    expect(formatLoginLockDuration(11_000)).toBe("11 detik");
    expect(formatLoginLockDuration(61_000)).toBe("2 menit");
    expect(formatLoginLockDuration(6 * 60 * 60 * 1000)).toBe("6 jam");
  });
});
