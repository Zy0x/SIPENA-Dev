# CHANGELOG

## [2.4.114] - 2026-06-28
### Release Decision
- **Phase 12 CUTOVER MODE: `SHADOW_ONLY`**
- V2 engine promoted from isolated development to shadow mode.
- V1 remains the exclusive source of truth for all user output, writes, and exports.
- Shadow mode runs V2 in parallel for comparison only — zero user impact.

### Release Documents Created
- `docs/plans/attendance/release/FINAL_ACCEPTANCE_REPORT.md`
- `docs/plans/attendance/release/CUTOVER_DECISION.md`
- `docs/plans/attendance/release/ROLLBACK_RUNBOOK.md`
- `docs/plans/attendance/release/POST_CUTOVER_MONITORING.md`
- `docs/plans/attendance/release/RELEASE_NOTES.md`

### Deferred Gates (not blocking shadow mode)
- BLOCKER-1: PDF/PNG binary signature render parity — deferred to Phase 13
- BLOCKER-2: Playwright E2E browser regression suite — deferred to Phase 13
- Canonical export studio wiring — deferred to Phase 13
- Backend ESM packaging blocker — deferred to Phase 14

### Safety
- V1 Presensi page, V1 hook, legacy export renderers, import/OCR, Supabase schema: untouched
- Rollback: remove `VITE_ATTENDANCE_ENGINE` env var (config-only, < 2 min)
- No database writes, no schema changes, no data loss risk

## [2.4.113] - 2026-06-28
### Fixed
- **BUG-22** `conflictEngine.ts`: `blockingEffect` predicate used `||` causing rules with `conflictBehavior:"block"` but `writeAllowed:true` to incorrectly halt conflict resolution. Fixed to `&&`.
- **BUG-05** `attendanceV2.service.ts`: `resolveCalendarDay` fallback hardcoded `"6days"` — 5-day schools treated Saturday as effective. Fixed by persisting `workDayFormat` in `AttendanceDatasetCanonical` and reading it in the fallback.
- **BUG-11** `attendanceExportLegacyBridge.ts`: Plain weekends (`isEffective=false`, no `holidayName`) were flagged `isHoliday:true` in export. Fixed to use explicit-holiday check (`holidayName || holidaysByDate.has()`) in both cell and day-header mapping.
- **BUG-10** `attendanceExportLegacyBridge.ts`: Existing attendance records on holiday days (e.g. makeup class) were silently overwritten with `"L"`. Fixed to preserve explicit records, using `"L"` only as fallback when no record exists.
- **BUG-12** `canonical.validation.ts`: `lockedMonths` was computed but never passed to `validateCanonicalRecord`, so `LOCKED_WRITE_ATTEMPT` was never surfaced at dataset validation level. Fixed by passing `lockedMonths` through.
- **BUG-20** `statusEngine.ts`: `resetToDefaults()` shallow-copied `defaultStatuses` without deep-cloning values. A `registerCustomStatus` call could mutate the `defaultStatuses` source object, corrupting subsequent resets. Fixed with per-entry deep clone.

### Tests Added
- Regression test `[BUG-11]`: weekend day must not be flagged `isHoliday` in export output.
- Regression test `[BUG-10]`: record on holiday day is preserved as cell value; day header remains `isHoliday:true`.

### Safety
- V1 Presensi page, V1 hook, legacy export renderers, import/OCR, Supabase schema, and production data remain untouched.
- Runtime default remains V1 and V2 remains inactive.

## [2.4.112] - 2026-06-27
### Fixed
- Added regression test for `updateNote` missing-record path: confirms `RECORD_NOT_FOUND_FOR_NOTE_UPDATE` is returned with no audit event when the target record is absent.
- Added regression tests for `computeSummaryBundle` edge cases: empty-record dataset produces correct zero summaries, and dispensation (D) counts toward both `presentCount` and `dispensationCount` without inflation.

### Safety
- V1 Presensi page, V1 hook, legacy export renderers, import/OCR, Supabase schema, and production data remain untouched.
- No V2 logic changed; only regression tests added to document and guard existing behavior.
- Runtime default remains V1 and V2 remains inactive.

## [2.4.111] - 2026-06-27
### Fixed
- Hardened Presensi Phase 11 shadow comparison so same-record/different-order drift is reported as `record_order`.
- Added canonical export signature contract fields (`includeSignature`, `signature`) and validation for missing signature settings or unusable signer.
- Added canonical export validation that blocks unmapped custom status symbols before legacy export rendering.

### Safety
- V1 Presensi page, V1 hook, legacy export renderers, import/OCR, Supabase schema, and production data remain untouched.
- Runtime default remains V1 and V2 remains inactive.
- Signature rendering and browser UI parity remain documented as pre-cutover gates, not Phase 11 live behavior changes.

## [2.4.110] - 2026-06-27
### Added
- Added Phase 10 Presensi migration-safety test harness under `apps/frontend/src/features/attendance/testing/`.
- Added generated testing documentation for matrix, datasets, run report, regression risks, and Phase 10 summary.
- Covered canonical corruption, 5/6-day effective-day datasets, runtime fallback, locked/disabled V2 writes, V1 seam mapping, shadow drift, and canonical export payload compatibility.

### Safety
- V1 Presensi page, V1 hook, export renderers, import, OCR, Supabase schema, and production data remain untouched.
- Phase 10 tests use deterministic in-memory fixtures only.
- Signature rendering remains documented as a manual/spec gate until export UI settings are adapted into canonical export input.

## [2.4.109] - 2026-06-27
### Added
- Added Phase 09 Presensi export canonical adapter under `apps/frontend/src/features/attendance/export/`.
- Added canonical-to-legacy export bridge for `AttendanceExportPreviewDataV2` and `AttendancePrintDataset`.
- Added export bridge validation to prevent engine/debug metadata leakage and row/day shape mismatch.
- Added golden structured export tests for status cells, totals, configurable `Jumlah`, notes, holidays, events, and print-preview parity.
- Added Phase 09 export documentation for adapter implementation, golden test plan, backward compatibility, and engine-agnostic proof.

### Safety
- V1 Presensi page, V1 hook, existing export renderers, Excel export path, import, OCR, and Supabase schema remain untouched.
- Live export behavior remains unchanged; Phase 09 adds a validated adapter seam but does not switch the studio to canonical output yet.

## [2.4.108] - 2026-06-27
### Added
- Added Phase 08 frontend Presensi canonical provider boundary around the existing runtime route.
- Added read-only canonical provider snapshot creation with UI/export-safe projections and validation issue tracking.
- Added debug-only runtime/canonical panel gated by URL/localStorage opt-in.
- Added frontend import guard helpers and tests to document blocked direct V1/V2 imports from future pure UI.
- Added Phase 08 frontend documentation for integration report, canonical provider spec, UI migration plan, and regression checklist.

### Safety
- V1 page, V1 hook, export, import, OCR, Supabase schema, and runtime default remain untouched.
- `/attendance` still renders `AttendanceV1Wrapper`; V2 remains blocked by runtime guard.
- Normal users do not see runtime or canonical debug output.

## [2.4.107] - 2026-06-27
### Added
- Added Phase 07 backend Presensi orchestration module under `apps/backend/src/modules/attendance/`.
- Added backend runtime guard with V1 as default, V2 env-gated, admin-gated runtime override, and debug/admin-gated shadow report access.
- Added canonical backend API route family for dataset, patch, bulk patch, note patch, daily/monthly summary, export dataset, runtime, and shadow report.
- Added request validation for class, month, date, status, note, and bulk patch payloads.
- Added backend documentation for implementation report, final API contract, runtime middleware, database extension proposal, and security checklist.

### Safety
- V1 page, hook, export, import, OCR, Supabase schema, migrations, and V1 data tables remain untouched.
- Backend write endpoints fail closed until V2 persistence, auth, scope validation, RLS, and cutover are approved.
- Backend V1/V2 adapters return canonical contract placeholders only; no database read/write adapter was connected in this phase.

## [2.4.106] - 2026-06-27
### Added
- Hardened Phase 06 Core Attendance V2 service after Phase 05 rule engine changes.
- Added immutable canonical dataset orchestration for build/read/validate/apply/bulk/note/summary/shadow operations.
- Expanded V2 patch results with canonical output dataset, rule explanation, audit events, validation issues, and optional shadow comparison.
- Reworked V2 mutation validation so Calendar and Rule engines use the same resolved day context.
- Expanded Phase 06 tests for dataset build, disabled writes, immutable patch application, non-effective days, locks, bulk patching, note updates, summaries, read operations, and shadow comparisons.
- Rewrote Phase 06 V2 documentation for implementation, mutation safety, shadow mode, summary, and audit.

### Safety
- V1 page, hook, export, import, OCR, Supabase schema, and runtime default remain untouched.
- V2 writes remain in-memory and disabled unless a service instance is explicitly active with write enabled.
- Shadow mode remains read/compare only.

## [2.4.105] - 2026-06-27
### Added
- Hardened Phase 05 V2 Rule Engine for Presensi with strict rule context, required audit metadata, condition-error capture, and deterministic conflict resolution.
- Expanded status validation for V1 statuses and future custom statuses, including note-required behavior and present/absence conflict rejection.
- Expanded default rules for missing calendar context, invalid status, required notes, locks, non-effective days, manual writes, retroactive edits, event days, and normal school days.
- Expanded rule tests for normal days, non-effective days, locked dates, administrative closure, class events, retroactive updates, invalid status, custom status validation, competing rules, missing calendar context, and thrown rule conditions.
- Rewrote Phase 05 rule documentation with current contracts, decision table, risks, and safe next action for Phase 06.

### Safety
- V1 page, hook, export, import, OCR, Supabase schema, and runtime activation path remain untouched.
- Rule engine remains isolated under `apps/frontend/src/features/attendance/v2/rules/`.
- No production UI is routed to V2 by this change.

## [2.4.104] - 2026-06-26
### Added
- Implemented Phase 06 Core Attendance V2 orchestrator engine (`attendanceV2.types.ts`, `attendanceV2.audit.ts`, `attendanceV2.validation.ts`, `attendanceV2.shadow.ts`, `attendanceV2.engine.ts`, `attendanceV2.service.ts`).
- `AttendanceV2Service` orchestrates Calendar + Rule + Mutation guard + Audit + Shadow comparison in a single safe pipeline.
- `computeDailySummary`, `computeMonthlySummary`, `computeYearlySummary` are canonical, pure, side-effect-free.
- Shadow mode compares V2 results against V1 raw records without writing to V1 tables.
- Audit trail captures actor, action, before/after, reasonCode per mutation event.
- Added Phase 06 V2 documentation (`V2_ENGINE_IMPLEMENTATION.md`, `V2_MUTATION_SAFETY.md`, `V2_SHADOW_MODE.md`, `V2_SUMMARY_SPEC.md`, `V2_AUDIT_SPEC.md`).
- Fixed test: added missing `days: []` field to `AttendanceDatasetCanonical` fixture to satisfy strict canonical contract.

### Safety
- V1 page, hook, export, import, OCR, and Supabase schema remain fully untouched.
- V2 engine cannot activate from frontend — still isolated behind runtime guard.
- No V1 tables mutated in shadow mode.

## [2.4.103] - 2026-06-26
### Added
- Hardened Phase 04 V2 Calendar Engine for Presensi with deterministic school/class scoped event handling.
- Added stable conflict priority for administrative closures, forced overrides, class events, school events, holidays, weekend rules, and default school days.
- Added calendar metadata for UI hints, lock context, applied event IDs, applied override IDs, and applied holiday IDs.
- Expanded calendar unit tests for Sunday holiday, 5/6-day Saturday behavior, custom holidays, event-on-holiday, multiple events, class-vs-school events, school scope, month boundaries, leap year, locks, invalid dates, and retroactive changes.

### Safety
- V1 page and hook remain untouched.
- Export/import/OCR and Supabase schema remain untouched.
- Effective days remain computed from inputs and are not stored as permanent truth.

## [2.4.102] - 2026-06-26
### Added
- Hardened Phase 03 canonical Presensi contract with strict types for records, days, locks, notes, summaries, UI projection, export projection, validation issues, and shadow comparison.
- Added canonical validation helpers for status, date/month formats, duplicate murid/date records, missing references, non-effective days, locked writes, and export leakage.
- Added canonical mapper tests covering V1 mapping, UI/export projection, custom status validation, and debug metadata isolation.

### Safety
- V1 page and hook remain untouched.
- Export implementation remains untouched; Phase 03 only adds an export-safe canonical payload.
- Supabase schema remains untouched.

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
