# V1 TO CANONICAL SEAM

## Objective
Define the interface seam that isolates the V1 system and maps legacy returns to a Canonical Model.

## Evidence from Actual Repo Files
- **`useAttendance.ts` Hook Interface**:
  - Exposes:
    - `attendanceRecords: any[]`
    - `holidays: any[]`
    - `dayEvents: any[]`
    - `isLocked: boolean`
    - `dbAvailable: boolean`
    - `getAttendance(studentId, date): string | null`
    - `getAttendanceNote(studentId, date): string | null`
    - `getDayEvent(date): DayEvent | null`
    - `isHoliday(date): boolean`
    - `getHolidayDescription(date): string | null`
    - `getMonthStats(): stats`
    - `getDayStats(date): stats`
    - `setAttendance(studentId, date, status): Promise`
    - `updateNote(studentId, date, note): Promise`
    - `bulkSetAttendance(studentIds, date, status): Promise`
    - `toggleHoliday(date, description): Promise`
    - `upsertDayEvent(event): Promise`
    - `deleteDayEvent(date): Promise`
    - `toggleLock(monthStart, locked): Promise`
    - `isSaving: boolean`
    - `isLoading: boolean`

## Seam/Adapter Contract
The seam will intercept the hook output. A runtime configuration variable `runtime_engine` ("v1" | "v2") will determine which engine handles the queries and mutations.

```typescript
export interface CanonicalAttendanceSeam {
  getAttendance(studentId: string, date: Date): string | null;
  getAttendanceNote(studentId: string, date: Date): string | null;
  getDayStats(date: Date): { H: number; S: number; I: number; A: number; D: number; total: number };
  getMonthStats(): { H: number; S: number; I: number; A: number; D: number; total: number };
  setAttendance(studentId: string, date: Date, status: string | null): Promise<void>;
  // ... (matches existing V1 hook calls)
}
```

## Safe Next Action
- Create the runtime switch context/provider to direct calls to either `useAttendanceV1` (legacy) or `useAttendanceV2` (new architecture).
