import type {
  AttendanceCalendarEventCanonical,
  AttendanceDatasetCanonical,
  AttendanceHolidayCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode,
} from "../canonical";
import type { AttendanceHolidayInputItem } from "@/lib/attendanceHolidayGrouping";
import type {
  AttendanceCanonicalExportBridgeResult,
  AttendanceCanonicalExportSettings,
  AttendanceExportJumlahStatusCode,
  AttendanceLegacyExportPayload,
  AttendanceLegacyPrintDataset,
} from "./attendanceExportCanonical.types";

const DAY_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] as const;
const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;
const DEFAULT_JUMLAH_STATUSES: readonly AttendanceExportJumlahStatusCode[] = ["S", "I", "A", "D"];

function parseIsoDateParts(date: string) {
  const [yearRaw, monthRaw, dayRaw] = date.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  return { year, month, day };
}

function getDayOfWeek(date: string, fallback: number) {
  const { year, month, day } = parseIsoDateParts(date);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return fallback;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function formatDayMonth(date: string) {
  const { month, day } = parseIsoDateParts(date);
  const monthName = MONTH_NAMES[month - 1] ?? "";
  return `${day} ${monthName.slice(0, 3)}`.trim();
}

function formatMonthLabel(month: string) {
  const [yearRaw, monthRaw] = month.split("-");
  const monthIndex = Number(monthRaw) - 1;
  const monthName = MONTH_NAMES[monthIndex] ?? monthRaw ?? month;
  return `${monthName} ${yearRaw}`.trim();
}

function formatExportTimeLabel(now = new Date()) {
  const day = now.getDate();
  const month = MONTH_NAMES[now.getMonth()]?.slice(0, 3) ?? "";
  const year = now.getFullYear();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hour}:${minute}`;
}

function normalizeDescription(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildRecordKey(studentId: string, date: string) {
  return `${studentId}\u0000${date}`;
}

function isCountableStatus(status: AttendanceStatusCode): status is AttendanceExportJumlahStatusCode {
  return status === "H" || status === "I" || status === "S" || status === "A" || status === "D";
}

function createHolidayItem(holiday: AttendanceHolidayCanonical): AttendanceHolidayInputItem | null {
  const description = normalizeDescription(holiday.description);
  if (!description || description === "Hari Kerja") return null;

  return {
    date: holiday.date,
    dayNumber: parseIsoDateParts(holiday.date).day,
    description,
    source: holiday.isNational ? "national" : "custom",
  };
}

function createEventItem(event: AttendanceCalendarEventCanonical): AttendanceHolidayInputItem | null {
  const label = normalizeDescription(event.label);
  const description = normalizeDescription(event.description);
  const text = normalizeDescription(description ? `${label} \u2014 ${description}` : label);
  if (!text) return null;

  return {
    date: event.date,
    dayNumber: parseIsoDateParts(event.date).day,
    description: text,
    source: "event",
  };
}

function sortByDate<T extends { date: string }>(items: readonly T[]) {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}

function buildLookupMaps(dataset: AttendanceDatasetCanonical) {
  const recordsByStudentDate = new Map<string, AttendanceRecordCanonical>();
  for (const record of dataset.records) {
    recordsByStudentDate.set(buildRecordKey(record.studentId, record.date), record);
  }

  const holidaysByDate = new Map(sortByDate(dataset.holidays).map((holiday) => [holiday.date, holiday]));
  const eventsByDate = new Map(sortByDate(dataset.dayEvents).map((event) => [event.date, event]));

  return { recordsByStudentDate, holidaysByDate, eventsByDate };
}

export function buildAttendanceLegacyExportPayloadFromCanonical(
  dataset: AttendanceDatasetCanonical,
  settings: AttendanceCanonicalExportSettings = {}
): AttendanceLegacyExportPayload {
  const days = sortByDate(dataset.days);
  const { recordsByStudentDate, holidaysByDate, eventsByDate } = buildLookupMaps(dataset);
  const jumlahStatuses = new Set<AttendanceExportJumlahStatusCode>(settings.jumlahStatusCodes ?? DEFAULT_JUMLAH_STATUSES);
  const notes: string[] = [];

  const rows = dataset.students.map((student, index) => {
    const totals = { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 };
    const cells = days.map((day) => {
      // A true holiday is one explicitly named or in the holidays map.
      // Plain weekends (!isEffective because Sat/Sun) are NOT holidays.
      const isExplicitHoliday = !!day.holidayName || holidaysByDate.has(day.date);
      const isNonEffective = !day.isEffective;
      const event = !!day.eventName || eventsByDate.has(day.date);
      const record = recordsByStudentDate.get(buildRecordKey(student.id, day.date));

      // Preserve explicit records even on holidays (e.g. makeup class on a public holiday).
      // Only fall back to "L" when the day is non-effective and no record exists.
      const value = record?.status ?? (isNonEffective ? "L" : "-");
      const holiday = isExplicitHoliday;

      if (!isNonEffective && isCountableStatus(value)) {
        totals[value] += 1;
        if (jumlahStatuses.has(value)) {
          totals.total += 1;
        }
      }

      if (record?.note) {
        notes.push(`${student.name} (${formatDayMonth(day.date)}): ${record.note}`);
      }

      return {
        value,
        isHoliday: holiday,
        hasEvent: event,
      };
    });

    return {
      id: student.id,
      number: index + 1,
      name: student.name,
      nisn: student.nisn,
      cells,
      totals,
    };
  });

  const holidayItems = sortByDate(dataset.holidays)
    .map(createHolidayItem)
    .filter((item): item is AttendanceHolidayInputItem => item !== null);
  const eventItems = sortByDate(dataset.dayEvents)
    .map(createEventItem)
    .filter((item): item is AttendanceHolidayInputItem => item !== null);

  return {
    className: settings.className ?? dataset.classId,
    monthLabel: settings.monthLabel ?? formatMonthLabel(dataset.month),
    exportTimeLabel: settings.exportTimeLabel ?? formatExportTimeLabel(),
    workDayFormatLabel: settings.workDayFormatLabel ?? "6 Hari (Senin-Sabtu)",
    effectiveDays: settings.effectiveDays ?? days.filter((day) => day.isEffective).length,
    rows,
    days: days.map((day) => {
      const dayOfWeek = getDayOfWeek(day.date, day.dayOfWeek);
      // Only flag as holiday if explicitly named or in the holidays map — plain weekends are not holidays.
      const isExplicitHoliday = !!day.holidayName || holidaysByDate.has(day.date);
      const event = !!day.eventName || eventsByDate.has(day.date);
      return {
        key: day.date,
        dayName: DAY_NAMES[dayOfWeek] ?? "",
        dateLabel: String(parseIsoDateParts(day.date).day),
        isHoliday: isExplicitHoliday,
        hasEvent: event,
      };
    }),
    notes,
    holidays: holidayItems.map((item) => `${formatDayMonth(item.date)}: ${item.description}`),
    events: eventItems.map((item) => `${formatDayMonth(item.date)}: ${item.description}`),
    holidayItems,
    eventItems,
  };
}

export function buildAttendancePrintDatasetFromLegacyPayload(
  payload: AttendanceLegacyExportPayload
): AttendanceLegacyPrintDataset {
  return {
    className: payload.className,
    monthLabel: payload.monthLabel,
    exportTimeLabel: payload.exportTimeLabel,
    workDayFormatLabel: payload.workDayFormatLabel,
    effectiveDays: payload.effectiveDays,
    rows: payload.rows,
    days: payload.days,
    notes: payload.notes,
    holidayItems: payload.holidayItems ?? [],
    eventItems: payload.eventItems ?? [],
  };
}

export function buildAttendanceExportBridgeFromCanonical(
  dataset: AttendanceDatasetCanonical,
  settings: AttendanceCanonicalExportSettings = {}
): AttendanceCanonicalExportBridgeResult {
  const previewData = buildAttendanceLegacyExportPayloadFromCanonical(dataset, settings);
  return {
    previewData,
    printDataset: buildAttendancePrintDatasetFromLegacyPayload(previewData),
    includeSignature: Boolean(settings.includeSignature),
    signature: settings.signature ?? null,
  };
}
