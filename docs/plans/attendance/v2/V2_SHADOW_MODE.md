# V2 SHADOW MODE: Attendance V2

## Objective
Specify how Attendance V2 can compute and compare canonical output without changing V1 source-of-truth behavior.

## Evidence from Actual Repo Files
- Shadow comparator: `apps/frontend/src/features/attendance/v2/attendanceV2.shadow.ts`
- Service facade: `apps/frontend/src/features/attendance/v2/attendanceV2.service.ts`
- Shadow test coverage: `apps/frontend/src/features/attendance/v2/attendanceV2.test.ts`
- V1 canonical seam remains under `apps/frontend/src/features/attendance/v1/`

## Findings
Shadow mode uses canonical records only:

```ts
compareWithV1CanonicalResult(v1CanonicalRecords, v2DatasetOrRecords)
```

It detects:
- missing V2 record for V1 murid/date;
- extra V2 record missing in V1;
- status mismatch for the same murid/date.

When the service is constructed with `{ enableShadow: true }`, runtime mode is `shadow` and writes remain disabled unless explicitly changed. Shadow comparison can be run separately through `service.compareWithV1CanonicalResult(...)`.

If a successful active patch also receives `v1CanonicalRecords`, the patch result includes `shadowComparison` and the audit metadata contains mismatch detail when mismatch exists.

## Risks
- `HIGH`: Shadow reports should not be shown to normal users. They are debug/admin artifacts.
- `MEDIUM`: Current comparison checks records/status only. Notes and future custom fields need explicit comparison policy later.
- `LOW`: `dateChecked` uses local runtime time and is not a persisted audit timestamp.

## Safe Next Action
Phase 07 can persist shadow mismatch reports in a backend audit table or log stream, but must keep V1 as source of truth until cutover approval.

## Blockers
No blocker for Phase 07. Full parity dashboard is a later UI/admin task.
