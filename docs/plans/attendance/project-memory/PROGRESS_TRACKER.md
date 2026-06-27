# PROGRESS TRACKER

## SYSTEM PROGRESS

- Phase 00 - Architecture Design: COMPLETE
- Phase 01 - Runtime Switch Implementation: COMPLETE (V1-default route shell implemented; V2 guard locked)
- Phase 02 - Clone / Wrap V1: COMPLETE
- Phase 03 - Canonical Model: COMPLETE
- Phase 04 - Calendar Engine: COMPLETE
- Phase 05 - Rule Engine: COMPLETE
- Engine Design: IN PROGRESS
- Backend Design: COMPLETE SPEC ONLY
- Frontend Design: COMPLETE SPEC ONLY
- Export Design: COMPLETE SPEC ONLY
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
