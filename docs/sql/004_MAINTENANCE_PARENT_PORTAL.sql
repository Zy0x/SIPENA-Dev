-- ============================================
-- MAINTENANCE ALERTS TABLE
-- ============================================
-- Tabel untuk menyimpan alert/reminder maintenance
-- yang akan ditampilkan secara live ke semua pengguna

-- 1. Buat tabel maintenance_alerts
CREATE TABLE IF NOT EXISTS public.maintenance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Pemberitahuan',
  message TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'info' CHECK (alert_type IN ('info', 'warning', 'critical', 'maintenance')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_marquee BOOLEAN NOT NULL DEFAULT false,
  display_mode TEXT NOT NULL DEFAULT 'flat' CHECK (display_mode IN ('flat', 'flyout')),
  bg_color TEXT DEFAULT '#3b82f6',
  text_color TEXT DEFAULT '#ffffff',
  icon TEXT DEFAULT 'info',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.maintenance_alerts ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Everyone can read active alerts
DROP POLICY IF EXISTS "Anyone can read active alerts" ON public.maintenance_alerts;
CREATE POLICY "Anyone can read active alerts"
ON public.maintenance_alerts
FOR SELECT
USING (is_active = true);

-- 4. Policy: Service role can manage (via Edge Functions)
-- No INSERT/UPDATE/DELETE policy for anon — admin uses service role key

-- 5. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_alerts;

-- 6. Jika tabel sudah ada, tambahkan kolom display_mode
ALTER TABLE public.maintenance_alerts ADD COLUMN IF NOT EXISTS display_mode TEXT NOT NULL DEFAULT 'flat' CHECK (display_mode IN ('flat', 'flyout'));

-- ============================================
-- PARENT PORTAL TABLES
-- ============================================

-- 1. Portal share configurations
CREATE TABLE IF NOT EXISTS public.parent_portal_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  class_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Laporan Siswa',
  description TEXT,
  
  -- Visibility settings (what to show)
  show_grades BOOLEAN DEFAULT true,
  show_attendance BOOLEAN DEFAULT true,
  show_rankings BOOLEAN DEFAULT true,
  show_assignments BOOLEAN DEFAULT true,
  show_predictions BOOLEAN DEFAULT false,
  
  -- Filter settings
  subject_ids UUID[] DEFAULT '{}',
  semester_filter TEXT,
  attendance_period TEXT DEFAULT 'all',
  
  -- Share settings
  share_code TEXT UNIQUE NOT NULL,
  share_url TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.parent_portal_configs ENABLE ROW LEVEL SECURITY;

-- 3. Policies (drop existing then recreate)
DROP POLICY IF EXISTS "Users can manage own portal configs" ON public.parent_portal_configs;
DROP POLICY IF EXISTS "Anyone can read active portal configs by share code" ON public.parent_portal_configs;

-- Policy: Authenticated users can CRUD their own portal configs
CREATE POLICY "Users can manage own portal configs"
ON public.parent_portal_configs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Anyone (including anonymous) can read active portal configs
CREATE POLICY "Anyone can read active portal configs"
ON public.parent_portal_configs
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 4. Function to generate short share code
CREATE OR REPLACE FUNCTION generate_share_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;
