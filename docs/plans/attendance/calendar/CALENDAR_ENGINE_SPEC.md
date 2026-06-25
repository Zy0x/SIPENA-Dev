# CALENDAR ENGINE SPECIFICATION: Attendance V2

Deterministic, event-based school calendar engine for SIPENA Attendance V2.

## Design Goals
- **Stateless & Dynamic**: Calculate effective days, holidays, and write-blocking states on-the-fly. No pre-calculated schedules are stored in the database.
- **Rule Decoupling**: Isolate all V2 calendar computations from legacy V1 logic.
- **Backwards Compatibility**: Match V1 weekend rules and holiday mappings by default.

## API Contracts

### inputs
```typescript
interface CalendarEngineInputs {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  classId: string;
  workDayFormat: "5days" | "6days";
  events: AttendanceCalendarEventCanonical[];
  holidays: AttendanceHolidayCanonical[];
  overrides: CalendarOverride[];
  locks: AttendanceLockCanonical[];
}
```

### Outputs
```typescript
interface V2CalendarDay {
  date: string;
  dayOfWeek: number;
  isEffective: boolean;
  isEffectiveDay: boolean; // Compatibility alias
  isHoliday: boolean;
  holidayName?: string;
  eventName?: string;
  eventPriority: number;
  blockedWriteState: boolean;
  reasonCodes: string[];
}
```
