# V1 WRAPPER IMPLEMENTATION: Attendance V2

This document details the wrapper implementation that isolates the legacy V1 screen.

## Setup
- **Wrapper**: `apps/frontend/src/features/attendance/v1/AttendanceV1Wrapper.tsx`
- **Adapter**: `apps/frontend/src/features/attendance/v1/attendanceV1.adapter.ts`
- **Hook**: `useAttendanceV1Adapter` delegates execution directly to legacy `useAttendance.ts`.

## Execution Gating
- The V1 Wrapper renders the legacy `Attendance.tsx` page without altering it.
- Gated by `checkV1SafetyGuard` returning true, guaranteeing that the legacy engine remains the default active path.
