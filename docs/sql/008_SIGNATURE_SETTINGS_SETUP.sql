-- ============================================
-- SIGNATURE SETTINGS — Database Schema
-- ============================================
-- Jalankan SQL ini di Supabase SQL Editor
-- ============================================

-- Tabel untuk menyimpan pengaturan tanda tangan ekspor per user
CREATE TABLE IF NOT EXISTS public.signature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  city TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT 'Guru Mata Pelajaran',
  nip TEXT DEFAULT '',
  school_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signature_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own signature settings
CREATE POLICY "Users manage own signature"
  ON public.signature_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_signature_settings_user ON public.signature_settings(user_id);
