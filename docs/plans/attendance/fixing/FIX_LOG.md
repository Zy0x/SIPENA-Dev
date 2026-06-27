# Phase 11 Fix Log

## Objective
Mencatat fix hardening Presensi Phase 11 berdasarkan laporan Phase 10 tanpa mengubah V1, export renderer lama, import/OCR, atau schema database.

## Evidence From Actual Repo Files
- Source reports: `docs/plans/attendance/testing/generated/TEST_RUN_REPORT.md`, `docs/plans/attendance/testing/generated/REGRESSION_RISK_REPORT.md`
- Shadow comparator: `apps/frontend/src/features/attendance/v2/attendanceV2.shadow.ts`
- Export bridge types/validation: `apps/frontend/src/features/attendance/export/attendanceExportCanonical.types.ts`, `attendanceExport.validation.ts`, `attendanceExportLegacyBridge.ts`
- Regression tests: `apps/frontend/src/features/attendance/export/attendanceExportGolden.test.ts`, `apps/frontend/src/features/attendance/v2/attendanceV2.test.ts`

## Findings
| Issue ID | Source Report/Test | Severity | Files Changed | Fix Summary | Verification | Result | Rollback Note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P11-001 | `REGRESSION_RISK_REPORT.md`: shadow comparison misses record ordering issues | MEDIUM | `attendanceV2.shadow.ts`, `attendanceV2.test.ts` | Shadow comparison now detects same-record/different-order drift with `record_order` mismatch. | `npm test -- --run apps/frontend/src/features/attendance/export/attendanceExportGolden.test.ts apps/frontend/src/features/attendance/v2/attendanceV2.test.ts apps/frontend/src/features/attendance/testing/attendancePhase10.test.ts` | PASS | Revert comparator/test changes; V1 remains unaffected. |
| P11-002 | `TEST_MATRIX.md`: signature export remains manual/spec gate | HIGH before cutover | `attendanceExportCanonical.types.ts`, `attendanceExportLegacyBridge.ts`, `attendanceExport.validation.ts`, `attendanceExportGolden.test.ts` | Canonical export bridge now carries explicit `includeSignature` and `signature` contract and blocks signature-enabled export when settings are missing or signer is unusable. | Same targeted Vitest command | PASS | Revert export adapter contract changes; live legacy studio still owns signature. |
| P11-003 | `REGRESSION_RISK_REPORT.md`: future custom statuses can break V1 export | MEDIUM | `attendanceExport.validation.ts`, `attendanceExportGolden.test.ts` | Export validation now blocks cell values outside approved legacy status symbols `H/I/S/A/D/L/-` until a future mapping policy is approved. | Same targeted Vitest command | PASS | Revert validation/test changes; no live V1 export renderer changed. |
| P11-004 | Edge case: `updateNote` targets a record not in dataset — no regression test | LOW | `attendanceV2.test.ts` | Added regression test confirming `RECORD_NOT_FOUND_FOR_NOTE_UPDATE` is returned with `success: false`, null audit event, and empty audit log. | `npm test -- --run apps/frontend/src/features/attendance/v2/attendanceV2.test.ts` | PASS | Revert test only; no logic changed. |
| P11-005 | Edge case: `computeSummaryBundle` with empty records could surface silent zero-counts | LOW | `attendanceV2.test.ts` | Added regression tests confirming empty-record dataset produces correct zero summary for all murid and class recap, and that dispensation (D) counts toward both `presentCount` and `dispensationCount` without inflation. | Same targeted Vitest command | PASS | Revert test only; no logic changed. |

## Risks
- `HIGH`: Binary signature rendering parity is still not automated because the live renderer/studio is intentionally untouched in Phase 11.
- `MEDIUM`: Browser UI regression remains manual until a Playwright/browser harness is introduced.

## Safe Next Action
Run full validation gates, then continue only to Phase 12 if remaining manual gates are explicitly accepted or automated in a later dedicated phase.

## Blockers
No blocker for Phase 11 foundation. Phase 12 cutover remains blocked by live render/browser parity gates.
