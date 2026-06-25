<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 08 — FRONTEND PROMPT

## PHASE
Integrate frontend with runtime/canonical layer without breaking current UI/export.

## ROLE
You are a frontend migration engineer for a production React + TypeScript app. Your task is to integrate Attendance runtime and canonical data while preserving the current user experience.

## REQUIRED PRECONDITIONS
Read:
- `attendance/frontend/ATTENDANCE_PROVIDER.md`
- `attendance/frontend/ATTENDANCE_UI_SPLIT.md`
- `attendance/frontend/HOOK_LAYER.md`
- `attendance/frontend/FRONTEND_GUARD.md`
- `attendance/frontend/EXPORT_INTEGRATION.md`
- `attendance/canonical/CANONICAL_MODEL_SPEC.md`
- `attendance/runtime/RUNTIME_IMPLEMENTATION_NOTES.md`

## REPO ANCHORS
Current V1 page/hook are known anchors:
- `apps/frontend/src/pages/Attendance.tsx`
- `apps/frontend/src/hooks/useAttendance.ts`

Treat them as production-stable. Use wrapper/provider strategy rather than direct refactor unless Phase -1 explicitly marked a safe seam.

## GOAL
Create a frontend runtime/provider architecture so UI can consume canonical attendance data regardless of V1/V2, while default behavior remains V1.

## HARD RULES
- Do not rewrite the old page in one big step.
- Do not change export formatting.
- Do not let UI import V1/V2 engine directly.
- Do not activate V2 by default.
- Do not remove import/OCR/export features.
- Do not introduce visual regressions.

## TASK
Implement frontend integration in small, reversible steps.

Suggested files:
```txt
apps/frontend/src/features/attendance/provider/AttendanceProvider.tsx
apps/frontend/src/features/attendance/provider/useAttendanceCanonical.ts
apps/frontend/src/features/attendance/provider/attendanceProvider.types.ts
apps/frontend/src/features/attendance/ui/AttendanceRuntimeBoundary.tsx
apps/frontend/src/features/attendance/ui/AttendanceDebugPanel.tsx
apps/frontend/src/features/attendance/guards/frontendImportGuard.ts
```

## INTEGRATION STRATEGY
Use this order:
1. Mount runtime provider around attendance route/page without changing rendered output.
2. Expose canonical read-only data alongside existing V1 data.
3. Add optional debug-only comparison panel.
4. Ensure export still uses current stable pipeline.
5. Only after validation, route new V2 UI components behind feature/runtime flags.

## UI COMPONENT TARGETS
Design future pure UI components, but do not force migration all at once:
- toolbar
- class selector
- date/month selector
- calendar settings
- daily attendance table
- monthly recap table
- summary cards
- lock indicator
- note dialog
- import/OCR entrypoints
- export studio entrypoint

## STATE MANAGEMENT RULES
State must be layered:
```txt
backend/API or V1 hook
  ↓
runtime provider
  ↓
canonical store/hook
  ↓
pure UI components
```
No UI component should decide engine type.

## FRONTEND GUARDS
Add or document checks preventing:
- direct V1 service imports outside wrapper/adapter
- direct V2 imports outside runtime/provider
- export direct engine access
- mutation without lock/effective-day validation

## TEST REQUIREMENTS
Add or document tests for:
- V1 default render
- runtime config invalid → V1 fallback
- canonical hook returns stable shape
- export button still available
- import/OCR button still available
- no engine labels shown to normal users

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/frontend/FRONTEND_INTEGRATION_REPORT.md`
- `attendance/frontend/CANONICAL_PROVIDER_SPEC.md`
- `attendance/frontend/UI_MIGRATION_PLAN.md`
- `attendance/frontend/FRONTEND_REGRESSION_CHECKLIST.md`

## ACCEPTANCE CRITERIA
Phase 08 passes only if:
- Current UI behavior is preserved.
- Runtime provider is mounted or ready.
- Canonical hook/provider exists.
- UI does not import engine internals.
- Export/import/OCR remain accessible.
- V2 is not default.

## STOP CONDITIONS
Stop if:
- Direct refactor of the huge V1 page is required.
- Existing export breaks.
- UI needs engine-specific conditional logic everywhere.
- Runtime fallback to V1 is not guaranteed.

## FINAL RESPONSE
Return:
- Frontend files added/updated.
- UI behavior preservation notes.
- Guard status.
- Validation command results.
- Whether Phase 09 Export can start.
