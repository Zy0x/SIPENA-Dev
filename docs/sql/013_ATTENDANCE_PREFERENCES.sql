-- ============================================
-- 013: Attendance Preferences (Jumlah Config)
-- ============================================
-- Tabel untuk menyimpan preferensi perhitungan kolom Jumlah
-- pada rekap bulanan presensi per user.
-- 
-- CATATAN: Fitur ini saat ini menggunakan localStorage sebagai fallback.
-- Jika ingin persistensi ke database, jalankan SQL ini di Supabase SQL Editor.

-- 1. Buat tabel
CREATE TABLE IF NOT EXISTS public.attendance_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preference_key TEXT NOT NULL,
    preference_value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, preference_key)
);

-- 2. Aktifkan RLS
ALTER TABLE public.attendance_preferences ENABLE ROW LEVEL SECURITY;

-- 3. Policy: User hanya bisa akses data sendiri
CREATE POLICY "Users can manage own preferences"
ON public.attendance_preferences
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_attendance_preferences_user 
ON public.attendance_preferences(user_id);

-- 5. Trigger update timestamp
CREATE OR REPLACE FUNCTION update_attendance_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_attendance_preferences_updated_at
    BEFORE UPDATE ON public.attendance_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_preferences_updated_at();
