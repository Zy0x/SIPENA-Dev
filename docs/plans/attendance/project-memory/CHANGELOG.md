# CHANGELOG

## [2.4.101] - 2026-06-26
### Added
- Hardened Phase 02 V1 wrapper/adapter seam for Presensi.
- Added pure read-only V1 canonical mapping helpers for records, holidays, day events, locks, and draft datasets.
- Added targeted V1 canonical seam and wrapper guard tests.

### Safety
- V1 page and hook remain untouched.
- Runtime default remains V1 and V2 remains blocked by guard.
- Import, OCR, export, and Supabase schema remain untouched.

## [2.4.100] - 2026-06-26
### Added
- Implemented Phase 01 runtime route foundation for Presensi.
- Added strict runtime guard tests for default V1, invalid config, disabled mode, and V2-not-implemented fallback.
- Wired `/attendance` through `AttendanceRuntimeRoute` while keeping the rendered page as V1.

### Safety
- V2 remains disabled by guard and cannot activate from env or localStorage.
- No V1 business logic, export logic, import/OCR flow, or database schema was changed.

## [2.4.99] - 2026-06-26
### Added
- Implemented V2 Rule Engine (`ruleEngine.types.ts`, `statusEngine.ts`, `conflictEngine.ts`, `defaultRules.ts`, `ruleEngine.ts`, `ruleEngine.test.ts`)
- Added V2 Rule Engine specifications and decision table documentation (`RULE_ENGINE_SPEC.md`, `STATUS_ENGINE_SPEC.md`, `CONFLICT_ENGINE_SPEC.md`, `DEFAULT_RULES.md`, `RULE_DECISION_TABLE.md`)
- Implemented V2 Calendar Engine (`calendarEngine.types.ts`, `calendarConflictResolver.ts`, `effectiveDayEngine.ts`, `calendarEngine.ts`, `calendarEngine.test.ts`)
- Added V2 Calendar Engine specifications and edge cases documentation (`CALENDAR_ENGINE_SPEC.md`, `EFFECTIVE_DAY_RULES.md`, `CALENDAR_CONFLICT_PRIORITY.md`, `CALENDAR_EDGE_CASES.md`)
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
