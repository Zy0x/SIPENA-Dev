# RELEASE NOTES
**Attendance V2 — Shadow Mode Activation**
**Version:** 2.4.113 (shadow mode promotion)
**Date:** 2026-06-28
**Release Type:** Internal Engineering — Shadow Mode Only
**User Impact:** None (V1 remains active for all users)

---

## What This Release Does

This release promotes the Attendance V2 engine from fully isolated (development-only) state
to **Shadow Mode** — running in parallel with V1 but not serving any user-visible output.

V1 attendance system remains the **sole source of truth** for:
- All attendance data displayed to teachers and admin
- All exports (PDF, Excel, PNG)
- All writes to Supabase
- All import and OCR operations

---

## What V2 Can Do in Shadow Mode

- Read attendance data via the canonical read path
- Compute daily/monthly/yearly summaries using the V2 engine
- Evaluate attendance rules through the V2 rule engine
- Resolve calendar effective days using the V2 calendar engine
- Compare V2 output against V1 output via `ShadowComparisonReport`
- Emit structured comparison data for developer analysis

---

## Bugs Fixed in This Release (Phase 11 + Bug Audit)

> All fixes are in isolated V2 engine code. No V1 path was modified.

| Bug | File | Fix |
|-----|------|-----|
| BUG-22: Conflict engine blocked writes incorrectly | `conflictEngine.ts` | Fixed `\|\|` → `&&` in `blockingEffect` predicate |
| BUG-05: Hardcoded 6-day format in fallback | `attendanceV2.service.ts` | `workDayFormat` now persisted and used in `resolveCalendarDay` |
| BUG-11: Weekends flagged as holidays in export | `attendanceExportLegacyBridge.ts` | Explicit holiday check; weekends no longer marked `isHoliday` |
| BUG-10: Records on holiday days overwritten with "L" | `attendanceExportLegacyBridge.ts` | Explicit records preserved; "L" only when no record exists |
| BUG-12: lockedMonths not passed to record validator | `canonical.validation.ts` | `lockedMonths` now forwarded to `validateCanonicalRecord` |
| BUG-20: resetToDefaults() shallow copy corrupted state | `statusEngine.ts` | Deep-clone with per-entry `behaviorFlags` array copy |

---

## Engines and Components Delivered (Phases 01–11)

| Component | Status | Location |
|-----------|--------|----------|
| Runtime config & switch | ✅ Complete | `runtime/attendanceRuntime.config.ts` |
| V1 canonical adapter | ✅ Complete | `v1/attendanceV1.canonical.ts` |
| Canonical types & mappers | ✅ Complete | `canonical/` |
| Canonical validation | ✅ Complete | `canonical/canonical.validation.ts` |
| Calendar engine (V2) | ✅ Complete | `v2/calendar/` |
| Effective day engine | ✅ Complete | `v2/calendar/effectiveDayEngine.ts` |
| Calendar conflict resolver | ✅ Complete | `v2/calendar/calendarConflictResolver.ts` |
| Rule engine (V2) | ✅ Complete | `v2/rules/ruleEngine.ts` |
| Status engine (V2) | ✅ Complete | `v2/rules/statusEngine.ts` |
| Conflict engine (V2) | ✅ Complete | `v2/rules/conflictEngine.ts` |
| Default rules | ✅ Complete | `v2/rules/defaultRules.ts` |
| Core V2 service | ✅ Complete | `v2/attendanceV2.service.ts` |
| V2 audit engine | ✅ Complete | `v2/attendanceV2.audit.ts` |
| Shadow comparator | ✅ Complete | `v2/attendanceV2.shadow.ts` |
| Mutation validator | ✅ Complete | `v2/attendanceV2.validation.ts` |
| Export canonical bridge | ✅ Complete | `export/attendanceExportLegacyBridge.ts` |
| Export adapter | ✅ Complete | `export/attendanceExport.adapter.ts` |
| Export validation | ✅ Complete | `export/attendanceExport.validation.ts` |
| Frontend provider layer | ✅ Foundation | `provider/` |
| Debug panel | ✅ Opt-in only | `?attendanceDebug=1` |
| Backend attendance module | ⚠️ Foundation | `apps/backend/src/modules/attendance/` (packaging blocker) |

---

## Test Coverage

```
Test files:   68 passed (68)
Tests:        571 passed (571)
TypeScript:   0 errors
Lint:         0 errors
Build:        PASS
```

---

## What Is NOT Changed

- `apps/frontend/src/pages/Attendance.tsx` — V1 page (untouched)
- `apps/frontend/src/hooks/useAttendance.ts` — V1 hook (untouched)
- `apps/frontend/src/lib/attendancePrintLayout.ts` — V1 print renderer (untouched)
- `apps/frontend/src/lib/attendancePdfExport.ts` — V1 PDF renderer (untouched)
- `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx` — Export preview (untouched)
- `apps/frontend/src/components/import/OCRImportDialog.tsx` — OCR import (untouched)
- `supabase/` — All Supabase migrations, RLS policies, schema (untouched)
- All attendance data in Supabase — Zero database changes

---

## Deferred to Future Release

| Feature | Target Phase | Notes |
|---------|-------------|-------|
| PDF/PNG binary signature parity verification | Phase 13 | Requires renderer-level fixture |
| Playwright E2E for `/attendance` route | Phase 13 | Playwright harness not yet set up |
| Export studio wired to canonical bridge | Phase 13 | Feature flag implementation needed |
| Backend node packaging resolution | Phase 14 | ESM extensionless import fix needed |
| CLASS_ROLLOUT activation | Phase 14+ | After Phase 13 gates pass |

---

## Known Limitations in Shadow Mode

- Shadow comparison requires V1 data to be passed explicitly to `compareWithV1CanonicalResult`
- No automatic instrumentation exists yet — shadow comparison is triggered in test context only
- Backend routes exist but cannot be served standalone (packaging blocker)
- Export studio still reads from V1 path; canonical bridge is not wired to live renderer
- `KNOWN_LIMITATIONS.md` stubs are outdated (written at Phase 0); see `PROGRESS_TRACKER.md` for current state

---

## Changelog Entry

See `docs/plans/attendance/project-memory/CHANGELOG.md` for full entry `[2.4.113]`.
