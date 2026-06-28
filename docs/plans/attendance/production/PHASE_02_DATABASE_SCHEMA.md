# PHASE 02: Database Schema & Migration Plan - Attendance V2

Dokumen ini menjelaskan rancangan skema database produksi untuk **Attendance V2** di Supabase/PostgreSQL, termasuk kebijakan keamanan (RLS), strategi indeks, perintah migrasi, rencana rollback, serta alur pemindahan data (data migration plan) dari V1 ke V2.

---

## 1. Spesifikasi Tabel Database V2

Seluruh tabel berada dalam skema `public` dan terisolasi sepenuhnya dari tabel V1 untuk menjamin tidak terjadinya kerusakan pada proses produksi existing.

### 1. `attendance_v2_records`
Menyimpan baris kehadiran siswa harian dengan dukungan Dispensasi (`'D'`) dan catatan.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `user_id` (UUID, Foreign Key ke `auth.users.id`, ON DELETE CASCADE)
- `class_id` (UUID, Foreign Key ke `public.classes.id`, ON DELETE CASCADE)
- `student_id` (UUID, Foreign Key ke `public.students.id`, ON DELETE CASCADE)
- `date` (DATE)
- `status` (TEXT, check constraint: `status IN ('H', 'I', 'S', 'A', 'D', 'L', '-')`)
- `note` (TEXT, default: NULL)
- `source` (TEXT, check constraint: `source IN ('manual', 'import', 'ocr', 'sync', 'shadow')`)
- `created_by` (UUID, Foreign Key ke `auth.users.id`, ON DELETE SET NULL)
- `updated_by` (UUID, Foreign Key ke `auth.users.id`, ON DELETE SET NULL)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)
- `deleted_at` (TIMESTAMPTZ, default: NULL)
- **Constraint Unik**: `UNIQUE(user_id, class_id, student_id, date)`

### 2. `attendance_v2_holidays`
Menyimpan daftar libur khusus per user.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key ke `auth.users.id`, ON DELETE CASCADE)
- `date` (DATE)
- `description` (TEXT)
- `is_national` (BOOLEAN, default: false)
- `source` (TEXT, default: 'manual')
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)
- **Constraint Unik**: `UNIQUE(user_id, date)`

### 3. `attendance_v2_day_events`
Menyimpan label hari kegiatan sekolah khusus (misalnya UTS, Classmeeting).
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key ke `auth.users.id`, ON DELETE CASCADE)
- `class_id` (UUID, Foreign Key ke `public.classes.id` (nullable), ON DELETE CASCADE)
- `school_id` (UUID, nullable)
- `date` (DATE)
- `label` (TEXT)
- `description` (TEXT)
- `color` (TEXT, default: 'blue')
- `priority` (INTEGER, default: 0)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)
- **Constraint Unik**: `UNIQUE(user_id, date)`

### 4. `attendance_v2_locks`
Mengunci periode edit data presensi bulanan per kelas.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key ke `auth.users.id`, ON DELETE CASCADE)
- `class_id` (UUID, Foreign Key ke `public.classes.id`, ON DELETE CASCADE)
- `month` (TEXT, format YYYY-MM)
- `is_locked` (BOOLEAN, default: false)
- `locked_at` (TIMESTAMPTZ, default: NULL)
- `locked_by` (UUID, Foreign Key ke `auth.users.id`, ON DELETE SET NULL)
- `reason` (TEXT, default: NULL)
- **Constraint Unik**: `UNIQUE(class_id, month)`

### 5. `attendance_v2_overrides`
Pengecualian kalender (misalnya hari masuk pengganti di hari Sabtu).
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key ke `auth.users.id`, ON DELETE CASCADE)
- `class_id` (UUID, Foreign Key ke `public.classes.id` (nullable), ON DELETE CASCADE)
- `school_id` (UUID, nullable)
- `date` (DATE)
- `type` (TEXT)
- `description` (TEXT)
- `priority` (INTEGER, default: 0)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)

### 6. `attendance_v2_audit_logs`
Log riwayat mutasi presensi V2 untuk keamanan audit.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key ke `auth.users.id`, ON DELETE CASCADE)
- `class_id` (UUID, Foreign Key ke `public.classes.id`, ON DELETE CASCADE)
- `student_id` (UUID, Foreign Key ke `public.students.id` (nullable), ON DELETE SET NULL)
- `record_id` (UUID, nullable)
- `action` (TEXT)
- `before_data` (JSONB)
- `after_data` (JSONB)
- `reason_code` (TEXT)
- `applied_rule_ids` (JSONB)
- `metadata` (JSONB)
- `actor_id` (UUID, Foreign Key ke `auth.users.id`, ON DELETE SET NULL)
- `actor_type` (TEXT, check: `actor_type IN ('owner', 'admin', 'system', 'guest')`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)

### 7. `attendance_v2_idempotency_keys`
Mencegah eksekusi ganda pada mutasi API backend akibat retry jaringan.
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key ke `auth.users.id`, ON DELETE CASCADE)
- `key` (TEXT)
- `operation` (TEXT)
- `request_hash` (TEXT)
- `response_hash` (TEXT)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `expires_at` (TIMESTAMPTZ)
- **Constraint Unik**: `UNIQUE(user_id, key)`

---

## 2. Strategi Pengindeksan (Indexing)

Indeks dibuat pada kolom-kolom filter utama untuk memastikan kecepatan query saat pemuatan tabel presensi bulanan sekolah:

```sql
CREATE INDEX idx_att_v2_rec_class_date ON public.attendance_v2_records(class_id, date);
CREATE INDEX idx_att_v2_rec_user_class ON public.attendance_v2_records(user_id, class_id);
CREATE INDEX idx_att_v2_rec_student_date ON public.attendance_v2_records(student_id, date);
CREATE INDEX idx_att_v2_locks_class_month ON public.attendance_v2_locks(class_id, month);
CREATE INDEX idx_att_v2_locks_user_class ON public.attendance_v2_locks(user_id, class_id);
CREATE INDEX idx_att_v2_audit_class_created ON public.attendance_v2_audit_logs(class_id, created_at);
CREATE INDEX idx_att_v2_idemp_key_expires ON public.attendance_v2_idempotency_keys(expires_at);
```

---

## 3. Kebijakan Keamanan Row Level Security (RLS)

Seluruh tabel diwajibkan mengaktifkan RLS agar pengguna/guru hanya dapat mengakses data sekolah mereka sendiri.

- **Polis SELECT/INSERT/UPDATE/DELETE**:
  ```sql
  ALTER TABLE public.attendance_v2_records ENABLE ROW LEVEL SECURITY;
  
  CREATE POLICY "Users can manage own V2 records" ON public.attendance_v2_records
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```
  *(Berlaku seragam untuk seluruh tabel V2 dengan validasi `auth.uid() = user_id`)*

---

## 4. Eksekusi Perintah Migrasi (Migration Command)

### Menjalankan Migrasi Melalui Supabase CLI
```bash
# Hubungkan ke proyek Supabase Anda
supabase login

# Jalankan migrasi lokal ke database target
supabase db push
```

### Menjalankan Migrasi Melalui Supabase SQL Editor
1. Salin seluruh konten dari berkas migrasi:
   `supabase/migrations/20260628170000_attendance_v2_schema.sql`
2. Tempelkan ke panel **Supabase SQL Editor** Anda.
3. Klik tombol **Run**.

---

## 5. Rencana Rollback Database (Rollback Plan)

Jika terjadi kendala kritis pasca-migrasi, jalankan skrip SQL berikut untuk menghapus skema V2 tanpa memengaruhi data V1:

```sql
-- Hapus Helper Functions
DROP FUNCTION IF EXISTS public.upsert_attendance_record(UUID, UUID, UUID, DATE, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.insert_attendance_audit_log(UUID, UUID, UUID, UUID, TEXT, JSONB, JSONB, TEXT, JSONB, JSONB, UUID, TEXT);
DROP FUNCTION IF EXISTS public.check_attendance_locked(UUID, DATE);

-- Hapus Tabel V2 (Cascade otomatis menghapus index, trigger, dan RLS terkait)
DROP TABLE IF EXISTS public.attendance_v2_idempotency_keys CASCADE;
DROP TABLE IF EXISTS public.attendance_v2_audit_logs CASCADE;
DROP TABLE IF EXISTS public.attendance_v2_overrides CASCADE;
DROP TABLE IF EXISTS public.attendance_v2_locks CASCADE;
DROP TABLE IF EXISTS public.attendance_v2_day_events CASCADE;
DROP TABLE IF EXISTS public.attendance_v2_holidays CASCADE;
DROP TABLE IF EXISTS public.attendance_v2_records CASCADE;
```

---

## 6. Rencana Migrasi Data (V1 ke V2 Data Migration Plan)

Berikut adalah konsep skrip SQL dry-run untuk menyalin data historis dari tabel V1 ke tabel V2 secara aman:

```sql
-- SKRIP DRY-RUN: MENGHITUNG DATA YANG AKAN DIPINDAHKAN
DO $$
DECLARE
  v_rec_count INTEGER;
  v_hol_count INTEGER;
  v_lock_count INTEGER;
  v_event_count INTEGER;
BEGIN
  SELECT count(*) INTO v_rec_count FROM public.attendance_records;
  SELECT count(*) INTO v_hol_count FROM public.attendance_holidays;
  SELECT count(*) INTO v_lock_count FROM public.attendance_locks;
  SELECT count(*) INTO v_event_count FROM public.attendance_day_events;

  RAISE NOTICE '=== DRY-RUN MIGRATION SUMMARY ===';
  RAISE NOTICE 'Records to migrate: %', v_rec_count;
  RAISE NOTICE 'Holidays to migrate: %', v_hol_count;
  RAISE NOTICE 'Locks to migrate: %', v_lock_count;
  RAISE NOTICE 'Day events to migrate: %', v_event_count;
END;
$$;

-- SKRIP EKSEKUSI RIIL MIGRASI DATA
-- 1. Migrasi Holidays
INSERT INTO public.attendance_v2_holidays (id, user_id, date, description, is_national, source)
SELECT id, user_id, date, description, COALESCE(is_national, false), 'migrated_v1'
FROM public.attendance_holidays
ON CONFLICT (user_id, date) DO NOTHING;

-- 2. Migrasi Day Events
INSERT INTO public.attendance_v2_day_events (id, user_id, date, label, description, color)
SELECT id, user_id, date, label, description, COALESCE(color, 'blue')
FROM public.attendance_day_events
ON CONFLICT (user_id, date) DO NOTHING;

-- 3. Migrasi Locks
INSERT INTO public.attendance_v2_locks (user_id, class_id, month, is_locked, locked_at, locked_by)
SELECT COALESCE(user_id, locked_by), class_id, month, is_locked, locked_at, locked_by
FROM public.attendance_locks
ON CONFLICT (class_id, month) DO NOTHING;

-- 4. Migrasi Records
INSERT INTO public.attendance_v2_records (id, user_id, class_id, student_id, date, status, note, source, created_by, updated_by, created_at, updated_at)
SELECT 
  id, 
  COALESCE(created_by, updated_by), 
  class_id, 
  student_id, 
  date, 
  status, 
  note, 
  'sync_v1', 
  created_by, 
  updated_by, 
  created_at, 
  updated_at
FROM public.attendance_records
ON CONFLICT (user_id, class_id, student_id, date) DO NOTHING;
```
