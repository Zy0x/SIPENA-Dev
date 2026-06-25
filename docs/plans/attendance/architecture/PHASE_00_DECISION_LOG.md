# PHASE 00 DECISION LOG: Attendance V2

This document records the architectural decisions made during the design phase of the Attendance V2 system.

---

## Decisions Record

### ADR-001: Strict Seam Interface
- **Status**: Approved
- **Description**: The V1 and V2 engines must communicate with the UI and external consumers strictly through the Canonical Attendance Model.
- **Rationale**: Isolates legacy code from V2 development, minimizing regression risks in stable production features.

### ADR-002: Dual-Engine Runtime Switch
- **Status**: Approved
- **Description**: Introduce a dynamic context-level switch resolving the active engine at runtime without deploying code updates or migrating database tables.
- **Rationale**: Enables dynamic canary releases, rapid rollbacks, and sandboxed testing.

### ADR-003: Double-Write Shadow Mode
- **Status**: Approved
- **Description**: Implement asynchronous shadow writes during the testing cutover phase to validate V2 engine calculations against production writes in V1.
- **Rationale**: Guarantees data integrity and exposes calculation bugs before final cutover.

### ADR-004: Locked V1 Files
- **Status**: Approved
- **Description**: The core logic files of V1 (`useAttendance.ts` and legacy page layouts) are frozen and read-only.
- **Rationale**: Prevents accidental regressions or cross-contamination of legacy features.
