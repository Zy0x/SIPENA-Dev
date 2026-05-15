-- ============================================================================
-- TEAM PROFILES TABLE + STORAGE SETUP
-- Tabel untuk menyimpan data Tim Pengembang yang ditampilkan di halaman Tentang
-- ============================================================================

-- 1. Buat tabel team_profiles
CREATE TABLE IF NOT EXISTS public.team_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  social_links JSONB DEFAULT '{}'::jsonb,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.team_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Hapus policy lama jika ada
DROP POLICY IF EXISTS "Anyone can read team_profiles" ON public.team_profiles;
DROP POLICY IF EXISTS "Authenticated users can insert team_profiles" ON public.team_profiles;
DROP POLICY IF EXISTS "Authenticated users can update team_profiles" ON public.team_profiles;
DROP POLICY IF EXISTS "Authenticated users can delete team_profiles" ON public.team_profiles;
DROP POLICY IF EXISTS "Anyone can insert team_profiles" ON public.team_profiles;
DROP POLICY IF EXISTS "Anyone can update team_profiles" ON public.team_profiles;
DROP POLICY IF EXISTS "Anyone can delete team_profiles" ON public.team_profiles;

-- 4. Policy: semua orang bisa membaca (untuk halaman Tentang)
CREATE POLICY "Anyone can read team_profiles"
  ON public.team_profiles FOR SELECT USING (true);

-- 5. Policy: semua orang bisa insert/update/delete
--    (Admin panel menggunakan autentikasi terpisah via edge function)
CREATE POLICY "Anyone can insert team_profiles"
  ON public.team_profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update team_profiles"
  ON public.team_profiles FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete team_profiles"
  ON public.team_profiles FOR DELETE USING (true);

-- 6. Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_team_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_team_profiles_updated_at ON public.team_profiles;
CREATE TRIGGER update_team_profiles_updated_at
  BEFORE UPDATE ON public.team_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_profiles_updated_at();

-- 7. Index untuk sorting
CREATE INDEX IF NOT EXISTS idx_team_profiles_order ON public.team_profiles(order_index ASC);
CREATE INDEX IF NOT EXISTS idx_team_profiles_active ON public.team_profiles(is_active);

-- ============================================================================
-- STORAGE: Bucket untuk foto profil tim
-- ============================================================================

-- 8. Buat bucket team-avatars (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-avatars', 'team-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage policies
DROP POLICY IF EXISTS "Anyone can view team avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload team avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update team avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete team avatars" ON storage.objects;

CREATE POLICY "Anyone can view team avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-avatars');

CREATE POLICY "Anyone can upload team avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'team-avatars');

CREATE POLICY "Anyone can update team avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'team-avatars')
  WITH CHECK (bucket_id = 'team-avatars');

CREATE POLICY "Anyone can delete team avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'team-avatars');
