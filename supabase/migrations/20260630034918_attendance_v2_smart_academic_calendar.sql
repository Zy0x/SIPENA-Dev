-- =====================================================
-- SIPENA Attendance V2 Smart Academic Calendar
-- Additive only. V1 tables and data are not modified.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.attendance_v2_schools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Makassar',
  region_code TEXT DEFAULT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_v2_academic_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.attendance_v2_schools(id) ON DELETE CASCADE,
  academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Makassar',
  work_day_format TEXT NOT NULL DEFAULT '6days' CHECK (work_day_format IN ('5days', '6days')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (starts_on <= ends_on)
);

CREATE TABLE IF NOT EXISTS public.attendance_v2_class_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.attendance_v2_schools(id) ON DELETE SET NULL,
  calendar_id UUID REFERENCES public.attendance_v2_academic_calendars(id) ON DELETE SET NULL,
  timezone_override TEXT DEFAULT NULL,
  work_day_format TEXT NOT NULL DEFAULT '6days' CHECK (work_day_format IN ('5days', '6days')),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE DEFAULT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_from <= effective_to)
);

CREATE TABLE IF NOT EXISTS public.attendance_v2_calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES public.attendance_v2_academic_calendars(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.attendance_v2_schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'user' CHECK (scope_type IN ('national', 'school', 'class', 'user')),
  event_type TEXT NOT NULL DEFAULT 'info' CHECK (event_type IN ('holiday', 'activity', 'closure', 'effective_override', 'exam', 'info')),
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT true,
  start_time TIME DEFAULT NULL,
  end_time TIME DEFAULT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Makassar',
  recurrence_rule JSONB DEFAULT NULL,
  recurrence_exceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  effect_on_attendance TEXT NOT NULL DEFAULT 'info_only' CHECK (effect_on_attendance IN ('non_effective', 'effective', 'info_only', 'force_present', 'blocked_write')),
  source TEXT NOT NULL DEFAULT 'manual',
  color TEXT NOT NULL DEFAULT 'blue',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CHECK (start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS public.attendance_v2_recap_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.attendance_v2_schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  counted_statuses TEXT[] NOT NULL DEFAULT ARRAY['H','S','I','A','D'],
  present_statuses TEXT[] NOT NULL DEFAULT ARRAY['H','D'],
  absence_statuses TEXT[] NOT NULL DEFAULT ARRAY['S','I','A'],
  denominator_policy TEXT NOT NULL DEFAULT 'effective_days' CHECK (denominator_policy IN ('effective_days', 'filled_days', 'custom')),
  display_order TEXT[] NOT NULL DEFAULT ARRAY['H','S','I','A','D'],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attendance_v2_delegations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  grantee_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  grantee_label TEXT DEFAULT NULL,
  actor_role TEXT NOT NULL DEFAULT 'substitute' CHECK (actor_role IN ('owner', 'teacher', 'substitute', 'guest', 'admin')),
  permissions TEXT[] NOT NULL DEFAULT ARRAY['read','write'],
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ DEFAULT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (starts_at < ends_at)
);

CREATE TABLE IF NOT EXISTS public.attendance_v2_month_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  snapshot_json JSONB NOT NULL,
  calendar_version JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT DEFAULT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_v2_records
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS student_name_snapshot TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS class_name_snapshot TEXT DEFAULT NULL;

ALTER TABLE public.attendance_v2_audit_logs
  ADD COLUMN IF NOT EXISTS actor_role TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS delegated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS session_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS client_timezone TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS request_id TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_att_v2_schools_user ON public.attendance_v2_schools(user_id);
CREATE INDEX IF NOT EXISTS idx_att_v2_calendars_user_school ON public.attendance_v2_academic_calendars(user_id, school_id);
CREATE INDEX IF NOT EXISTS idx_att_v2_class_context_class_range ON public.attendance_v2_class_contexts(class_id, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_att_v2_events_range ON public.attendance_v2_calendar_events(user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_att_v2_events_class_range ON public.attendance_v2_calendar_events(class_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_att_v2_events_school_range ON public.attendance_v2_calendar_events(school_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_att_v2_recap_user_class ON public.attendance_v2_recap_profiles(user_id, class_id);
CREATE INDEX IF NOT EXISTS idx_att_v2_delegations_class_time ON public.attendance_v2_delegations(class_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_att_v2_snapshots_class_month ON public.attendance_v2_month_snapshots(class_id, month, created_at DESC);

ALTER TABLE public.attendance_v2_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_academic_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_class_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_recap_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_month_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own attendance V2 schools" ON public.attendance_v2_schools;
CREATE POLICY "Users can manage own attendance V2 schools" ON public.attendance_v2_schools
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own attendance V2 academic calendars" ON public.attendance_v2_academic_calendars;
CREATE POLICY "Users can manage own attendance V2 academic calendars" ON public.attendance_v2_academic_calendars
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own attendance V2 class contexts" ON public.attendance_v2_class_contexts;
CREATE POLICY "Users can manage own attendance V2 class contexts" ON public.attendance_v2_class_contexts
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own attendance V2 calendar events" ON public.attendance_v2_calendar_events;
CREATE POLICY "Users can manage own attendance V2 calendar events" ON public.attendance_v2_calendar_events
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own attendance V2 recap profiles" ON public.attendance_v2_recap_profiles;
CREATE POLICY "Users can manage own attendance V2 recap profiles" ON public.attendance_v2_recap_profiles
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own attendance V2 delegations" ON public.attendance_v2_delegations;
CREATE POLICY "Users can manage own attendance V2 delegations" ON public.attendance_v2_delegations
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can manage own attendance V2 month snapshots" ON public.attendance_v2_month_snapshots;
CREATE POLICY "Users can manage own attendance V2 month snapshots" ON public.attendance_v2_month_snapshots
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_v2_schools TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_v2_academic_calendars TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_v2_class_contexts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_v2_calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_v2_recap_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_v2_delegations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_v2_month_snapshots TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_attendance_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_att_v2_schools_touch ON public.attendance_v2_schools;
CREATE TRIGGER trg_att_v2_schools_touch
BEFORE UPDATE ON public.attendance_v2_schools
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_v2_updated_at();

DROP TRIGGER IF EXISTS trg_att_v2_calendars_touch ON public.attendance_v2_academic_calendars;
CREATE TRIGGER trg_att_v2_calendars_touch
BEFORE UPDATE ON public.attendance_v2_academic_calendars
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_v2_updated_at();

DROP TRIGGER IF EXISTS trg_att_v2_contexts_touch ON public.attendance_v2_class_contexts;
CREATE TRIGGER trg_att_v2_contexts_touch
BEFORE UPDATE ON public.attendance_v2_class_contexts
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_v2_updated_at();

DROP TRIGGER IF EXISTS trg_att_v2_events_touch ON public.attendance_v2_calendar_events;
CREATE TRIGGER trg_att_v2_events_touch
BEFORE UPDATE ON public.attendance_v2_calendar_events
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_v2_updated_at();

DROP TRIGGER IF EXISTS trg_att_v2_recap_touch ON public.attendance_v2_recap_profiles;
CREATE TRIGGER trg_att_v2_recap_touch
BEFORE UPDATE ON public.attendance_v2_recap_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_v2_updated_at();

NOTIFY pgrst, 'reload schema';
