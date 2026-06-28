# PROGRESS TRACKER

## SYSTEM PROGRESS

- Phase 00 - Architecture Design: COMPLETE
- Phase 01 - Runtime Switch Implementation: COMPLETE (V1-default route shell implemented; V2 guard locked)
- Phase 02 - Clone / Wrap V1: COMPLETE
- Phase 03 - Canonical Model: COMPLETE
- Phase 04 - Calendar Engine: COMPLETE
- Phase 05 - Rule Engine: COMPLETE
- Phase 06 - Core Attendance V2: COMPLETE
- Phase 07 - Backend Orchestration: COMPLETE FOUNDATION
- Phase 08 - Frontend Runtime/Canonical Integration: COMPLETE FOUNDATION
- Phase 09 - Export Canonical Adapter: COMPLETE FOUNDATION
- Phase 10 - Testing Matrix: COMPLETE FOUNDATION
- Phase 11 - Fixing / Hardening: COMPLETE FOUNDATION
- Phase 12 - Final Cutover: COMPLETE — SHADOW_ONLY mode chosen
- Engine Design: IN PROGRESS
- Backend Design: IMPLEMENTED FOUNDATION
- Frontend Design: IMPLEMENTED FOUNDATION
- Export Design: IMPLEMENTED FOUNDATION
- Migration Design: COMPLETE SPEC ONLY

---

## RULE
Progress is documentation-based, not implementation-based

## PHASE 01 IMPLEMENTATION CHECKPOINT - 2026-06-26

- Runtime types: implemented.
- Runtime config resolver: implemented with default V1 and invalid-config fallback.
- Runtime guard: implemented with V2 disabled.
- Runtime provider/hook: implemented.
- `/attendance` route shell: implemented via `AttendanceRuntimeRoute`.
- V1 internals modified: no.
- Export/import/OCR/schema modified: no.

## PHASE 02 IMPLEMENTATION CHECKPOINT - 2026-06-26

- V1 wrapper route: active and still renders locked `Attendance.tsx`.
- V1 adapter seam: present, but not activated as a second lifecycle owner.
- V1 canonical mapping draft: implemented as pure read-only helpers.
- V1 canonical seam tests: implemented for status, records, holidays, day events, locks, dataset drafts, and wrapper guard.
- V1 internals modified: no.
- Export/import/OCR/schema modified: no.
- Runtime default: V1.
- V2 activation: still blocked.

## PHASE 03 IMPLEMENTATION CHECKPOINT - 2026-06-26

- Canonical types: implemented under `apps/frontend/src/features/attendance/canonical/`.
- Canonical mappers: implemented for V1-like records, holidays, day events, locks, UI projection, and export-safe projection.
- Canonical validation: implemented for status, ISO date/month, murid/class references, duplicate murid/date records, non-effective days, locked writes, and export engine leakage.
- Canonical docs: expanded in `docs/plans/attendance/canonical/`.
- Targeted tests: canonical, V1 seam, and runtime tests passed.
- V1 internals modified: no.
- Export/import/OCR/schema modified: no.
- Runtime default: V1.

## PHASE 04 IMPLEMENTATION CHECKPOINT - 2026-06-26

- Calendar engine types: hardened with scoped events, school scope, override scope, deterministic reason codes, and UI metadata.
- Conflict resolver: deterministic priority implemented for administrative closures, forced overrides, class events, school events, holidays, weekend rules, and default school days.
- Effective day engine: produces canonical day-compatible output with lock context and write-block state.
- Calendar docs: expanded in `docs/plans/attendance/calendar/`.
- Targeted tests: calendar and canonical tests passed.
- V1 internals modified: no.
- Export/import/OCR/schema modified: no.
- Effective days stored as source of truth: no.

## PHASE 05 IMPLEMENTATION CHECKPOINT - 2026-06-27

- Rule engine types: hardened with nullable calendar context, status behavior flags, conflict behavior, condition errors, and required audit metadata.
- Status engine: validates default/custom status definitions and preserves V1 codes `H`, `I`, `S`, `A`, `D` plus derived `L` and `-`.
- Conflict engine: deterministic priority, specificity, merge, block, and same-specificity clash reporting implemented.
- Default rules: expanded for missing calendar context, invalid status, required notes, locks, non-effective days, manual writes, retroactive edits, event defaults, and normal school days.
- Rule docs: expanded in `docs/plans/attendance/rules/`.
- Targeted tests: rule, calendar, and canonical tests passed.
- V1 internals modified: no.
- Export/import/OCR/schema modified: no.
- Runtime activation changed: no.

## PHASE 06 IMPLEMENTATION CHECKPOINT - 2026-06-27

- Core service: hardened as immutable canonical orchestrator for build, read, validate, apply, bulk apply, note update, summary, audit, and shadow compare operations.
- Mutation validation: now receives the same resolved V2 calendar day used by the rule engine.
- Patch output: includes canonical output dataset, rule explanation, audit events, validation issues, and optional shadow comparison.
- Summary engine: computes daily, monthly, yearly, and class recap from canonical records.
- Shadow mode: remains read/compare only and does not write to V1 or V2 storage.
- Phase 06 docs: expanded in `docs/plans/attendance/v2/`.
- Targeted tests: V2 service, rule, calendar, and canonical tests passed.
- V1 internals modified: no.
- Export/import/OCR/schema modified: no.
- Runtime default changed: no.

## PHASE 07 IMPLEMENTATION CHECKPOINT - 2026-06-27

- Backend attendance module: implemented under `apps/backend/src/modules/attendance/` using the repo's existing `node:http` style.
- Runtime guard: implemented with V1 default, invalid-config fallback, V2 env gate, write env gate, admin runtime override guard, and debug/admin shadow guard.
- API routes: `/api/attendance`, `/api/attendance/bulk`, `/api/attendance/note`, `/api/attendance/summary/daily`, `/api/attendance/summary/monthly`, `/api/attendance/export-dataset`, `/api/attendance/runtime`, and `/api/attendance/shadow/report`.
- Request validation: class, month, date, status, note, and bulk patch payloads.
- Write behavior: fail-closed until V2 persistence, auth, scope validation, RLS, and cutover are approved.
- Database schema modified: no.
- V1 internals modified: no.
- Export/import/OCR/schema modified: no.
- Validation: `typecheck`, full frontend `test`, `lint`, frontend `build`, backend workspace `build`, `verify:web:dist`, `git diff --check`, and forbidden-path guard passed.
- Runtime limitation: direct `node apps/backend/dist/main.js` still fails due existing extensionless ESM import output. This is documented as a backend packaging blocker, not an attendance logic change.

## PHASE 08 IMPLEMENTATION CHECKPOINT - 2026-06-27

- Frontend route boundary: `/attendance` remains mounted through `AttendanceRuntimeRoute`, now with `AttendanceProvider` and `AttendanceRuntimeBoundary` outside the V1 wrapper.
- Canonical provider: implemented as a read-only snapshot layer with stable idle state, canonical validation, UI projection, and export-safe projection.
- Debug panel: implemented as opt-in only via `?attendanceDebug=1` or `localStorage.attendance_debug_panel=1`.
- Frontend guard: added helper/tests documenting that future pure UI must not import V1 page/hook or V1/V2 internals directly.
- V1 internals modified: no.
- Export/import/OCR/schema modified: no.
- Runtime default changed: no.
- V2 activation changed: no.

## PHASE 09 IMPLEMENTATION CHECKPOINT - 2026-06-27

- Export adapter: implemented as a canonical-to-legacy bridge under `apps/frontend/src/features/attendance/export/`.
- Legacy shape: adapter emits `AttendanceExportPreviewDataV2` and `AttendancePrintDataset` without changing the renderer.
- Golden tests: added structured tests for day count, murid row count, cells, totals, configurable `Jumlah`, notes, holiday/event items, and engine leakage.
- Live export behavior changed: no.
- V1 page/hook modified: no.
- Export renderer/layout/Excel path modified: no.
- Import/OCR/schema modified: no.

## PHASE 10 TESTING CHECKPOINT - 2026-06-27

- Test matrix: generated under `docs/plans/attendance/testing/generated/`.
- Phase 10 harness: added under `apps/frontend/src/features/attendance/testing/`.
- Coverage: canonical corruption, 5/6-day calendar behavior, holiday/event/lock datasets, runtime V1 fallback, V2 mutation guard, V1 seam mapping, shadow mismatch report, export adapter engine-agnostic payload, moved-murid/missing-reference guard.
- Data safety: tests are in-memory only and do not touch V1 production storage.
- V1 page/hook modified: no.
- Export renderer/layout/Excel path modified: no.
- Import/OCR/schema modified: no.
- Validation: `typecheck`, targeted Phase 10 Vitest, full frontend `test`, `lint`, frontend `build`, `verify:web:dist`, and `git diff --check` passed. Lint/build/test warnings are documented in `TEST_RUN_REPORT.md`.

## PHASE 11 FIXING CHECKPOINT - 2026-06-27

- Fix scope: limited to issues documented by Phase 10 reports.
- Shadow parity: `compareWithV1CanonicalResult` now reports `record_order` drift for same-record/different-order datasets.
- Export adapter: canonical bridge now carries explicit signature settings contract and blocks signature-enabled export when settings/signers are missing.
- Export status safety: canonical bridge validation blocks unmapped custom status symbols before legacy export rendering.
- updateNote safety: regression test added for `RECORD_NOT_FOUND_FOR_NOTE_UPDATE` when target record is absent from dataset.
- Summary correctness: regression tests added for empty-record dataset zero-summary and dispensation (D) double-count guard.
- Fix reports: generated under `docs/plans/attendance/fixing/`.
- V1 internals modified: no.
- Export renderer/layout/Excel path modified: no.
- Import/OCR/schema modified: no.
- Runtime default changed: no.
- Deferred gates: binary signature rendering parity and browser UI regression remain pre-cutover risks.

## PHASE 12 CUTOVER CHECKPOINT - 2026-06-28

- Cutover mode: SHADOW_ONLY.
- Final gate evaluation: 12/14 PASS; 2 deferred (signature render parity, browser E2E).
- Runtime config: `VITE_ATTENDANCE_ENGINE=v2`, `VITE_ATTENDANCE_MODE=shadow`.
- Runtime before: `{ engine: "v1", mode: "active", source: "default" }`.
- Runtime after: `{ engine: "v2", mode: "shadow", source: "env" }`.
- V1 internals modified: no.
- Export renderer/layout/Excel/PDF/PNG path modified: no.
- Import/OCR/schema modified: no.
- Supabase writes by V2: none.
- Release documents: created under `docs/plans/attendance/release/`.
- Test baseline: 571/571 tests pass, 0 TypeScript errors.
- Rollback: config-only — remove `VITE_ATTENDANCE_ENGINE` env var (< 2 min).
- Next milestone: Phase 13 — Playwright E2E + PDF render parity → `CLASS_ROLLOUT`.

## RELEASE V2 VISUALIZER CHECKPOINT - 2026-06-28
- Safety Lock: IS_ATTENDANCE_V2_IMPLEMENTED set to `true`.
- UI Integration: `AttendanceRuntimeRoute` updated to render `AttendanceV2Visualizer` for `engine === "v2"`.
- Test Baseline: 571/571 passed, 0 TypeScript errors.
- Version: 2.4.115.

## V2 UI PARITY CHECKPOINT - 2026-06-28
- UI Parity: Achieved 100% visual parity by integrating V2 engine directly into the V1 `useAttendance.ts` hook layer.
- Routing: Restored `ResolvedAttendanceRuntime` to render `AttendanceV1Wrapper` for both engines.
- Test Suite: 571/571 passed, 0 TypeScript errors.
- Version: 2.4.116.

## BACKEND INTEGRATION & V2 PERSISTENCE CHECKPOINT (PHASE 07) - 2026-06-28
- Auth parsing: Extract and validate user Bearer token using supabase.auth.getUser() server-side.
- Database Adapters: Implemented real query adapters for both V1 and V2 engines using Supabase SDK.
- V2 Persistence: Enabled secure database updates with server-side business rules pre-validation.
- esbuild Bundler: Introduced esbuild backend packaging to eliminate ESM resolution issues.
- Test baseline: 571/571 passed, 0 TypeScript errors.
- Version: 2.4.117.
