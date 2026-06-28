import type { IncomingMessage, ServerResponse } from "node:http";
import { attendanceService } from "./attendance.service";
import { resolveAttendanceRuntime, updateAttendanceRuntimeOverride } from "./runtime/attendanceRuntime";
import {
  validateBulkPatchBody,
  validateDailySummaryQuery,
  validateDatasetQuery,
  validateNotePatchBody,
  validatePatchBody,
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

  try {
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

    if (method === "GET" && pathname === "/attendance") {
      const validation = validateDatasetQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }

      const result = await attendanceService.getDataset(validation.query, runtime);
      sendJson(res, 200, { data: result.dataset, issues: result.issues });
      return true;
    }

    if (method === "POST" && pathname === "/attendance") {
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

    if (method === "POST" && pathname === "/attendance/bulk") {
      const validation = validateBulkPatchBody(await readJson(req));
      if (!validation.valid || !validation.bulk) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const results = await Promise.all(
        validation.bulk.patches.map((patch) => attendanceService.applyPatch(patch, runtime))
      );
      const failed = results.find((r) => r.statusCode !== 200);
      if (failed) {
        sendJson(res, failed.statusCode, { error: failed.error });
        return true;
      }
      sendJson(res, 200, { data: { success: true } });
      return true;
    }

    if (method === "PATCH" && pathname === "/attendance/note") {
      const validation = validateNotePatchBody(await readJson(req));
      if (!validation.valid || !validation.notePatch) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.applyPatch(
        {
          studentId: validation.notePatch.studentId,
          classId: validation.notePatch.classId,
          date: validation.notePatch.date,
          status: "H",
          note: validation.notePatch.note,
        },
        runtime
      );
      if (result.error) {
        sendJson(res, result.statusCode, { error: result.error });
      } else {
        sendJson(res, result.statusCode, { data: result.data });
      }
      return true;
    }

    if (method === "GET" && pathname === "/attendance/summary/daily") {
      const validation = validateDailySummaryQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.getDailySummary(validation.query, runtime);
      sendJson(res, 200, { data: result.summary, issues: result.issues });
      return true;
    }

    if (method === "GET" && pathname === "/attendance/summary/monthly") {
      const validation = validateDatasetQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.getMonthlySummary(validation.query, runtime);
      sendJson(res, 200, { data: result.summary, issues: result.issues });
      return true;
    }

    if (method === "GET" && pathname === "/attendance/export-dataset") {
      const validation = validateDatasetQuery(params);
      if (!validation.valid) {
        sendValidationError(res, validation.issues);
        return true;
      }
      const result = await attendanceService.getExportDataset(validation.query, runtime);
      sendJson(res, 200, { data: result.exportDataset, issues: result.issues });
      return true;
    }

    if (method === "GET" && pathname === "/attendance/shadow/report") {
      const result = attendanceService.getShadowReport(runtime);
      if ("error" in result) {
        sendJson(res, result.statusCode, { error: result.error });
        return true;
      }
      sendJson(res, result.statusCode, { data: result.data });
      return true;
    }
  } catch (err: any) {
    sendJson(res, 400, {
      error: {
        code: "ATTENDANCE_REQUEST_PARSE_FAILED",
        message: `Body JSON tidak bisa dibaca: ${err.message || err}`,
      },
    });
    return true;
  }

  return false;
}
