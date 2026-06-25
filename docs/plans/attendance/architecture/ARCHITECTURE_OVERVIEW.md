# ARCHITECTURE OVERVIEW: Attendance V2

This document describes the dual-engine architecture for the SIPENA Attendance V2 system. The goal is to build a modern, calendar-driven, rule-based V2 engine in complete isolation while keeping the stable V1 engine fully operational.

---

## 1. High-Level Architecture

The system follows a strict layered decoupling using a **Runtime Switch** and a **Canonical Attendance Model**.

```txt
UI Components / Import Dialogs / OCR
                  ↓
       [Attendance Runtime Provider] (React Context / API Module)
                  ↓
          [Runtime Switch] (Based on config / env / feature flag)
             ┌────┴────┐
             ↓         ↓
      [V1 Adapter]  [V2 Engine]
             └────┬────┘
                  ↓
     [Canonical Attendance Model] (Mapped standard structure)
                  ↓
Export Studio / Attendance PDF Canvas / Yearly Reports / QA Verification
```

---

## 2. Allowed & Forbidden Imports

### Allowed Imports
- UI Components are only allowed to import from the `runtime/` or `canonical/` boundaries.
- The `v2/` module is only allowed to consume its own internal logic and the `packages/attendance-contracts` schema.
- The `export/` module is only allowed to import the `canonical/` model types.

### Forbidden Imports
- UI Components must **never** import `v1/` or `v2/` internals directly.
- The V2 engine must **never** import V1 hooks (`useAttendance.ts` or legacy components) or V1 database helpers.
- The export preview or generator must **never** perform direct Supabase queries on raw V1/V2 records; they must consume mapping helpers from the `canonical/` interface.

---

## 3. Failure & Fallback Modes
- If the V2 engine fails to initialize or experiences a runtime exception, the **Runtime Switch** will catch the error and automatically fall back to the V1 Adapter.
- Operational logs will record all switch events, shadow-mode validation mismatches, and engine errors under a dedicated audit touchpoint.
