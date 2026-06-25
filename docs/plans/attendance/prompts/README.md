<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# SIPENA Attendance Prompt Pack

Folder ini berisi prompt eksekusi bertahap untuk membangun Attendance V2 SIPENA secara aman berdasarkan prinsip:

- V1 production tetap aktif dan tidak boleh disentuh.
- V2 dibangun terisolasi.
- Runtime switch memilih engine.
- Canonical model menjadi kontrak tunggal untuk UI, backend, export, dan testing.
- Export harus engine-agnostic.
- Migration harus melalui shadow mode.
- Rollback harus cukup dengan konfigurasi.

## Urutan Pemakaian

1. `PHASE_-1_DISCOVERY.md`
2. `PHASE_00_ARCHITECTURE.md`
3. `PHASE_01_RUNTIME.md`
4. `PHASE_02_CLONE_V1.md`
5. `PHASE_03_CANONICAL_MODEL.md`
6. `PHASE_04_CALENDAR_ENGINE.md`
7. `PHASE_05_RULE_ENGINE.md`
8. `PHASE_06_CORE_ATTENDANCE_V2.md`
9. `PHASE_07_BACKEND.md`
10. `PHASE_08_FRONTEND.md`
11. `PHASE_09_EXPORT.md`
12. `PHASE_10_TESTING.md`
13. `PHASE_11_FIXING.md`
14. `PHASE_12_FINAL_CUTOVER.md`

## Cara Pakai

Gunakan satu prompt per sesi atau per milestone. Jangan lompat fase kecuali dokumen fase sebelumnya sudah selesai dan acceptance criteria sudah terpenuhi.

## Guardrail Utama

Jika ada konflik antara prompt dan dokumen project, ikuti urutan prioritas:

1. `AGENTS.md` jika ada di repo
2. `attendance/01_MANIFEST.md`
3. `attendance/02_AI_CONTRACT.md`
4. `attendance/project-memory/*`
5. prompt fase aktif

## Prinsip Eksekusi

Setiap prompt sengaja dibuat:
- eksplisit soal file yang harus dibaca,
- jelas soal file yang boleh dibuat,
- ketat soal hal yang tidak boleh disentuh,
- punya stop condition,
- punya acceptance criteria,
- bisa dipakai oleh AI coding assistant atau engineer manusia.
