# RUNTIME IMPLEMENTATION NOTES: Attendance V2

This document records implementation details for the Phase 01 Attendance Runtime Switch layer.

## Implementation Details
- **Location**: `apps/frontend/src/features/attendance/runtime/`
- **Configuration Resolution**:
  - Resolves active engine via `localStorage.getItem("attendance_engine_override")` first.
  - If not overridden, checks `import.meta.env.VITE_ATTENDANCE_ENGINE`.
  - Otherwise, falls back to default engine `"v1"`.
- **Default Execution State**:
  - The runtime strictly defaults to `v1`.
  - V2 engine logic is gated by a hardcoded `IS_V2_IMPLEMENTED = false` flag in the guard layer.

## Integration
- UI files and components remain unchanged in this phase.
- Core hooks like `useAttendance.ts` are read-only and uninfected by switch changes.
