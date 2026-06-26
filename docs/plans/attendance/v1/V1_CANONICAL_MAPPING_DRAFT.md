# V1 CANONICAL MAPPING DRAFT: Attendance V2 Phase 02

## Objective
Document how locked V1 Presensi data can be represented in the canonical attendance model without changing V1 behavior.

## Evidence from actual repo files
- `apps/frontend/src/hooks/useAttendance.ts` exposes `AttendanceRecord`, `HolidayRecord`, `DayEvent`, `AttendanceLock`, `WorkDayFormat`, and `AttendanceStatusValue`.
- `apps/frontend/src/features/attendance/canonical/canonical.types.ts` defines canonical records, murid, class, day, holiday, event, lock, notes, summaries, yearly summaries, and export dataset.
- `apps/frontend/src/features/attendance/v1/attendanceV1.canonical.ts` implements pure, inactive mapping helpers for records, holidays, day events, locks, and dataset drafts.
- `apps/frontend/src/pages/Attendance.tsx` still owns monthly and yearly export transformations; Phase 02 does not move them.

## Findings
V1 stores only saved attendance statuses `H`, `I`, `S`, `A`, and `D`. Canonical status also includes display/derived values `L` and `-`.

`L` and `-` must not be written back to V1 as record status:
- `L`: derived leave/holiday display value from calendar logic.
- `-`: empty/no-record display value.

## Mapping table
| V1 source | Canonical target | Phase 02 rule |
|---|---|---|
| `AttendanceRecord.id` | `AttendanceRecordCanonical.id` | Use V1 id, fallback to `class_id:student_id:date`. |
| `AttendanceRecord.class_id` | `classId` | Direct mapping. |
| `AttendanceRecord.student_id` | `studentId` | Direct mapping. |
| `AttendanceRecord.date` | `date` | Direct `YYYY-MM-DD` string. |
| `AttendanceRecord.status` | `status` | Direct for `H/I/S/A/D`; missing status becomes `-` in read-only draft. |
| `AttendanceRecord.note` | `note` | `undefined` and empty absence become `null`; actual text is preserved. |
| `HolidayRecord.date` | `AttendanceHolidayCanonical.date` | Direct date mapping. |
| `HolidayRecord.description` | `description` | Direct mapping. |
| `HolidayRecord` | `isNational` | Phase 02 maps custom V1 hook holidays as `false`; national holidays remain page-derived/export-derived until later phase. |
| `DayEvent.date` | `AttendanceCalendarEventCanonical.date` | Direct date mapping. |
| `DayEvent.label` | `label` | Direct mapping. |
| `DayEvent.description` | `description` | Missing description becomes `null`. |
| `DayEvent.color` | `color` | Missing color becomes `blue`. |
| `AttendanceLock.class_id` | `AttendanceLockCanonical.classId` | Direct mapping. |
| `AttendanceLock.month` | `month` | Normalize V1 month-start date `YYYY-MM-DD` to `YYYY-MM`. |
| `AttendanceLock.is_locked` | `isLocked` | Direct mapping. |
| `AttendanceLock.user_id` | `lockedBy` | Direct mapping or `null`. |

## Students
Canonical `AttendanceStudentCanonical` is supplied from the page-level student list, not from `useAttendance.ts`.

Draft rule:
```txt
student.id   -> AttendanceStudentCanonical.id
student.name -> AttendanceStudentCanonical.name
student.nisn -> AttendanceStudentCanonical.nisn
```

## Class
Canonical `AttendanceClassCanonical` is supplied from the selected class metadata.

Draft rule:
```txt
class.id        -> AttendanceClassCanonical.id
class.name      -> AttendanceClassCanonical.name
class.class_kkm -> AttendanceClassCanonical.classKkm
```

## Month and day selection
V1 page state owns selected month/day. Canonical must represent:
- month as `YYYY-MM`;
- selected day as `YYYY-MM-DD` when a day-specific command/summary is required;
- work day format as metadata until V2 calendar rules own it.

## Records
Only saved V1 records become canonical records. Missing cells are represented by `-` in display mapping and should not become database rows.

## Status values
| Status | Meaning | Saved in V1 | Canonical handling |
|---|---|---:|---|
| `H` | Hadir | Yes | Direct. |
| `I` | Izin | Yes | Direct. |
| `S` | Sakit | Yes | Direct. |
| `A` | Alpa | Yes | Direct. |
| `D` | Dispensasi | Yes | Direct. |
| `L` | Libur / non-effective day | No | Derived only. |
| `-` | Empty / no record | No | Display/read-only only. |

## Holidays
V1 uses custom holiday records and page-level national holiday logic. Canonical holiday mapping must preserve the distinction:
- custom holidays from `attendance_holidays`;
- national holidays from page/library-derived calendar;
- `"Hari Kerja"` override must be treated as an effective day, not as a holiday.

## Day events
V1 day events map to canonical calendar events. Event color is display metadata and must not affect attendance status.

## Locks
V1 lock month uses month-start date. Canonical uses `YYYY-MM`. Phase 02 mapper normalizes this but does not perform writes.

## Notes
Notes are currently carried on `AttendanceRecord.note`. Canonical `AttendanceNoteCanonical` can be derived later from records with non-empty notes:

```txt
record.id + record.student_id + record.date + record.note
```

## Monthly summary
Monthly summary is currently derived in V1 page/hook logic. Future canonical mapping must count only effective days according to the same V1 calendar rules:
- `presentCount`: `H`;
- `sickCount`: `S`;
- `permissionCount`: `I`;
- `absentCount`: `A`;
- `dispensationCount`: `D`;
- `leaveCount`: derived `L`;
- `totalDays`: effective counted days.

## Daily summary
Daily summary is derived per selected date:
- `presentCount`: murid with `H`;
- `absentCount`: murid with `S/I/A/D` depending report definition;
- `totalCount`: active murid rows visible in the selected class.

## Yearly export data
V1 yearly export remains owned by `Attendance.tsx` and export helpers. Canonical yearly data must later preserve:
- month ordering;
- per-month present count;
- per-month effective total days;
- yearly percentage;
- existing export labels and row numbering.

## Risks
- `HIGH`: mapping national holidays outside the page can drift from V1 calendar behavior if copied incorrectly.
- `HIGH`: converting `L` or `-` into saved rows would corrupt V1 data.
- `MEDIUM`: monthly and yearly summaries must be tested against real V1 export data before any export adapter activation.
- `LOW`: pure mapper IDs generated from compound keys are stable for draft mode but are not database IDs.

## Safe next action
Phase 03 should formalize canonical model ownership and add fixtures that compare V1-derived rows against canonical snapshots.

## Blockers
- Do not activate canonical export output.
- Do not change saved status values.
- Do not migrate `attendance_records`, holidays, day events, or locks in Phase 02.
