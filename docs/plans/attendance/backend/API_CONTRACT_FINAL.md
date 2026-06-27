# API CONTRACT FINAL: Attendance Phase 07

## Objective
Define the Phase 07 backend API contract used by future frontend/runtime work without exposing engine internals in normal attendance payloads.

## Evidence from Actual Repo Files
- `apps/backend/src/modules/attendance/attendance.controller.ts`
- `apps/backend/src/modules/attendance/attendance.types.ts`
- `apps/backend/src/modules/attendance/validation/attendanceRequestValidation.ts`

## Findings
All normal attendance endpoints are under `/api/attendance`. Runtime/debug endpoints are explicit and separated.

| Endpoint | Method | Request | Response | Phase 07 behavior |
|---|---:|---|---|---|
| `/api/attendance` | GET | `classId`, `month=YYYY-MM` | `AttendanceDatasetCanonical` | Canonical empty dataset plus warning until adapter is approved. |
| `/api/attendance` | POST | `AttendanceRecordPatch` | guarded error/result | Fails closed with `ATTENDANCE_WRITE_DISABLED`. |
| `/api/attendance/bulk` | POST | `{ patches: AttendanceRecordPatch[] }` | guarded error/result | Fails closed with `ATTENDANCE_WRITE_DISABLED`. |
| `/api/attendance/note` | PATCH | `{ studentId, classId, date, note }` | guarded error/result | Fails closed with `ATTENDANCE_WRITE_DISABLED`. |
| `/api/attendance/summary/daily` | GET | `classId`, `month`, `date=YYYY-MM-DD` | daily summary | Derived from canonical dataset. |
| `/api/attendance/summary/monthly` | GET | `classId`, `month` | monthly summary array | Derived from canonical dataset. |
| `/api/attendance/export-dataset` | GET | `classId`, `month` | export-safe canonical dataset | No debug or engine source fields. |
| `/api/attendance/runtime` | GET | none | runtime status | Explicit runtime endpoint may expose engine/mode/guard. |
| `/api/attendance/runtime` | POST | `{ engine, mode }` | guard result | Admin-key protected; rejected unless valid and allowed. |
| `/api/attendance/shadow/report` | GET | none | shadow report | Debug/admin only. |

Request validation rules:
- `classId` is required.
- `month` must be `YYYY-MM`.
- `date` must be `YYYY-MM-DD`.
- status must be `H`, `I`, `S`, `A`, `D`, or `null`.
- bulk patches cannot be empty.
- notes must be `string` or `null`.

## Risks
- `HIGH`: Consumers must treat Phase 07 data as contract smoke, not production data, until adapter wiring exists.
- `MEDIUM`: Runtime endpoint exposes engine information by design; normal dataset/export endpoints do not.

## Safe Next Action
Add API integration tests once backend test tooling is introduced. For now, `npm run typecheck` is the minimum compilation gate.

## Blockers
- No production frontend should consume `/api/attendance` as source of truth until a real adapter exists.
