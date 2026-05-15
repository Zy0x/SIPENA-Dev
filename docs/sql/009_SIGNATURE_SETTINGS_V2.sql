-- ============================================
-- SIGNATURE SETTINGS V2 (Multi Signer + Date + Font)
-- Jalankan di Supabase SQL Editor (eksternal)
-- ============================================

ALTER TABLE public.signature_settings
  ADD COLUMN IF NOT EXISTS signers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS use_custom_date BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_date DATE,
  ADD COLUMN IF NOT EXISTS font_size INTEGER NOT NULL DEFAULT 10;

-- Migrasi data lama (single signer) ke format array signers
UPDATE public.signature_settings
SET signers = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', COALESCE(name, ''),
    'title', COALESCE(title, 'Guru Mata Pelajaran'),
    'nip', COALESCE(nip, ''),
    'school_name', COALESCE(school_name, ''),
    'order_index', 0
  )
)
WHERE (signers = '[]'::jsonb OR signers IS NULL);

CREATE INDEX IF NOT EXISTS idx_signature_settings_user_v2
  ON public.signature_settings(user_id);
