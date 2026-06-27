# Phase 10 Regression Risk Report

## Objective
Mengklasifikasikan risiko Presensi V2 sebelum Phase 11 fixing/cutover work dimulai.

## Evidence From Actual Repo Files
- Runtime default V1: `attendanceRuntime.config.ts`
- V2 activation lock: `attendanceRuntimeGuard.ts`
- V1 wrapper: `AttendanceV1Wrapper.tsx`
- Export compatibility bridge: `attendanceExportLegacyBridge.ts`
- Phase 10 matrix: `attendancePhase10.test.ts`

## Findings
| Risk | Class | Evidence | Mitigation |
| --- | --- | --- | --- |
| V2 accidentally active in normal UI | BLOCKER if it occurs | Runtime guard forces V1 while V2 is not implemented | Runtime tests and Phase 10 fallback test |
| Export output changes before approval | HIGH | Phase 09 adapter not wired into live studio | Forbidden-path guard and legacy export untouched |
| Canonical export misses signature settings | HIGH | Signature belongs to legacy studio, not Phase 09 adapter input | Keep as manual/spec gate before export cutover |
| Shadow comparison misses record ordering issues | MEDIUM | Shadow compares student/date/status, not full ordering | Add ordering parity once canonical export is wired |
| UI import/OCR/export accessibility regresses | MEDIUM | Phase 08 provider wraps V1 but does not replace UI | Manual frontend checklist until Playwright coverage exists |
| Stress/load regression on large classes | MEDIUM | Current tests avoid timing assertions | Add non-flaky perf budget after browser harness exists |
| Future custom statuses break V1 export | MEDIUM | Canonical allows custom status, legacy export counts only V1 statuses | Keep export adapter validation and explicit custom status mapping before cutover |
| Documentation drift | LOW | Phase docs are updated per phase | Keep changelog/progress tracker updated |

## Safe Next Action
Phase 11 should focus on closing automated gaps before any runtime cutover: signature export tests, browser UI regression, shadow parity expansion, and import/OCR retained-entry checks.

## Blockers
No Phase 10 blocker. Cutover remains blocked until signature/render-level export and UI browser regression are automated or explicitly accepted.
