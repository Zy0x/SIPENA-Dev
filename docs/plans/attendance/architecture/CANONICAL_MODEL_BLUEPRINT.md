# CANONICAL MODEL BLUEPRINT: Attendance V2

## Objective
Define the canonical model as the only shared interface for runtime, UI, export, import, reports, backend API, migration, shadow mode, and tests.

## Evidence from actual repo files
- `docs/plans/attendance/engines/CANONICAL_MODEL.md`: UI and export must read canonical model only and engine source is hidden.
- `apps/frontend/src/features/attendance/canonical/canonical.types.ts`: canonical draft includes statuses, records, day events, holidays, locks, snapshot, and export dataset types.
- `apps/frontend/src/hooks/useAttendance.ts`: V1 active status model is `H/I/S/A/D`, with holidays, day events, locks, and notes.
- `apps/frontend/src/lib/ocrImport/validation.ts`: OCR normalization already has attendance-specific date/status validation.
- `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx`: export needs a print dataset, not raw engine records.

## Findings
The canonical model must be broader than a single attendance row. It must carry records, effective day context, holidays, day events, lock state, summaries, source metadata, and export-ready projections.

## Canonical ownership
Preferred final owner:
```txt
packages/attendance-contracts/src/
  canonical.ts
  runtime.ts
  api.ts
  export.ts
  import.ts
  shadow.ts
  errors.ts
```

Phase 01 may keep frontend-local canonical types if no package stubs are needed. Phase 03 should move or reconcile them into the package.

## Core canonical types
```ts
export type CanonicalAttendanceStatus = "H" | "I" | "S" | "A" | "D" | "L" | "-";

export type CanonicalEngineSource = "v1" | "v2" | "import" | "ocr" | "shadow";

export interface CanonicalAttendanceRecord {
  id: string;
  classId: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: CanonicalAttendanceStatus;
  note: string | null;
  sourceEngine: "v1" | "v2";
  sourceTable: "attendance_records" | "attendance" | "v2_attendance_records" | "virtual";
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface CanonicalAttendanceDayContext {
  date: string;
  isSchoolDay: boolean;
  isWeekend: boolean;
  workDayFormat: "5days" | "6days";
  holiday: CanonicalHoliday | null;
  dayEvent: CanonicalDayEvent | null;
  lock: CanonicalAttendanceLock | null;
  reason: "normal" | "weekend" | "holiday" | "event" | "locked";
}

export interface CanonicalAttendanceSnapshot {
  classId: string;
  academicYearId: string | null;
  semesterId: string | null;
  month: string; // YYYY-MM
  records: CanonicalAttendanceRecord[];
  holidays: CanonicalHoliday[];
  dayEvents: CanonicalDayEvent[];
  locks: CanonicalAttendanceLock[];
  dayContexts: CanonicalAttendanceDayContext[];
  summary: CanonicalAttendanceSummary;
  sourceEngine: "v1" | "v2";
  generatedAt: string;
}
```

## Data integrity rules
- Date strings must be `YYYY-MM-DD`; month strings must be `YYYY-MM`.
- `H/I/S/A/D` keep V1 semantics.
- `L` and `-` are canonical/report values only until a write contract explicitly supports them.
- Empty/missing status maps to `-` in read models and `null` in V1 write commands when clearing attendance.
- A locked month blocks writes unless an admin override is explicitly designed later.
- Sunday is non-school day; Saturday depends on `workDayFormat`.
- Custom day event with holiday override must follow V1 behavior until V2 conflict rules are approved.
- Source table must be included during migration to expose `attendance` vs `attendance_records` provenance.

## Export projection contract
Canonical export must not send raw records directly to the existing print renderer. It must produce:
```ts
export interface CanonicalAttendanceExportInput {
  snapshot: CanonicalAttendanceSnapshot;
  students: CanonicalAttendanceStudent[];
  classInfo: CanonicalAttendanceClassInfo;
  signature: CanonicalAttendanceSignature | null;
  format: "daily" | "monthly" | "yearly";
}
```

The export adapter then maps this to the existing `AttendancePrintDataset`.

## Error model
```ts
export interface CanonicalAttendanceIssue {
  code: string;
  severity: "info" | "warning" | "error" | "blocker";
  field?: string;
  message: string;
  source?: CanonicalEngineSource;
}
```

## Test gate
- Unit tests for status normalization.
- Unit tests for date/month validation.
- Mapper tests from V1 active tables to canonical snapshot.
- Export projection tests against fixture snapshots.
- Shadow diff tests for matching/mismatching records.

## Risks
- `BLOCKER`: canonical model cannot hide the `attendance` vs `attendance_records` conflict during migration.
- `HIGH`: adding statuses not supported by V1 writes can corrupt behavior if mapped incorrectly.
- `MEDIUM`: source metadata can leak technical details if displayed directly to users.

## Safe next action
Freeze the canonical read model in Phase 03 after Phase 01 runtime shell is stable and Phase 02 proves V1 remains unchanged.

## Blockers
- Table compatibility decision is required before write commands can be canonicalized.
