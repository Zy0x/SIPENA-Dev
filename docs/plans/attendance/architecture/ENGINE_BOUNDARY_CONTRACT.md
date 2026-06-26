# ENGINE BOUNDARY CONTRACT: Attendance V2

## Objective
Define the exact separation between V1, V2, runtime, canonical model, export, backend, and tests so V1 remains untouched and V2 can be built safely in isolation.

## Evidence from actual repo files
- `docs/plans/attendance/02_AI_CONTRACT.md`: V1 must never be modified, V2 must be isolated, and export/database core must not be touched directly.
- `docs/plans/attendance/engines/ENGINE_ISOLATION_RULES.md`: V1 and V2 communicate only through canonical model and adapter layer.
- `apps/frontend/src/pages/Attendance.tsx`: V1 page is a high-risk combined UI/runtime/export surface.
- `apps/frontend/src/hooks/useAttendance.ts`: V1 hook is the active data mutation surface.
- `apps/frontend/src/features/attendance/v1/AttendanceV1Wrapper.tsx`: current V1 wrapper is a safe mounting point if it stays shallow.

## Findings
V1 adapter is a boundary, not a refactor. It may mount or delegate to V1, but it cannot extract or rewrite V1 internals. V2 must be independently testable without importing V1 code.

## Engine contract
```ts
export interface AttendanceEngine {
  readonly id: "v1" | "v2";
  readonly mode: "active" | "shadow" | "read-only";
  query(input: AttendanceQueryInput): Promise<CanonicalAttendanceSnapshot>;
  command(input: AttendanceCommand): Promise<CanonicalCommandResult>;
  getCapabilities(): AttendanceEngineCapabilities;
}

export interface AttendanceEngineCapabilities {
  canRead: boolean;
  canWrite: boolean;
  canShadow: boolean;
  canExport: boolean;
  supportsLocks: boolean;
  supportsDayEvents: boolean;
  supportsNotes: boolean;
}
```

## V1 adapter boundary
Allowed:
- render the locked V1 page through `AttendanceV1Wrapper`;
- call existing V1 hook only from a thin V1 adapter if Phase 03 requires canonical read mapping;
- convert V1 output to canonical values;
- preserve V1 write behavior while V1 is active.

Forbidden:
- editing `apps/frontend/src/pages/Attendance.tsx`;
- editing `apps/frontend/src/hooks/useAttendance.ts`;
- moving V1 state into runtime in Phase 01;
- importing V2 from V1 files;
- changing V1 export/import/OCR flow before dedicated adapter phase.

## V2 engine boundaries
V2 modules:
- `calendar`: determines effective school days, weekends, holidays, and custom day events.
- `status`: validates `H`, `I`, `S`, `A`, `D`, `L`, and `-` semantics.
- `lock`: blocks commands for locked periods.
- `rule`: resolves conflict priority between holiday, day event, lock, and status.
- `query`: builds canonical snapshots.
- `command`: validates and stages writes.
- `shadow`: compares V1 and V2 outputs without affecting V1.

V2 forbidden dependencies:
- `Attendance.tsx`;
- `useAttendance.ts`;
- V1-specific table names outside compatibility mapper;
- export renderer internals;
- browser-only localStorage in backend/shared code.

## Import rules
| Module | May import | Must not import |
|---|---|---|
| Runtime | registry, canonical contracts, engine descriptors | raw V1 hook internals |
| V1 adapter | V1 wrapper/hook at adapter edge only | V2 modules |
| V2 engine | canonical contracts and V2 internals | V1 page/hook/export renderer |
| Export adapter | canonical contracts and existing export type edge | engine-specific modules |
| Backend attendance | contracts and backend infra | frontend React files |

## Error handling
- Engine errors return structured `AttendanceRuntimeError`.
- Runtime can fallback to V1 only before a user write or after a failed V2 read/init.
- Writes must not partially run in both engines unless shadow mode is explicitly active.
- Shadow mismatch never changes user-visible success for V1.

## Test gate
- Source guard rejects imports from `v2/*` to V1 files.
- Source guard rejects export renderer imports from `v1/*` or `v2/*`.
- V1 wrapper smoke proves V1 page renders unchanged.
- V2 unit tests run without importing V1 files.

## Risks
- `BLOCKER`: any adapter that requires V1 edits violates the contract.
- `HIGH`: using V1 helper functions in V2 creates hidden behavioral coupling.
- `MEDIUM`: keeping temporary canonical types in frontend can drift from package contracts.

## Safe next action
Phase 01 should introduce runtime/registry seams only. Canonical read adapter and V2 engine contracts can be type-only until Phase 03.

## Blockers
- No V2 write implementation until backend/API and table compatibility contracts are approved.
