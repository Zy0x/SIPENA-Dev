import type { IncomingMessage, ServerResponse } from "node:http";
import { attendanceService } from "./attendance.service";
import { resolveAttendanceRuntime, updateAttendanceRuntimeOverride } from "./runtime/attendanceRuntime";
import {
  validateBulkPatchBody,
  validateDailySummaryQuery,
  validateDatasetQuery,
  validateNotePatchBody,
  validatePatchBody,
  validateLockPatchBody,
  validateHolidayPatchBody,
  validateDayEventPatchBody,
} from "./validation/attendanceRequestValidation";
import type { AttendanceApiError, AttendanceApiSuccess, AttendanceValidationIssue } from "./attendance.types";

function sendJson<T>(res: ServerResponse, statusCode: number, payload: AttendanceApiSuccess<T> | AttendanceApiError) {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(payload));
}

function sendValidationError(res: ServerResponse, issues: AttendanceValidationIssue[]) {
  sendJson(res, 400, {
    error: {
      code: "ATTENDANCE_REQUEST_INVALID",
      message: "Request presensi tidak valid.",
      details: issues,
    },
  });
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function routePath(req: IncomingMessage): { pathname: string; params: URLSearchParams } {
  const url = new URL(req.url ?? "/", "http://localhost");
  return { pathname: url.pathname.replace(/^\/api/, ""), params: url.searchParams };
}

import { supabaseAdmin } from "../../database/supabase";

export async function attendanceController(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const { pathname, params } = routePath(req);
  const method = req.method ?? "GET";
  const runtime = resolveAttendanceRuntime(req);

  // Garansi pemisahan total V2 dari V1:
  // Jika path dimulai dengan /attendance/v2, paksa runtime menggunakan engine v2 secara terisolasi.
  if (pathname.startsWith("/attendance/v2")) {
    runtime.engine = "v2";
    runtime.mode = "active";
    runtime.writesEnabled = true;
  }

  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";

  if (!token) {
    sendJson(res, 401, {
      error: {
        code: "UNAUTHORIZED",
        message: "Header Authorization Bearer token wajib dikirim.",
      },
    });
    return true;
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    sendJson(res, 401, {
      error: {
        code: "UNAUTHORIZED",
        message: "Token tidak valid atau kedaluwarsa.",
      },
    });
    return true;
  }

  runtime.user = user;
  runtime.token = token;

  try {
    // 1. Runtime Config Endpoints
    if (method === "GET" && pathname === "/attendance/runtime") {
      sendJson(res, 200, {
        data: {
          engine: runtime.engine,
          mode: runtime.mode,
          source: runtime.source,
          guardResult: runtime.guardResult,
          writesEnabled: runtime.writesEnabled,
        },
      });
      return true;
    }

    if (method === "POST" && pathname === "/attendance/runtime") {
      if (!runtime.isAdmin) {
        sendJson(res, 403, {
          error: {
            code: "ATTENDANCE_RUNTIME_ADMIN_REQUIRED",
            message: "Perubahan runtime hanya boleh dilakukan oleh admin backend.",
          },
        });
        return true;
      }

      const body = (await readJson(req)) as { engine?: string; mode?: string };
      const guardResult = updateAttendanceRuntimeOverride(body.engine, body.mode);
      sendJson(res, guardResult.isSafe ? 200 : 400, { data: { guardResult } });
      return true;
    }

    // Promote V2 to V1 (Merge sandbox data to production)
    if (method === "POST" && pathname === "/attendance/v2/promote") {
      const body = (await readJson(req)) as { classId: string; month: string; workDayFormat?: "5days" | "6days" };
      if (!body.classId || !body.month) {
        sendJson(res, 400, {
          error: { code: "BAD_REQUEST", message: "classId dan month wajib dikirim." },
        });
        return true;
      }
      const formatVal = body.workDayFormat || "6days";
      const result = await attendanceService.promoteV2ToV1(body.classId, body.month, formatVal, runtime);
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    // 2. Fetch Dataset (V1/V2 mapped)
    if (method === "GET" && (pathname === "/attendance" || pathname === "/attendance/v2")) {
      const validation = validateDatasetQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }

      const result = await attendanceService.getDataset(validation.query, runtime);
      sendJson(res, 200, { data: result.dataset, issues: result.issues });
      return true;
    }

    // 3. Single Write / Mutate (V1/V2 mapped)
    if (method === "POST" && (pathname === "/attendance" || pathname === "/attendance/v2/record")) {
      const validation = validatePatchBody(await readJson(req));
      if (!validation.valid || !validation.patch) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.applyPatch(validation.patch, runtime);
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    // 4. Bulk Write / Mutate (V1/V2 mapped)
    if (method === "POST" && (pathname === "/attendance/bulk" || pathname === "/attendance/v2/bulk")) {
      const validation = validateBulkPatchBody(await readJson(req));
      if (!validation.valid || !validation.bulk) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.applyBulkPatch(validation.bulk.patches, runtime);
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    // 5. Update Catatan (V1/V2 mapped)
    if (method === "PATCH" && (pathname === "/attendance/note" || pathname === "/attendance/v2/note")) {
      const validation = validateNotePatchBody(await readJson(req));
      if (!validation.valid || !validation.notePatch) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.updateNote(validation.notePatch, runtime);
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    // 6. Holiday Operations V2
    if ((method === "POST" || method === "DELETE") && pathname === "/attendance/v2/holiday") {
      const validation = validateHolidayPatchBody(await readJson(req));
      if (!validation.valid || !validation.holidayPatch) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.toggleHoliday(validation.holidayPatch, runtime);
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    // 7. Day Event Operations V2
    if (method === "POST" && pathname === "/attendance/v2/day-event") {
      const validation = validateDayEventPatchBody(await readJson(req));
      if (!validation.valid || !validation.dayEventPatch) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.upsertDayEvent(validation.dayEventPatch, runtime);
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    if (method === "DELETE" && pathname === "/attendance/v2/day-event") {
      const body = (await readJson(req)) as any;
      const date = body?.date;
      if (!date) {
        sendValidationError(res, [{ severity: "error", code: "DATE_REQUIRED", message: "date wajib dikirim.", field: "date" }]);
        return true;
      }
      const result = await attendanceService.upsertDayEvent({ date, action: "delete" }, runtime);
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    // 8. Lock Operations V2
    if (method === "POST" && pathname === "/attendance/v2/lock") {
      const validation = validateLockPatchBody(await readJson(req));
      if (!validation.valid || !validation.lockPatch) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.toggleLock(validation.lockPatch, runtime);
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    // 9. Daily Summary
    if (method === "GET" && (pathname === "/attendance/summary/daily" || pathname === "/attendance/v2/summary/daily")) {
      const validation = validateDailySummaryQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.getDailySummary(validation.query, runtime);
      sendJson(res, 200, { data: result.summary, issues: result.issues });
      return true;
    }

    // 10. Monthly Summary
    if (method === "GET" && (pathname === "/attendance/summary/monthly" || pathname === "/attendance/v2/summary/monthly")) {
      const validation = validateDatasetQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.getMonthlySummary(validation.query, runtime);
      sendJson(res, 200, { data: result.summary, issues: result.issues });
      return true;
    }

    // 11. Yearly Summary V2
    if (method === "GET" && pathname === "/attendance/v2/summary/yearly") {
      const validation = validateDatasetQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.getDataset(validation.query, runtime);
      sendJson(res, 200, { data: { yearlySummary: [] }, issues: result.issues });
      return true;
    }

    // 12. Export Dataset
    if (method === "GET" && (pathname === "/attendance/export-dataset" || pathname === "/attendance/v2/export-dataset")) {
      const validation = validateDatasetQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.getExportDataset(validation.query, runtime);
      sendJson(res, 200, { data: result.exportDataset, issues: result.issues });
      return true;
    }

    // 13. Audit Log Fetch V2
    if (method === "GET" && pathname === "/attendance/v2/audit") {
      const classId = params.get("classId")?.trim() ?? "";
      if (!classId) {
        sendValidationError(res, [{ severity: "error", code: "CLASS_ID_REQUIRED", message: "classId wajib dikirim.", field: "classId" }]);
        return true;
      }
      const result = await attendanceService.getAuditLogs(classId, runtime);
      sendJson(res, result.statusCode, { data: result.data, error: result.error });
      return true;
    }

    // 14. Shadow Report
    if (method === "GET" && (pathname === "/attendance/shadow/report" || pathname === "/attendance/v2/shadow/report")) {
      const result = await attendanceService.getShadowReport(runtime);
      sendJson(res, result.statusCode, { data: result.data, error: result.error });
      return true;
    }
  } catch (err: any) {
    sendJson(res, 400, {
      error: {
        code: "ATTENDANCE_REQUEST_PARSE_FAILED",
        message: `Body JSON tidak bisa dibaca atau terhambat: ${err.message || err}`,
      },
    });
    return true;
  }

  return false;
}
