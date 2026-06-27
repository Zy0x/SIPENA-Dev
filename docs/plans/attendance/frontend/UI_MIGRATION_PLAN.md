# UI Migration Plan

## Objective
Provide a reversible plan for migrating Presensi UI from the V1 page to canonical pure UI components without a big-bang rewrite.

## Evidence from actual repo files
- Current stable page: `apps/frontend/src/pages/Attendance.tsx`.
- Current stable hook: `apps/frontend/src/hooks/useAttendance.ts`.
- Runtime route shell: `apps/frontend/src/features/attendance/runtime/AttendanceRuntimeRoute.tsx`.
- V1 wrapper: `apps/frontend/src/features/attendance/v1/AttendanceV1Wrapper.tsx`.
- Canonical provider: `apps/frontend/src/features/attendance/provider/AttendanceProvider.tsx`.

## Findings
The current route can support incremental migration in this order:

1. Keep V1 page as the rendered source of truth.
2. Mount runtime and canonical providers around V1.
3. Add debug-only canonical/shadow visibility for developers.
4. Build pure UI components behind runtime/debug flags.
5. Move one read-only surface at a time to canonical data.
6. Add mutation surfaces only after backend/runtime guard and lock/effective-day checks are production-ready.

## Component targets
- Toolbar.
- Class selector.
- Month/date selector.
- Calendar settings.
- Daily attendance table.
- Monthly recap table.
- Summary cards.
- Lock indicator.
- Note dialog.
- Import and OCR entrypoints.
- Export studio entrypoint.

## Migration rules
- UI components consume `useAttendanceCanonical()`.
- UI components do not decide runtime engine.
- V1 page and hook remain locked until an explicit migration phase scopes a seam.
- Export formatting is not changed by frontend migration work.
- Import/OCR entrypoints remain reachable during every intermediate state.

## Risks
- `HIGH`: Refactoring `Attendance.tsx` directly can break V1 behavior and export coupling.
- `HIGH`: Moving export to canonical output without parity tests can alter printable output.
- `MEDIUM`: Duplicate state ownership can occur if new UI writes to V2 while V1 remains source of truth.

## Safe next action
- Phase 09 should map export coupling to canonical export adapter tests before any export formatting change.
- Build future pure UI as hidden or debug-only components until parity is proven.

## Blockers
- No blocker for Phase 09.
- User-facing V2 UI is blocked until shadow mode comparison is available and stable.
