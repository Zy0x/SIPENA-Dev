# V2 SUMMARY SPEC: Attendance V2

## Objective
Document canonical summary calculation for daily, monthly, yearly, class recap, and export-adjacent percentage needs.

## Evidence from Actual Repo Files
- Summary implementation: `apps/frontend/src/features/attendance/v2/attendanceV2.engine.ts`
- Canonical summary types: `apps/frontend/src/features/attendance/canonical/canonical.types.ts`
- Service summary facade: `apps/frontend/src/features/attendance/v2/attendanceV2.service.ts`
- Tests: `apps/frontend/src/features/attendance/v2/attendanceV2.test.ts`

## Findings
Summary helpers are pure and deterministic:
- `computeDailySummary(dataset, date)`;
- `computeMonthlySummary(dataset, studentId)`;
- `computeYearlySummary(monthlyDatasets, studentId)`;
- `computeMonthlyClassRecap(dataset)`;
- `computeSummaryBundle(dataset, yearlyDatasets?)`;
- `getDailyRecords(dataset, date)`;
- `getMonthlyRecords(dataset, studentId?)`.

Counting policy:
- `H` counts present.
- `D` counts as dispensation and present.
- `S` counts sick.
- `I` counts permission.
- `A` counts absent.
- `L` counts leave/day-off.
- Unknown future custom statuses are ignored until a production custom-status summary policy exists.

`computeSummaryBundle` uses canonical days when available; otherwise it derives date rows from records. This preserves deterministic output for imported/shadow datasets with partial day lists.

## Risks
- `HIGH`: Future custom statuses need explicit summary behavior before they are used in official reports.
- `MEDIUM`: Current yearly percentage is based on records present in monthly datasets, not generated effective days without records.
- `LOW`: Class recap is a V2 helper type, not yet part of the shared canonical package.

## Safe Next Action
Phase 07 can reuse these summary helpers server-side or port them to shared contracts before persistence activation.

## Blockers
None for backend design. Official export integration remains deferred.
