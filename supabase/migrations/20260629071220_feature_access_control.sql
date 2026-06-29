CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  feature_type text NOT NULL CHECK (feature_type IN ('page', 'feature', 'runtime')),
  default_enabled boolean NOT NULL DEFAULT false,
  global_kill_switch boolean NOT NULL DEFAULT true,
  risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feature_audiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL REFERENCES public.feature_flags(feature_key) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('all_users', 'role', 'user')),
  target_value text,
  enabled boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feature_audience_target_value_check CHECK (
    (target_type = 'all_users' AND target_value IS NULL)
    OR (target_type IN ('role', 'user') AND target_value IS NOT NULL AND length(trim(target_value)) > 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_feature_audiences_unique_target
ON public.feature_audiences(feature_key, target_type, COALESCE(target_value, '__all__'));

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'teacher', 'tester', 'beta_user')),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.feature_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text REFERENCES public.feature_flags(feature_key) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_audiences_feature_key ON public.feature_audiences(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_audiences_role ON public.feature_audiences(target_value) WHERE target_type = 'role';
CREATE INDEX IF NOT EXISTS idx_feature_audiences_user ON public.feature_audiences(target_value) WHERE target_type = 'user';
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_feature_audit_logs_feature_key_created ON public.feature_audit_logs(feature_key, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_feature_access_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER set_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.set_feature_access_updated_at();

DROP TRIGGER IF EXISTS set_feature_audiences_updated_at ON public.feature_audiences;
CREATE TRIGGER set_feature_audiences_updated_at
BEFORE UPDATE ON public.feature_audiences
FOR EACH ROW EXECUTE FUNCTION public.set_feature_access_updated_at();

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_audiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read feature catalog" ON public.feature_flags;
CREATE POLICY "Authenticated users can read feature catalog"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Users can read their own app roles" ON public.user_roles;
CREATE POLICY "Users can read their own app roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

REVOKE ALL ON public.feature_flags FROM anon;
REVOKE ALL ON public.feature_audiences FROM anon;
REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.feature_audit_logs FROM anon;

GRANT SELECT ON public.feature_flags TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

INSERT INTO public.feature_flags (feature_key, name, description, feature_type, default_enabled, global_kill_switch, risk_level, metadata)
VALUES
  ('page.dashboard', 'Dashboard', 'Halaman ringkasan utama.', 'page', true, true, 'low', '{"route":"/dashboard"}'),
  ('page.classes', 'Kelas & Murid', 'Halaman pengelolaan kelas dan murid.', 'page', true, true, 'medium', '{"route":"/classes"}'),
  ('page.subjects', 'Mata Pelajaran', 'Halaman pengelolaan mata pelajaran dan KKM.', 'page', true, true, 'medium', '{"route":"/subjects"}'),
  ('page.grades', 'Input Nilai', 'Halaman input nilai dan spreadsheet nilai.', 'page', true, true, 'high', '{"route":"/grades"}'),
  ('page.attendance', 'Presensi', 'Halaman presensi utama. V1 tetap menjadi fallback.', 'page', true, true, 'high', '{"route":"/attendance"}'),
  ('page.reports', 'Laporan', 'Halaman induk laporan.', 'page', true, true, 'medium', '{"route":"/reports"}'),
  ('page.reports.grades', 'Laporan Nilai', 'Halaman laporan nilai.', 'page', true, true, 'high', '{"route":"/reports/grades"}'),
  ('page.reports.rankings', 'Ranking Murid', 'Halaman ranking keseluruhan.', 'page', true, true, 'high', '{"route":"/reports/rankings"}'),
  ('page.reports.portal', 'Portal Orang Tua', 'Halaman konfigurasi portal orang tua.', 'page', true, true, 'medium', '{"route":"/reports/portal"}'),
  ('page.settings', 'Pengaturan', 'Halaman pengaturan akun dan aplikasi.', 'page', true, true, 'medium', '{"route":"/settings"}'),
  ('page.help', 'Panduan', 'Halaman panduan penggunaan SIPENA.', 'page', true, true, 'low', '{"route":"/help"}'),
  ('page.about', 'Tentang', 'Halaman informasi aplikasi.', 'page', true, true, 'low', '{"route":"/about"}'),
  ('feature.morphe', 'Morphe AI', 'Fitur asisten AI Morphe.', 'feature', true, true, 'medium', '{"route":"/morphe"}'),
  ('attendance.v2.runtime', 'Presensi V2 Runtime', 'Mengaktifkan engine Presensi V2 untuk akun terpilih. Jika mati, V1 tetap digunakan.', 'runtime', false, true, 'critical', '{"engine":"v2","fallback":"v1"}')
ON CONFLICT (feature_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  feature_type = EXCLUDED.feature_type,
  risk_level = EXCLUDED.risk_level,
  metadata = public.feature_flags.metadata || EXCLUDED.metadata,
  updated_at = now();
