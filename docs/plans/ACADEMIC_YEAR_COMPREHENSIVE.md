# SIPENA — Academic Year Comprehensive Migration

## Deskripsi

File `ACADEMIC_YEAR_COMPREHENSIVE.sql` mengimplementasikan **isolasi data berdasarkan tahun ajaran** dengan hierarki:

```
Academic Year → Class → Subject → Grade → Attendance → dll
```

## Apa yang Dilakukan

1. **Menambah kolom `academic_year_id`** ke tabel: `subjects`, `classes`, `grades`, `attendance_records`
2. **Membuat foreign key** ke tabel `academic_years`
3. **Migrasi data existing** — data lama yang belum punya `academic_year_id` akan otomatis di-assign
4. **Membuat index** untuk performa query filter per tahun ajaran
5. **Update RLS policy** agar filter berdasarkan `academic_year_id`

## Prasyarat

- `docs/sql/005_MIGRATION_SCHEMA.sql` sudah dijalankan
- Tabel `academic_years` sudah ada

## Catatan

- Script ini **menggantikan** file `ACADEMIC_YEAR_MIGRATION.sql` dan `ACADEMIC_YEAR_SYNC.sql` (keduanya sudah dihapus)
- Aman dijalankan berulang kali (idempotent)
