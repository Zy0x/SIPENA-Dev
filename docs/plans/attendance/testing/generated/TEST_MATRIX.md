# Phase 10 Test Matrix

## Objective
Membuktikan Presensi V1 dan fondasi V2 dapat hidup berdampingan tanpa mengubah perilaku V1, tanpa menulis data produksi, dan tanpa membuat ekspor bergantung pada engine tertentu.

## Evidence From Actual Repo Files
- Runtime guard: `apps/frontend/src/features/attendance/runtime/attendanceRuntimeGuard.ts`
- Canonical validation: `apps/frontend/src/features/attendance/canonical/canonical.validation.ts`
- V1 seam: `apps/frontend/src/features/attendance/v1/attendanceV1.canonical.ts`
- V2 core: `apps/frontend/src/features/attendance/v2/attendanceV2.service.ts`
- Calendar/rule tests: `apps/frontend/src/features/attendance/v2/calendar/calendarEngine.test.ts`, `apps/frontend/src/features/attendance/v2/rules/ruleEngine.test.ts`
- Export adapter: `apps/frontend/src/features/attendance/export/attendanceExportLegacyBridge.ts`
- Phase 10 harness: `apps/frontend/src/features/attendance/testing/attendancePhase10.test.ts`

## Findings
| Level | Coverage | Automated | Gate |
| --- | --- | --- | --- |
| Canonical validation | status, ISO date/month, duplicate murid/date, missing murid, export leakage | Yes | `attendancePhase10.test.ts`, `canonical.test.ts` |
| Calendar engine | 5-day, 6-day, holiday, event, lock, boundaries, leap year | Yes | `calendarEngine.test.ts`, Phase 10 harness |
| Rule/status engine | V1 status, custom status, note-required status, lock, non-effective day | Yes | `ruleEngine.test.ts` |
| V2 orchestration | build/read/apply/bulk/note/summary/shadow | Yes | `attendanceV2.test.ts`, Phase 10 harness |
| V1 canonical seam | V1 records, holidays, day events, locks, read-only dataset | Yes | `attendanceV1.canonical.test.ts`, Phase 10 harness |
| Runtime fallback | invalid config, disabled mode, V2 requested while locked | Yes | `attendanceRuntime.test.ts`, Phase 10 harness |
| Frontend provider | stable idle shape, canonical snapshot, invalid dataset state | Yes | `attendanceProvider.test.ts` |
| Export adapter | structured legacy payload, totals, notes, holiday/event items, engine leakage | Yes | `attendanceExportGolden.test.ts`, Phase 10 harness |
| Migration/shadow | V1 remains source, V2 comparison reports mismatch without writes | Yes | `attendanceV2.test.ts`, Phase 10 harness |
| UI visual behavior | V1 screen remains active, debug panel opt-in, import/OCR/export retained | Spec/manual | `FRONTEND_REGRESSION_CHECKLIST.md` |
| Signature export | Signature remains owned by legacy export studio settings | Spec/manual | See risks |
| Stress/load | Structured in-memory dataset shape checks; full browser perf still manual | Partial | See risks |

## Risks
- `HIGH`: Signature-specific export rendering is not yet covered by automated canonical adapter tests because signature settings remain in the legacy export studio layer.
- `MEDIUM`: Full UI visual regression remains manual until Playwright scenarios are added for Presensi.
- `LOW`: Stress coverage currently validates structural behavior, not timing thresholds, to avoid flaky CI.

## Safe Next Action
Run Phase 10 gates: targeted Vitest, full `npm test`, typecheck, lint, build, `verify:web:dist`, and forbidden-path guard.

## Blockers
None for Phase 10 documentation/testing. Signature rendering automation should be added before canonical export is connected to production UI.
