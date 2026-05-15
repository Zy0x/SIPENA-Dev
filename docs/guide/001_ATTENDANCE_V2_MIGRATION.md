# SIPENA — Attendance V2 Migration

## Deskripsi

File `docs/sql/001_ATTENDANCE_V2_MIGRATION.sql` memperbarui modul presensi dengan fitur tambahan dari versi V1.

## Perubahan dari V1

| Fitur | V1 | V2 |
|---|---|---|
| Status | H, I, S, A | H, I, S, A, **D (Dispensasi)** |
| Catatan siswa | ❌ | ✅ per-siswa per-hari |
| Kegiatan hari | ❌ | ✅ label + deskripsi + warna |

## Apa yang Dilakukan

1. **Update constraint** — menambah status `D` (Dispensasi)
2. **Menambah kolom `note`** ke `attendance_records`
3. **Membuat tabel `attendance_day_events`** untuk kegiatan hari kustom
4. **RLS policy** untuk tabel baru

## Prasyarat

- `docs/sql/005_MIGRATION_SCHEMA.sql` sudah dijalankan (tabel `attendance_records`, `attendance_holidays` sudah ada)

## Catatan

- Script ini **menggantikan** file `ATTENDANCE_SETUP.sql` (sudah dihapus karena outdated)
- Aman dijalankan berulang kali
