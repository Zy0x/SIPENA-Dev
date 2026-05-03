/**
 * Smart grouping for attendance holiday/event lists.
 *
 * Combines consecutive dates with identical descriptions into a single
 * range entry, e.g. "20-25 Cuti bersama Hari Raya Idul Fitri".
 *
 * Pure function — fully testable, no side effects.
 */

export interface AttendanceHolidayInputItem {
  /** ISO date string (yyyy-MM-dd) */
  date: string;
  /** Day-of-month number (1-31) */
  dayNumber: number;
  /** Original raw description (already month-filtered upstream) */
  description: string;
  /** Source of the holiday entry */
  source?: "custom" | "national" | "event";
}

export interface AttendanceHolidayGroup {
  startDay: number;
  endDay: number;
  description: string;
  source?: "custom" | "national" | "event";
  monthShort?: string;
  /** Pre-formatted display text, e.g. "20-25 Cuti bersama Hari Raya Idul Fitri" */
  text: string;
}

function normalizeDescription(description: string): string {
  return description
    .replace(/\s+/g, " ")
    .replace(/[\u2013\u2014]/g, "-") // en/em dash → hyphen
    .trim();
}

function resolveMonthShort(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("id-ID", { month: "short" }).replace(".", "");
}

/**
 * Group a flat list of holiday/event items by consecutive day numbers
 * with matching normalized descriptions.
 *
 * Items are assumed to already be filtered to a single month so that
 * `dayNumber` collisions cannot cross month boundaries.
 */
export function groupAttendanceHolidayRanges(
  items: AttendanceHolidayInputItem[],
): AttendanceHolidayGroup[] {
  if (!items.length) return [];

  const sorted = [...items]
    .map((item) => ({
      ...item,
      description: normalizeDescription(item.description),
    }))
    .sort((a, b) => a.dayNumber - b.dayNumber);

  const groups: AttendanceHolidayGroup[] = [];
  let current: AttendanceHolidayGroup | null = null;

  for (const item of sorted) {
    if (
      current &&
      item.dayNumber === current.endDay + 1 &&
      item.description === current.description &&
      (item.source ?? "custom") === (current.source ?? "custom")
    ) {
      current.endDay = item.dayNumber;
        current.text = formatGroupText(current.startDay, current.endDay, current.monthShort ?? "", current.description);
      continue;
    }

    if (current && item.dayNumber === current.endDay && item.description === current.description && (item.source ?? "custom") === (current.source ?? "custom")) {
      // duplicate same-day same-desc same-source — skip
      continue;
    }

    current = {
      startDay: item.dayNumber,
      endDay: item.dayNumber,
      description: item.description,
      source: item.source,
      monthShort: resolveMonthShort(item.date),
      text: formatGroupText(item.dayNumber, item.dayNumber, resolveMonthShort(item.date), item.description),
    };
    groups.push(current);
  }

  return groups;
}

function formatGroupText(start: number, end: number, monthShort: string, description: string): string {
  const dateLabel = start === end
    ? `${start}${monthShort ? ` ${monthShort}` : ""}`
    : `${start} - ${end}${monthShort ? ` ${monthShort}` : ""}`;
  return `${dateLabel} — ${description}`;
}

/**
 * Convenience wrapper that accepts the shape used by Attendance.tsx
 * (`"20 Mei: Cuti..."` strings already prefixed) and parses out the day.
 *
 * Returns the original list if parsing fails for any item — never throws.
 */
export function groupAttendanceLegacyStrings(
  legacyItems: string[],
): string[] {
  const parsed: AttendanceHolidayInputItem[] = [];
  let allParsed = true;

  for (const raw of legacyItems) {
    // Pattern: "20 Mei: Description" or "20 Mei — Description"
    const match = raw.match(/^(\d{1,2})\s+\S+\s*[:\u2013\u2014-]\s*(.+)$/);
    if (!match) {
      allParsed = false;
      break;
    }
    const day = Number.parseInt(match[1], 10);
    if (Number.isNaN(day)) {
      allParsed = false;
      break;
    }
    parsed.push({
      date: "",
      dayNumber: day,
      description: match[2].trim(),
    });
  }

  if (!allParsed) return legacyItems;

  return groupAttendanceHolidayRanges(parsed).map((group) => group.text);
}
