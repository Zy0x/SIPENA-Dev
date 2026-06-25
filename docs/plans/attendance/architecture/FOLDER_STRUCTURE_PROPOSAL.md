# FOLDER STRUCTURE PROPOSAL: Attendance V2

This document defines the proposed target directory layout for building Attendance V2 in isolation inside the monorepo structure.

---

## 1. Frontend target structure

All V2 modules will live under a dedicated feature folder:

```txt
apps/frontend/src/features/attendance/
  ├── runtime/
  │     ├── AttendanceRuntimeContext.tsx  (React Context provider for switch)
  │     └── useAttendanceRuntime.ts       (Universal hook mapping client calls)
  ├── canonical/
  │     ├── models.ts                    (Canonical TypeScript types)
  │     └── mappers.ts                   (Transform V1/V2 records to Canonical)
  ├── v1/
  │     ├── useAttendanceV1Adapter.ts    (Seam wrapping legacy useAttendance.ts)
  │     └── legacy-stubs.ts              (Helper types for V1 backward-compatibility)
  ├── v2/
  │     ├── hooks/
  │     │     └── useAttendanceV2.ts     (V2 core rule-based logic hook)
  │     ├── components/
  │     │     └── V2AttendanceGrid.tsx   (V2 specific UI layout components)
  │     └── services/
  │           └── v2-api-client.ts       (API calls for V2 backend modules)
  ├── export/
  │     └── CanonicalExportAdapter.ts    (Converts Canonical model to PDF/Excel layout format)
  └── testing/
        └── test-stubs.ts                (Pre-configured mock generators for verification)
```

---

## 2. Backend target structure

All V2 backend API modules and database handlers:

```txt
apps/backend/src/modules/attendance/
  ├── runtime/
  │     └── switch.controller.ts         (Backend endpoint runtime switch handler)
  ├── canonical/
  │     └── schema.ts                    (Backend Canonical entity and DTO types)
  ├── engines/
  │     ├── v1-legacy/
  │     │     └── legacy.service.ts      (Stubs wrapping legacy database writes)
  │     └── v2-core/
  │           ├── calendar.engine.ts     (Evaluates calendar structures)
  │           └── rule.engine.ts         (Evaluates attendance business rules)
  ├── audit/
  │     └── audit.service.ts             (Writes execution and switch telemetry logs)
  ├── shadow/
  │     └── shadow-validator.service.ts  (Double-writes and compares V1 and V2 outputs)
  └── validation/
        └── schema-guard.ts              (Stricter constraints for data writes)
```

---

## 3. Shared Contracts

Contract type definitions shared across apps:

```txt
packages/attendance-contracts/
  ├── package.json
  └── src/
        ├── canonical.ts                 (Core type schemas)
        ├── runtime.ts                   (Switch parameters)
        ├── export.ts                    (Export data contracts)
        └── api.ts                       (V2 REST API Request/Response typings)
```
