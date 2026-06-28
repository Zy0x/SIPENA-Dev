import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  validateDatasetQuery,
  validateDailySummaryQuery,
  validatePatchBody,
  validateBulkPatchBody,
  validateNotePatchBody,
  validateLockPatchBody,
  validateHolidayPatchBody,
  validateDayEventPatchBody,
} from "../../../../../backend/src/modules/attendance/validation/attendanceRequestValidation";
import { AttendanceService } from "../../../../../backend/src/modules/attendance/attendance.service";
import { attendanceController } from "../../../../../backend/src/modules/attendance/attendance.controller";
import { supabaseAdmin } from "../../../../../backend/src/database/supabase";
import type { IncomingMessage, ServerResponse } from "node:http";

// Mock supabaseAdmin
vi.mock("../../../../../backend/src/database/supabase", () => {
  const mockFrom = vi.fn().mockImplementation((table: string) => {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: "mocked-id" }, error: null }),
      insert: vi.fn().mockResolvedValue({ data: { id: "inserted-id" }, error: null }),
      update: vi.fn().mockResolvedValue({ data: { id: "updated-id" }, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });

  const mockRpc = vi.fn().mockResolvedValue({ data: { success: true, action: "CREATE" }, error: null });

  const mockAuth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123", email: "teacher@school.id" } }, error: null }),
  };

  return {
    supabaseAdmin: {
      from: mockFrom,
      rpc: mockRpc,
      auth: mockAuth,
    },
    createSupabaseUserClient: () => ({
      from: mockFrom,
      rpc: mockRpc,
    }),
  };
});

describe("Attendance V2 Backend Request Validation", () => {
  it("validates get dataset queries correctly", () => {
    const paramsValid = new URLSearchParams("classId=class-1&month=2026-06");
    const resValid = validateDatasetQuery(paramsValid);
    expect(resValid.valid).toBe(true);
    expect(resValid.query.classId).toBe("class-1");
    expect(resValid.query.month).toBe("2026-06");

    const paramsInvalid = new URLSearchParams("classId=&month=2026/06");
    const resInvalid = validateDatasetQuery(paramsInvalid);
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.issues.map((i) => i.code)).toContain("CLASS_ID_REQUIRED");
    expect(resInvalid.issues.map((i) => i.code)).toContain("MONTH_INVALID");
  });

  it("validates single record patch body", () => {
    const validBody = {
      studentId: "student-1",
      classId: "class-1",
      date: "2026-06-01",
      status: "H",
      note: "Hadir",
    };
    const resValid = validatePatchBody(validBody);
    expect(resValid.valid).toBe(true);
    expect(resValid.patch?.studentId).toBe("student-1");

    const invalidBody = {
      studentId: "",
      classId: "class-1",
      date: "2026/06/01",
      status: "INVALID",
    };
    const resInvalid = validatePatchBody(invalidBody);
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.issues.map((i) => i.code)).toContain("STUDENT_ID_REQUIRED");
    expect(resInvalid.issues.map((i) => i.code)).toContain("DATE_INVALID");
    expect(resInvalid.issues.map((i) => i.code)).toContain("STATUS_INVALID");
  });

  it("validates lock period patches", () => {
    const validBody = {
      classId: "class-1",
      month: "2026-06",
      isLocked: true,
    };
    const resValid = validateLockPatchBody(validBody);
    expect(resValid.valid).toBe(true);
    expect(resValid.lockPatch.isLocked).toBe(true);

    const invalidBody = {
      classId: "",
      month: "2026/06",
      isLocked: "yes",
    };
    const resInvalid = validateLockPatchBody(invalidBody);
    expect(resInvalid.valid).toBe(false);
    expect(resInvalid.issues.map((i) => i.code)).toContain("CLASS_ID_REQUIRED");
    expect(resInvalid.issues.map((i) => i.code)).toContain("MONTH_INVALID");
    expect(resInvalid.issues.map((i) => i.code)).toContain("IS_LOCKED_REQUIRED");
  });

  it("validates holiday patch body", () => {
    const validBody = { date: "2026-06-01", description: "Cuti Bersama" };
    expect(validateHolidayPatchBody(validBody).valid).toBe(true);

    const invalidBody = { date: "2026/06/01" };
    expect(validateHolidayPatchBody(invalidBody).valid).toBe(false);
  });

  it("validates day event patches", () => {
    const validBody = { date: "2026-06-01", label: "Event", action: "upsert" };
    expect(validateDayEventPatchBody(validBody).valid).toBe(true);

    const invalidBody = { date: "2026-06-01", action: "upsert", label: "" };
    expect(validateDayEventPatchBody(invalidBody).valid).toBe(false);
  });
});

describe("Attendance V2 Backend Service", () => {
  let service: AttendanceService;

  beforeEach(() => {
    service = new AttendanceService();
    vi.clearAllMocks();
  });

  it("resolves dataset from v2 adapter when engine is v2", async () => {
    const query = { classId: "class-1", month: "2026-06" };
    const runtime = {
      engine: "v2" as const,
      mode: "active" as const,
      source: "env" as const,
      guardResult: {
        isSafe: true,
        reason: "safe" as const,
        message: "OK",
        requestedEngine: "v2",
        forcedEngine: "v2" as const,
        forcedMode: "active" as const,
      },
      writesEnabled: true,
      isAdmin: false,
      isDebug: false,
      user: { id: "user-123", email: "teacher@school.id" } as any,
      token: "mock-token",
    };

    const spyGetDataset = vi.spyOn(service["v2"], "getDataset").mockResolvedValue({
      dataset: {
        classId: "class-1",
        month: "2026-06",
        students: [],
        records: [],
        days: [],
        holidays: [],
        dayEvents: [],
        locks: [],
      },
      issues: [],
    });

    await service.getDataset(query, runtime);
    expect(spyGetDataset).toHaveBeenCalledWith(query, runtime);
  });

  it("prevents write in active V2 mode when writes are disabled", async () => {
    const patch = { studentId: "student-1", classId: "class-1", date: "2026-06-01", status: "H" as const };
    const runtime = {
      engine: "v2" as const,
      mode: "active" as const,
      source: "env" as const,
      guardResult: {
        isSafe: true,
        reason: "safe" as const,
        message: "OK",
        requestedEngine: "v2",
        forcedEngine: "v2" as const,
        forcedMode: "active" as const,
      },
      writesEnabled: false, // disabled writes
      isAdmin: false,
      isDebug: false,
      user: { id: "user-123", email: "teacher@school.id" } as any,
      token: "mock-token",
    };

    const res = await service.applyPatch(patch, runtime);
    expect(res.statusCode).toBe(403);
    expect(res.error.code).toBe("ATTENDANCE_V2_WRITE_DISABLED");
  });
});

describe("Attendance V2 Controller integration routing", () => {
  it("rejects request if Authorization header is missing", async () => {
    const req = {
      url: "/api/attendance/v2?classId=class-1&month=2026-06",
      method: "GET",
      headers: {},
    } as unknown as IncomingMessage;

    const mockHeader = vi.fn();
    const mockEnd = vi.fn();
    const res = {
      statusCode: 200,
      setHeader: mockHeader,
      end: mockEnd,
    } as unknown as ServerResponse;

    const handled = await attendanceController(req, res);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(401);
    expect(mockEnd).toHaveBeenCalled();
  });
});
