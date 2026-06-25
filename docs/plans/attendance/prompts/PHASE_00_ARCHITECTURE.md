<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 00 — ARCHITECTURE PROMPT

## PHASE
Architecture design. Documentation and contracts first. Implementation only for type/interface stubs if explicitly allowed.

## ROLE
You are the principal architect for SIPENA Attendance V2. Your job is to design the safest architecture that lets V1 remain active while V2 is built in isolation.

## REQUIRED PRECONDITIONS
Before starting, verify these Phase -1 outputs exist and are complete:
- `DISCOVERY_SYSTEM_MAP.md`
- `DISCOVERY_DEPENDENCY_GRAPH.md`
- `DISCOVERY_EXPORT_COUPLING_MAP.md`
- `DISCOVERY_DATABASE_TOUCHPOINTS.md`
- `DISCOVERY_RISK_REPORT.md`
- `V1_TO_CANONICAL_SEAM.md`

If any are missing, stop and return to Phase -1.

## CONTEXT TO LOAD
Read:
- `attendance/02_AI_CONTRACT.md`
- `attendance/03_RUNTIME_SWITCH.md`
- `attendance/engines/CANONICAL_MODEL.md`
- `attendance/engines/ENGINE_ISOLATION_RULES.md`
- `attendance/engines/ENGINE_SWITCH.md`
- `attendance/backend/HYBRID_BACKEND.md`
- `attendance/frontend/RUNTIME_INTEGRATION.md`
- `attendance/export/EXPORT_PIPELINE.md`
- `attendance/migration/STRATEGY.md`

## ARCHITECTURAL GOAL
Design a dual-engine attendance architecture:

```txt
UI / Export / Import
        ↓
Attendance Runtime Provider
        ↓
Runtime Switch
   ┌────┴────┐
   ↓         ↓
V1 Adapter  V2 Engine
   ↓         ↓
Canonical Attendance Model
        ↓
UI / Export / Reports / Tests
```

## NON-NEGOTIABLE RULES
- V1 must remain untouched.
- V2 must not import V1 internals directly.
- UI and export must consume canonical data only.
- Runtime switch must choose engine without schema rewrite.
- Rollback must be config-only.
- Export output must remain stable.
- Do not introduce a big-bang migration.

## TASK
Create the architecture blueprint for Attendance V2.

Design and document:
1. Target folder structure for frontend, backend, shared packages, tests, and docs.
2. Runtime switch architecture.
3. Engine registry architecture.
4. V1 adapter boundary.
5. V2 engine module boundaries.
6. Canonical model ownership.
7. API contract between frontend and backend.
8. Export adapter boundary.
9. Migration and shadow mode architecture.
10. Testing gates per phase.
11. Rollback architecture.
12. Observability and audit architecture.
13. Data integrity rules.
14. Error handling and fallback rules.

## RECOMMENDED TARGET STRUCTURE
Use this as a starting point, but adapt to the actual repo:

```txt
apps/frontend/src/features/attendance/
  runtime/
  canonical/
  v1/
  v2/
  export/
  testing/

apps/backend/src/modules/attendance/
  runtime/
  canonical/
  engines/
  v1/
  v2/
  audit/
  shadow/
  validation/

packages/attendance-contracts/
  src/
    canonical.ts
    runtime.ts
    export.ts
    api.ts
```

Do not create these folders unless implementation is explicitly requested. This phase may create design documents only.

## EXPECTED OUTPUT FILES
Create/update:
- `attendance/architecture/ARCHITECTURE_OVERVIEW.md`
- `attendance/architecture/FOLDER_STRUCTURE_PROPOSAL.md`
- `attendance/architecture/RUNTIME_SWITCH_BLUEPRINT.md`
- `attendance/architecture/ENGINE_BOUNDARY_CONTRACT.md`
- `attendance/architecture/CANONICAL_MODEL_BLUEPRINT.md`
- `attendance/architecture/API_CONTRACT_BLUEPRINT.md`
- `attendance/architecture/EXPORT_SAFE_ARCHITECTURE.md`
- `attendance/architecture/MIGRATION_SAFE_ARCHITECTURE.md`
- `attendance/architecture/ROLLBACK_BLUEPRINT.md`
- `attendance/architecture/PHASE_00_DECISION_LOG.md`

## OUTPUT QUALITY BAR
Be specific enough that an engineer can implement without asking:
- exact module names
- exact responsibilities
- allowed imports
- forbidden imports
- data flow
- failure modes
- rollback path
- test gate

## ACCEPTANCE CRITERIA
Phase 00 passes only if:
- Architecture isolates V1 and V2 completely.
- Canonical model is the only shared interface.
- Export does not depend on engine type.
- Runtime switch is config-controlled.
- Backend and frontend responsibilities are clearly separated.
- Migration uses shadow mode.
- Rollback is instant via runtime config.

## STOP CONDITIONS
Stop if:
- A design requires editing V1 directly.
- A design requires changing export format immediately.
- A design requires modifying V1 database tables.
- A design cannot support shadow mode.

## FINAL RESPONSE
Return:
- Architecture summary.
- Files created/updated.
- Key decisions.
- Risks remaining.
- Whether Phase 00 is ready for Phase 01 Runtime.
