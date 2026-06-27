# Phase 11 Root Cause Analysis

## Objective
Menjelaskan akar masalah dari gap Phase 10 yang diperbaiki pada hardening Phase 11.

## Evidence From Actual Repo Files
- `docs/plans/attendance/testing/generated/REGRESSION_RISK_REPORT.md`
- `apps/frontend/src/features/attendance/v2/attendanceV2.shadow.ts`
- `apps/frontend/src/features/attendance/export/attendanceExport.validation.ts`
- `apps/frontend/src/features/attendance/export/attendanceExportCanonical.types.ts`

## Findings
### P11-001 - Shadow ordering parity
Root cause: comparator shadow hanya memakai key `studentId:date` dan status. Dataset dengan record yang sama tetapi urutan berbeda bisa terlihat cocok, padahal export dan tabel dapat bergantung pada urutan.

Fix: comparator tetap melakukan lookup key untuk missing/status mismatch, lalu menambahkan pass urutan untuk record yang sama tetapi berada pada posisi berbeda.

### P11-002 - Signature contract gap
Root cause: adapter canonical hanya menghasilkan preview/print dataset. Signature masih milik legacy studio, sehingga tidak ada kontrak otomatis untuk membuktikan bahwa signature settings tersedia saat export canonical nanti diaktifkan.

Fix: adapter result membawa `includeSignature` dan `signature` secara eksplisit, lalu validator memblokir signature export bila settings atau signer tidak tersedia.

### P11-003 - Unmapped custom status export
Root cause: canonical model mengizinkan future custom status, tetapi legacy export resmi hanya punya simbol mapan. Tanpa guard, nilai custom dapat masuk sebagai cell string tanpa mapping approved.

Fix: validator export memeriksa seluruh cell output dan memblokir simbol selain `H`, `I`, `S`, `A`, `D`, `L`, dan `-`.

## Risks
- `HIGH`: P11-002 bukan binary renderer proof. Ini kontrak adapter agar cutover tidak lanjut tanpa signature settings.
- `MEDIUM`: P11-001 mendeteksi urutan record, tetapi urutan murid/day tingkat dataset tetap harus dijaga oleh canonical export bridge tests.

## Safe Next Action
Tambahkan browser/render automation sebelum menyalakan canonical export di UI produksi.

## Blockers
Tidak ada blocker untuk Phase 11. Cutover V2 tetap belum boleh dilakukan.
