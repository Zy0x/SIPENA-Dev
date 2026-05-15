-- ============================================
-- PWA Push Notification & Activity Log Setup
-- SIPENA v2.3.41
-- ============================================
-- Jalankan SQL ini di Supabase SQL Editor

-- 1. Tabel push_subscriptions untuk menyimpan endpoint push notification
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- 2. Tabel activity_logs (jika belum ada dari AUDIT_TRAIL_SETUP.sql)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own logs" ON public.activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logs" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Index untuk performa query
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_created 
  ON public.activity_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity 
  ON public.activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user 
  ON public.push_subscriptions(user_id);

-- 4. Tabel audit_trail_diffs untuk mencatat perubahan detail
CREATE TABLE IF NOT EXISTS public.audit_trail_diffs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_log_id UUID REFERENCES public.activity_logs(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_trail_diffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own diffs" ON public.audit_trail_diffs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activity_logs 
      WHERE id = audit_trail_diffs.activity_log_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own diffs" ON public.audit_trail_diffs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activity_logs 
      WHERE id = audit_trail_diffs.activity_log_id 
      AND user_id = auth.uid()
    )
  );

-- 5. Function untuk auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verifikasi
SELECT 'Setup selesai!' AS status;
