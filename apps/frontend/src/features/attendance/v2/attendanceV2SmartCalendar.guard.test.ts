import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(__dirname, "../../../../../..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("Attendance V2 smart academic calendar guard", () => {
  it("keeps V2 calendar engine owned by backend and supports range, recurrence, priority, and effective day output", () => {
    const engine = readRepoFile("apps/backend/src/modules/attendance/v2/calendar/calendarEngine.ts");
    expect(engine).toContain("expandCalendarEvents");
    expect(engine).toContain("recurrenceRule");
    expect(engine).toContain("effectOnAttendance");
    expect(engine).toContain("priority");
    expect(engine).toContain("academicStartsOn");
    expect(engine).not.toContain("frontend/src");
  });

  it("adds only V2 additive database structures for academic calendar, event scope, recap, delegation, and snapshot", () => {
    const migration = readRepoFile("supabase/migrations/20260630034918_attendance_v2_smart_academic_calendar.sql");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.attendance_v2_schools");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.attendance_v2_academic_calendars");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.attendance_v2_calendar_events");
    expect(migration).toContain("scope_type TEXT NOT NULL");
    expect(migration).toContain("recurrence_rule JSONB");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.attendance_v2_recap_profiles");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.attendance_v2_delegations");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.attendance_v2_month_snapshots");
    expect(migration).not.toMatch(/ALTER TABLE public\.attendance_records\b/);
  });

  it("routes new calendar and snapshot APIs through V2 endpoints without changing V1 route names", () => {
    const controller = readRepoFile("apps/backend/src/modules/attendance/attendance.controller.ts");
    expect(controller).toContain("/attendance/v2/calendar");
    expect(controller).toContain("/attendance/v2/calendar-events");
    expect(controller).toContain("/attendance/v2/snapshots");
    expect(controller).toContain("/attendance/v2/restore");
    expect(controller).toContain('pathname === "/attendance" || pathname === "/attendance/v2"');
  });

  it("bridges legacy holiday/day-event tables through the V2 adapter while using calendar events as source of truth", () => {
    const adapter = readRepoFile("apps/backend/src/modules/attendance/v2/attendanceV2.adapter.ts");
    expect(adapter).toContain("attendance_v2_calendar_events");
    expect(adapter).toContain("legacyHolidayToEvent");
    expect(adapter).toContain("legacyDayEventToEvent");
    expect(adapter).toContain("computeMonthlySummaryFromProfile");
    expect(adapter).toContain("getCalendarContext");
  });
});
