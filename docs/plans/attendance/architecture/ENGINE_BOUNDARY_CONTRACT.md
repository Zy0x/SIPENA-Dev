# ENGINE BOUNDARY CONTRACT: Attendance V2

This document establishes the boundaries and interaction rules between the legacy V1 system and the newly designed V2 engine.

---

## 1. V1 Isolation Guardrails
- **No Direct Modification**: Do not modify `apps/frontend/src/hooks/useAttendance.ts`. It belongs 100% to V1 and is read-only for adapter purposes.
- **Read-Only V1 Access**: The V1 Adapter (`useAttendanceV1Adapter`) delegates call executions directly to `useAttendance.ts` and maps the returns to the Canonical model.
- **No Shared Internal Logic**: V2 must **never** import helper functions or types directly from V1 page/hook directories.

---

## 2. V2 Engine Module Boundaries

The V2 core engine operates as a black box that communicates only through standard API boundaries:

```txt
  +------------------+
  |  V2 API Client   | <-- Communicates with Backend modules
  +------------------+
           |
           v
  +------------------+
  |    V2 Hook       | <-- Manages local client state cache
  +------------------+
           |
           v
  +------------------+
  |  Rule Evaluator  | <-- Applies calendar settings & holiday checks
  +------------------+
```

- **Imports Restriction**: V2 components/hooks can only import from `@/features/attendance/v2/*` or `@/features/attendance/canonical/*`.
- **Allowed Shared Dependencies**: Radical/primitive UI libraries (like `@/components/ui/button`), `date-fns`, and helper functions in `@/lib/utils`.
