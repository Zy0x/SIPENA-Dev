# Phase 11 Remaining Risks

## Objective
Mendokumentasikan risiko yang tidak boleh dianggap fixed oleh Phase 11 karena membutuhkan scope di luar controlled hardening.

## Evidence From Actual Repo Files
- `docs/plans/attendance/testing/generated/REGRESSION_RISK_REPORT.md`
- `docs/plans/attendance/export/EXPORT_GOLDEN_TEST_PLAN.md`
- `docs/plans/attendance/frontend/FRONTEND_REGRESSION_CHECKLIST.md`

## Findings
| Risk | Class | Status | Reason Deferred | Required Before Cutover |
| --- | --- | --- | --- | --- |
| Binary/render signature parity | HIGH | Deferred | Phase 11 cannot modify export renderer or redesign live studio. Adapter contract now blocks missing signature settings, but final PDF/PNG proof still needs renderer harness. | Add renderer-level signature fixture or Playwright/PDF visual guard. |
| Browser UI regression for import/OCR/export entrypoints | MEDIUM | Deferred | No Phase 10 failure exists and Phase 11 scope forbids broad UI redesign. | Add Playwright scenarios for V1 Presensi route and retained entrypoints. |
| Stress/load timing budgets | MEDIUM | Deferred | Existing test matrix intentionally avoids flaky timing assertions. | Add deterministic browser/performance budget after harness is stable. |
| Canonical export cutover | HIGH | Deferred | Live studio still uses V1 path by design. | Add V1 parity projection and explicit approval before wiring canonical bridge. |

## Risks
- `BLOCKER`: Phase 12 final cutover must not proceed if signature/render or browser parity is still unverified and not explicitly accepted.

## Safe Next Action
Treat Phase 12 as blocked unless the cutover prompt accepts these deferred gates or asks for a dedicated automation pass first.

## Blockers
No Phase 11 blocker. Phase 12 cutover is not ready for production activation without the remaining gates above.
