# CHANGELOG

## [2.4.99] - 2026-06-26
### Added
- Implemented Attendance Canonical Model (`canonical.types.ts`, `canonical.mappers.ts`, `canonical.validation.ts`, `index.ts`)
- Added Canonical Model specifications (`CANONICAL_MODEL_SPEC.md`, `CANONICAL_INVARIANTS.md`, `V1_MAPPING_SPEC.md`, `EXPORT_MAPPING_SPEC.md`)
- Implemented V1 Wrapper/Adapter boundary (`AttendanceV1Wrapper.tsx`, `attendanceV1.adapter.ts`, `attendanceV1.types.ts`, `attendanceV1.guard.ts`)
- Added V1 preservation documentation (`V1_WRAPPER_IMPLEMENTATION.md`, `V1_BEHAVIOR_PRESERVATION_CHECKLIST.md`, `V1_CANONICAL_MAPPING_DRAFT.md`, `V1_UNTOUCHED_PROOF.md`)
- Implemented Attendance Runtime Switch foundation (`attendanceRuntime.types.ts`, `attendanceRuntime.config.ts`, `attendanceRuntimeGuard.ts`, `AttendanceRuntimeProvider.tsx`, `useAttendanceRuntime.ts`)
- Added runtime switch documentation (`RUNTIME_IMPLEMENTATION_NOTES.md`, `RUNTIME_GUARD_RULES.md`, `RUNTIME_ROLLBACK_NOTES.md`)

## INIT PHASE
- Attendance V2 design initiated
- dual engine concept introduced
- canonical model defined

---

## RULE
All changes must be logged here