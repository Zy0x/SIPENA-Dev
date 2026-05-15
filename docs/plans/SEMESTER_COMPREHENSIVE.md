# SIPENA — Semester Comprehensive Migration

## Deskripsi

File `SEMESTER_COMPREHENSIVE.sql` menambahkan **layer semester** ke sistem tahun ajaran untuk filtering data yang lebih granular.

## Apa yang Dilakukan

1. **Menambah kolom date range** (`start_date`, `end_date`) ke tabel `semesters`
2. **Menambah kolom `semester_id`** ke tabel: `grades`, `chapters`, `assignments`
3. **Membuat function** untuk auto-generate semester saat tahun ajaran dibuat
4. **Update RLS policy** dengan filter semester
5. **Membuat trigger** untuk sinkronisasi otomatis

## Prasyarat

- `docs/sql/005_MIGRATION_SCHEMA.sql` sudah dijalankan
- `docs/sql/012_ACADEMIC_YEAR_COMPREHENSIVE.sql` sudah dijalankan

## Catatan

- Script ini **menggantikan** file `SEMESTER_SYSTEM_V2.sql` (sudah dihapus)
- Aman dijalankan berulang kali (idempotent)
