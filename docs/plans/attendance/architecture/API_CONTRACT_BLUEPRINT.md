# API CONTRACT BLUEPRINT: Attendance V2

## Objective
Define the frontend-backend API contract for Attendance V2 without assuming that a backend attendance module already exists.

## Evidence from actual repo files
- `apps/backend/src/modules`: no attendance module exists yet.
- `docs/plans/attendance/backend/HYBRID_BACKEND.md`: backend should act as orchestration layer, not a totally separate backend.
- `supabase/functions/*`: attendance data cleanup and OCR currently happen through Supabase Edge Functions, not `apps/backend`.
- `apps/frontend/src/infrastructure/supabase`: frontend has direct Supabase access patterns today.
- `docs/plans/attendance/discovery/DISCOVERY_DATABASE_TOUCHPOINTS.md`: active and legacy attendance tables both exist in code paths.

## Findings
The API must be documented before implementation because current V1 mostly uses direct Supabase queries from the frontend. V2 backend should start as a canonical orchestration layer and later own V2 writes/shadow validation.

## API principles
- All request/response models use canonical contracts.
- API never returns raw V1/V2 table rows.
- V1 read compatibility is allowed; V1 write delegation must stay within existing production behavior until cutover.
- V2 writes require auth, class ownership, lock validation, and table compatibility approval.
- Shadow mode APIs must be non-blocking for V1 user actions.

## Endpoint blueprint
| Endpoint | Method | Phase | Responsibility |
|---|---|---|---|
| `/api/attendance/runtime` | `GET` | 01+ | Return resolved engine, capabilities, and fallback reason. |
| `/api/attendance/snapshot` | `GET` | 03+ | Return canonical snapshot for class/month. |
| `/api/attendance/command` | `POST` | 06+ | Execute one canonical command against active engine. |
| `/api/attendance/bulk-command` | `POST` | 06+ | Execute validated bulk commands atomically where supported. |
| `/api/attendance/shadow/compare` | `POST` | 09+ | Run V1/V2 comparison for a deterministic fixture or live class/month. |
| `/api/attendance/audit` | `GET` | 09+ | Read runtime/shadow audit events for admin/debug roles only. |

## Request contract
```ts
export interface AttendanceSnapshotRequest {
  classId: string;
  month: string; // YYYY-MM
  academicYearId?: string;
  semesterId?: string;
  workDayFormat: "5days" | "6days";
}

export interface AttendanceCommandRequest {
  commandId: string;
  classId: string;
  studentId: string;
  date: string;
  status: CanonicalAttendanceStatus | null;
  note?: string | null;
  expectedVersion?: string | null;
  mode: "active" | "shadow";
}
```

## Response contract
```ts
export interface AttendanceApiResponse<T> {
  ok: boolean;
  data: T | null;
  issues: CanonicalAttendanceIssue[];
  runtime: AttendanceRuntimeResolution;
  requestId: string;
}
```

## Auth and authorization
- Request must include authenticated SIPENA session.
- Backend verifies class ownership or allowed shared access.
- Admin/debug audit endpoints require elevated role.
- Service role is never exposed to frontend.
- Direct table writes from V2 frontend are forbidden after backend module exists.

## Error handling
| Status | Meaning |
|---|---|
| `400` | canonical validation failed; no write attempted. |
| `401` | unauthenticated session. |
| `403` | user cannot access class/month/action. |
| `409` | lock/conflict/stale version. |
| `422` | command valid but violates attendance business rule. |
| `500` | unexpected backend error; no raw database error to user. |

## Backend data policy
- V1 compatibility reads may query `attendance_records` and legacy `attendance` only through explicit compatibility repositories.
- V2 writes must target V2-approved storage only after migration strategy is approved.
- Shadow writes must be marked as shadow and never appear in production V1 exports.

## Test gate
- Contract tests for request/response schemas.
- Auth/authorization tests for class ownership.
- Lock conflict tests.
- Shadow compare tests with deterministic fixture.
- No-write-before-validation tests.

## Risks
- `BLOCKER`: table compatibility decision is required before write endpoints can be implemented.
- `HIGH`: introducing backend API while frontend still directly writes Supabase can create dual sources of truth.
- `MEDIUM`: API route naming may change depending on backend framework conventions.

## Safe next action
Keep this as a blueprint until backend module phase. Phase 01 should not implement backend endpoints.

## Blockers
- No V2 backend write endpoint until table ownership, RLS, and shadow storage are decided.
