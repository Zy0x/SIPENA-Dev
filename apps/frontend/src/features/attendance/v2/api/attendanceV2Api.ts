import { httpRequest } from "@/infrastructure/http/http.client";
import type {
  AttendanceDatasetCanonical,
  AttendanceRecordPatch,
} from "../../canonical/canonical.types";
import type {
  AttendanceLockPatch,
  AttendanceHolidayPatch,
  AttendanceDayEventPatch,
  AttendanceNotePatchBody,
} from "../attendanceV2.types";

export const attendanceV2Api = {
  getRuntime: async (token: string) => {
    return httpRequest<any>("/attendance/runtime", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getDataset: async (classId: string, month: string, token: string) => {
    return httpRequest<{ data: AttendanceDatasetCanonical; issues: any[] }>(
      `/attendance/v2?classId=${classId}&month=${month}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
  },

  applyPatch: async (patch: AttendanceRecordPatch, token: string) => {
    return httpRequest<{ data: any; error?: any }>("/attendance/v2/record", {
      method: "POST",
      body: JSON.stringify(patch),
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  applyBulkPatch: async (patches: AttendanceRecordPatch[], token: string) => {
    return httpRequest<{ data: any; error?: any }>("/attendance/v2/bulk", {
      method: "POST",
      body: JSON.stringify({ patches }),
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  updateNote: async (notePatch: AttendanceNotePatchBody, token: string) => {
    return httpRequest<{ data: any; error?: any }>("/attendance/v2/note", {
      method: "PATCH",
      body: JSON.stringify(notePatch),
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  toggleHoliday: async (holidayPatch: AttendanceHolidayPatch, token: string) => {
    return httpRequest<{ data: any; error?: any }>("/attendance/v2/holiday", {
      method: "POST",
      body: JSON.stringify(holidayPatch),
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  upsertDayEvent: async (dayEventPatch: AttendanceDayEventPatch, token: string) => {
    return httpRequest<{ data: any; error?: any }>("/attendance/v2/day-event", {
      method: "POST",
      body: JSON.stringify(dayEventPatch),
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  deleteDayEvent: async (date: string, token: string) => {
    return httpRequest<{ data: any; error?: any }>("/attendance/v2/day-event", {
      method: "DELETE",
      body: JSON.stringify({ date }),
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  toggleLock: async (lockPatch: AttendanceLockPatch, token: string) => {
    return httpRequest<{ data: any; error?: any }>("/attendance/v2/lock", {
      method: "POST",
      body: JSON.stringify(lockPatch),
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getAuditLogs: async (classId: string, token: string) => {
    return httpRequest<{ data: any[]; error?: any }>(`/attendance/v2/audit?classId=${classId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },

  getShadowReport: async (token: string) => {
    return httpRequest<{ data: any; error?: any }>("/attendance/v2/shadow/report", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};
