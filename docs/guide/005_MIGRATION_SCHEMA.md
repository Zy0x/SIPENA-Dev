# SIPENA — Migration Schema (Database Utama)

## Deskripsi

File `docs/sql/005_MIGRATION_SCHEMA.sql` adalah **schema dasar** SIPENA yang mencakup seluruh tabel inti aplikasi. Jalankan file ini **pertama kali** saat setup project baru di Supabase SQL Editor.

## Tabel yang Dibuat

| Tabel | Fungsi |
|---|---|
| `academic_years` | Tahun ajaran per user |
| `semesters` | Semester per tahun ajaran |
| `classes` | Kelas (misal: X-IPA 1) |
| `students` | Data siswa per kelas |
| `subjects` | Mata pelajaran per user |
| `chapters` | BAB/Materi per mata pelajaran |
| `assignments` | Tugas/Ujian per BAB |
| `grades` | Nilai siswa per tugas |
| `notifications` | Notifikasi sistem |
| `shared_links` | Link akses tamu |
| `user_preferences` | Preferensi pengguna (tema, dll) |
| `profiles` | Profil pengguna (nama, avatar) |
| `account_deletion_requests` | Permintaan hapus akun |

## Urutan Eksekusi

```
1. docs/sql/005_MIGRATION_SCHEMA.sql          ← Jalankan pertama
2. docs/sql/012_ACADEMIC_YEAR_COMPREHENSIVE.sql
3. docs/sql/010_SEMESTER_COMPREHENSIVE.sql
4. docs/sql/001_ATTENDANCE_V2_MIGRATION.sql
5. docs/sql/002_ACTIVITY_LOGS_SETUP.sql
6. docs/sql/007_PWA_PUSH_NOTIFICATION_SETUP.sql
```

## Catatan

- Semua script bersifat **idempotent** (aman dijalankan berulang)
- RLS (Row Level Security) diaktifkan pada semua tabel
- Foreign key menggunakan `ON DELETE CASCADE`
