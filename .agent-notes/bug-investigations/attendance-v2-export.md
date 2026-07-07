# Bug Investigation

## Symptoms
Tombol Ekspor di halaman Presensi V2 tidak membuka flow ekspor.

## Reproduction steps
1. Buka Presensi V2 dengan kelas berisi murid.
2. Tekan tombol `Ekspor`.
3. Tidak ada dialog pemilih bulan atau studio ekspor yang terbuka.

## Expected behavior
Tombol `Ekspor` membuka pemilih bulan, lalu setelah bulan dipilih membuka Studio Ekspor Presensi.

## Actual behavior
Handler trigger hanya menjalankan persiapan baseline studio dan tidak membuka dialog apa pun.

## Suspected files
- `apps/frontend/src/pages/AttendanceV2.tsx`
- `apps/frontend/src/hooks/useAttendanceV2Export.tsx`
- `apps/frontend/src/components/attendance/v2/AttendanceV2Controls.tsx`

## Working fix
Tambahkan wrapper handler di `AttendanceV2.tsx` yang:
1. menjalankan baseline `prepareAttendanceExportStudio()`;
2. menyetel tahun picker ke bulan aktif;
3. membuka `showExportMonthDialog`.

## Verification
Guard test ditambahkan di `apps/frontend/src/pages/AttendanceV2ExportGuard.test.ts`.
Validasi yang dijalankan:
- `npm exec vitest run apps/frontend/src/pages/AttendanceV2ExportGuard.test.ts`
- `npm run typecheck`
- `npm run lint -- --quiet`
- `npm run build`
- `npm test`
- `npm run verify:web:dist`
- `git diff --check`

## Status
Fixed and validated locally.
