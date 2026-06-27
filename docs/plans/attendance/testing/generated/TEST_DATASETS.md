# Phase 10 Test Datasets

## Objective
Mendefinisikan dataset aman yang dapat dipakai untuk parity, migration safety, dan export-stability tests tanpa menyentuh data V1 produksi.

## Evidence From Actual Repo Files
- Dataset V2 dibangun dengan `AttendanceV2Service.buildDataset`.
- V1 seam dataset dibangun dengan `mapV1SeamInputToCanonicalDataset`.
- Export dataset dikonversi melalui `createAttendanceExportLegacyBridge`.

## Findings
| Dataset | Purpose | Source | Automated |
| --- | --- | --- | --- |
| Empty class | memastikan kelas tanpa murid tetap valid untuk export bridge | in-memory canonical | Yes |
| Class with murid but no attendance | memastikan default cell `-` dan hari efektif tetap stabil | in-memory V2 | Yes |
| Full month 6-day school | Juni 2026 dengan Senin-Sabtu efektif | V2 calendar engine | Yes |
| Full month 5-day school | Juni 2026 dengan Senin-Jumat efektif | V2 calendar engine | Yes |
| Month with holidays | libur custom pada 2026-06-03 | V2 calendar + export | Yes |
| Month with overlapping events | covered by calendar unit tests for event priority | V2 calendar tests | Yes |
| Locked date/month | locked month blocks write but not read | V2 service | Yes |
| Murid moved class mid-month | missing student reference blocks mutation | canonical validation + V2 service | Yes |
| Duplicate attendance records | duplicate murid/date detected before migration/export | canonical validation | Yes |
| Invalid statuses | status outside V1/custom model rejected | canonical validation + rule tests | Yes |
| Notes and retroactive edits | note text preserved in export and update path audited | V2 service + export | Yes |
| Export with signature | legacy studio responsibility, not canonical payload yet | manual/spec | No |
| Export without signature | structured payload and print dataset parity | export bridge | Yes |

## Risks
- `HIGH`: Signature and final renderer-level PDF/Excel/PNG proof remain outside Phase 10 automated adapter scope.
- `MEDIUM`: Browser-only UI actions need Playwright before cutover.

## Safe Next Action
Keep all Phase 10 datasets deterministic and in-memory. Add real browser fixtures only after the UI migration phase reaches a guarded preview route.

## Blockers
No destructive or production dataset is required.
