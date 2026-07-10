-- =====================================================
-- SIPENA Attendance Core Stable Schema + Legacy Migration
-- Additive only. Legacy V1 and experimental V2 tables are not modified.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.attendance_core_migration_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'legacy_v1',
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS public.attendance_core_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('H', 'I', 'S', 'A', 'D', 'L', '-')),
  note TEXT DEFAULT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  version INTEGER NOT NULL DEFAULT 1,
  student_name_snapshot TEXT DEFAULT NULL,
  class_name_snapshot TEXT DEFAULT NULL,
  legacy_record_id UUID DEFAULT NULL,
  legacy_table TEXT DEFAULT NULL,
  migration_source TEXT DEFAULT NULL,
  migration_run_id UUID REFERENCES public.attendance_core_migration_runs(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id, class_id, student_id, date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_att_core_records_legacy
  ON public.attendance_core_records(legacy_table, legacy_record_id)
  WHERE legacy_record_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_core_schools (
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

CREATE TABLE IF NOT EXISTS public.attendance_core_academic_calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.attendance_core_schools(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.attendance_core_class_contexts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.attendance_core_schools(id) ON DELETE SET NULL,
  calendar_id UUID REFERENCES public.attendance_core_academic_calendars(id) ON DELETE SET NULL,
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

CREATE TABLE IF NOT EXISTS public.attendance_core_calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_id UUID REFERENCES public.attendance_core_academic_calendars(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.attendance_core_schools(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL DEFAULT 'user' CHECK (scope_type IN ('national', 'school', 'class', 'user')),
  event_type TEXT NOT NULL DEFAULT 'info' CHECK (event_type IN ('holiday', 'activity', 'closure', 'effective_override', 'exam', 'info')),
  title TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  recurrence_rule JSONB DEFAULT NULL,
  recurrence_exceptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  effect_on_attendance TEXT NOT NULL DEFAULT 'info_only' CHECK (effect_on_attendance IN ('non_effective', 'effective', 'info_only', 'force_present', 'blocked_write')),
  source TEXT NOT NULL DEFAULT 'manual',
  color TEXT NOT NULL DEFAULT 'blue',
  legacy_record_id UUID DEFAULT NULL,
  legacy_table TEXT DEFAULT NULL,
  migration_source TEXT DEFAULT NULL,
  migration_run_id UUID REFERENCES public.attendance_core_migration_runs(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  CHECK (start_date <= end_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_att_core_events_legacy
  ON public.attendance_core_calendar_events(legacy_table, legacy_record_id)
  WHERE legacy_record_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_core_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}(-\d{2})?$'),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ DEFAULT NULL,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT DEFAULT NULL,
  legacy_record_id UUID DEFAULT NULL,
  legacy_table TEXT DEFAULT NULL,
  migration_source TEXT DEFAULT NULL,
  migration_run_id UUID REFERENCES public.attendance_core_migration_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, month)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_att_core_locks_legacy
  ON public.attendance_core_locks(legacy_table, legacy_record_id)
  WHERE legacy_record_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.attendance_core_recap_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.attendance_core_schools(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS public.attendance_core_delegations (
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

CREATE TABLE IF NOT EXISTS public.attendance_core_month_snapshots (
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

CREATE TABLE IF NOT EXISTS public.attendance_core_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  record_id UUID DEFAULT NULL,
  action TEXT NOT NULL,
  before_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason_code TEXT DEFAULT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role TEXT DEFAULT NULL,
  delegated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT DEFAULT NULL,
  client_timezone TEXT DEFAULT NULL,
  request_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_core_records_class_date ON public.attendance_core_records(class_id, date);
CREATE INDEX IF NOT EXISTS idx_att_core_records_user_class ON public.attendance_core_records(user_id, class_id);
CREATE INDEX IF NOT EXISTS idx_att_core_records_student_date ON public.attendance_core_records(student_id, date);
CREATE INDEX IF NOT EXISTS idx_att_core_events_range ON public.attendance_core_calendar_events(user_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_att_core_events_class_range ON public.attendance_core_calendar_events(class_id, start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_att_core_locks_class_month ON public.attendance_core_locks(class_id, month);
CREATE INDEX IF NOT EXISTS idx_att_core_audit_user_created ON public.attendance_core_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_att_core_snapshots_class_month ON public.attendance_core_month_snapshots(class_id, month, created_at DESC);

ALTER TABLE public.attendance_core_migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_academic_calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_class_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_recap_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_month_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own attendance core migration runs" ON public.attendance_core_migration_runs
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core records" ON public.attendance_core_records
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core schools" ON public.attendance_core_schools
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core calendars" ON public.attendance_core_academic_calendars
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core contexts" ON public.attendance_core_class_contexts
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core events" ON public.attendance_core_calendar_events
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core locks" ON public.attendance_core_locks
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core recap profiles" ON public.attendance_core_recap_profiles
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core delegations" ON public.attendance_core_delegations
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can manage own attendance core snapshots" ON public.attendance_core_month_snapshots
  FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can view own attendance core audit logs" ON public.attendance_core_audit_logs
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own attendance core audit logs" ON public.attendance_core_audit_logs
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_migration_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_schools TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_academic_calendars TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_class_contexts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_locks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_recap_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_delegations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_core_month_snapshots TO authenticated;
GRANT SELECT, INSERT ON public.attendance_core_audit_logs TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_attendance_core_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_att_core_records_touch ON public.attendance_core_records;
CREATE TRIGGER trg_att_core_records_touch
BEFORE UPDATE ON public.attendance_core_records
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_core_updated_at();

DROP TRIGGER IF EXISTS trg_att_core_schools_touch ON public.attendance_core_schools;
CREATE TRIGGER trg_att_core_schools_touch
BEFORE UPDATE ON public.attendance_core_schools
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_core_updated_at();

DROP TRIGGER IF EXISTS trg_att_core_calendars_touch ON public.attendance_core_academic_calendars;
CREATE TRIGGER trg_att_core_calendars_touch
BEFORE UPDATE ON public.attendance_core_academic_calendars
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_core_updated_at();

DROP TRIGGER IF EXISTS trg_att_core_contexts_touch ON public.attendance_core_class_contexts;
CREATE TRIGGER trg_att_core_contexts_touch
BEFORE UPDATE ON public.attendance_core_class_contexts
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_core_updated_at();

DROP TRIGGER IF EXISTS trg_att_core_events_touch ON public.attendance_core_calendar_events;
CREATE TRIGGER trg_att_core_events_touch
BEFORE UPDATE ON public.attendance_core_calendar_events
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_core_updated_at();

DROP TRIGGER IF EXISTS trg_att_core_locks_touch ON public.attendance_core_locks;
CREATE TRIGGER trg_att_core_locks_touch
BEFORE UPDATE ON public.attendance_core_locks
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_core_updated_at();

DROP TRIGGER IF EXISTS trg_att_core_recap_touch ON public.attendance_core_recap_profiles;
CREATE TRIGGER trg_att_core_recap_touch
BEFORE UPDATE ON public.attendance_core_recap_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_attendance_core_updated_at();

CREATE OR REPLACE FUNCTION public.migrate_legacy_attendance_to_core()
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_run_id UUID;
  v_legacy_records INTEGER := 0;
  v_records_inserted INTEGER := 0;
  v_legacy_holidays INTEGER := 0;
  v_holidays_inserted INTEGER := 0;
  v_legacy_day_events INTEGER := 0;
  v_day_events_inserted INTEGER := 0;
  v_legacy_locks INTEGER := 0;
  v_locks_inserted INTEGER := 0;
  v_report JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  INSERT INTO public.attendance_core_migration_runs(user_id, source)
  VALUES (v_user_id, 'legacy_v1')
  RETURNING id INTO v_run_id;

  SELECT COUNT(*) INTO v_legacy_records
  FROM public.attendance_records
  WHERE class_id IN (SELECT id FROM public.classes WHERE user_id = v_user_id);

  INSERT INTO public.attendance_core_records (
    user_id, class_id, student_id, date, status, note, source,
    legacy_record_id, legacy_table, migration_source, migration_run_id,
    created_by, updated_by
  )
  SELECT
    v_user_id,
    legacy.class_id,
    legacy.student_id,
    legacy.date,
    legacy.status,
    legacy.note,
    'legacy_migration',
    legacy.id,
    'attendance_records',
    'legacy_v1',
    v_run_id,
    v_user_id,
    v_user_id
  FROM public.attendance_records legacy
  WHERE legacy.class_id IN (SELECT id FROM public.classes WHERE user_id = v_user_id)
    AND legacy.status IN ('H', 'I', 'S', 'A', 'D', 'L', '-')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_records_inserted = ROW_COUNT;

  SELECT COUNT(*) INTO v_legacy_holidays
  FROM public.attendance_holidays
  WHERE user_id = v_user_id;

  INSERT INTO public.attendance_core_calendar_events (
    user_id, scope_type, event_type, title, description,
    start_date, end_date, priority, effect_on_attendance, source, color,
    legacy_record_id, legacy_table, migration_source, migration_run_id,
    created_by, updated_by
  )
  SELECT
    v_user_id,
    'user',
    'holiday',
    COALESCE(NULLIF(legacy.description, ''), 'Hari Libur'),
    legacy.description,
    legacy.date,
    legacy.date,
    30,
    'non_effective',
    'legacy_migration',
    'amber',
    legacy.id,
    'attendance_holidays',
    'legacy_v1',
    v_run_id,
    v_user_id,
    v_user_id
  FROM public.attendance_holidays legacy
  WHERE legacy.user_id = v_user_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_holidays_inserted = ROW_COUNT;

  SELECT COUNT(*) INTO v_legacy_day_events
  FROM public.attendance_day_events
  WHERE user_id = v_user_id;

  INSERT INTO public.attendance_core_calendar_events (
    user_id, scope_type, event_type, title, description,
    start_date, end_date, priority, effect_on_attendance, source, color,
    legacy_record_id, legacy_table, migration_source, migration_run_id,
    created_by, updated_by
  )
  SELECT
    v_user_id,
    'user',
    'activity',
    COALESCE(NULLIF(legacy.label, ''), 'Kegiatan Khusus'),
    legacy.description,
    legacy.date,
    legacy.date,
    10,
    'info_only',
    'legacy_migration',
    COALESCE(legacy.color, 'blue'),
    legacy.id,
    'attendance_day_events',
    'legacy_v1',
    v_run_id,
    v_user_id,
    v_user_id
  FROM public.attendance_day_events legacy
  WHERE legacy.user_id = v_user_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_day_events_inserted = ROW_COUNT;

  SELECT COUNT(*) INTO v_legacy_locks
  FROM public.attendance_locks
  WHERE user_id = v_user_id;

  INSERT INTO public.attendance_core_locks (
    user_id, class_id, month, is_locked, locked_at, locked_by, reason,
    legacy_record_id, legacy_table, migration_source, migration_run_id,
    created_at, updated_at
  )
  SELECT
    v_user_id,
    legacy.class_id,
    legacy.month,
    COALESCE(legacy.is_locked, false),
    legacy.locked_at,
    legacy.locked_by,
    legacy.reason,
    legacy.id,
    'attendance_locks',
    'legacy_v1',
    v_run_id,
    COALESCE(legacy.locked_at, now()),
    now()
  FROM public.attendance_locks legacy
  WHERE legacy.user_id = v_user_id
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_locks_inserted = ROW_COUNT;

  v_report := jsonb_build_object(
    'migrationRunId', v_run_id,
    'source', 'legacy_v1',
    'legacy', jsonb_build_object(
      'records', v_legacy_records,
      'holidays', v_legacy_holidays,
      'dayEvents', v_legacy_day_events,
      'locks', v_legacy_locks
    ),
    'inserted', jsonb_build_object(
      'records', v_records_inserted,
      'holidays', v_holidays_inserted,
      'dayEvents', v_day_events_inserted,
      'locks', v_locks_inserted
    ),
    'skipped', jsonb_build_object(
      'records', GREATEST(v_legacy_records - v_records_inserted, 0),
      'holidays', GREATEST(v_legacy_holidays - v_holidays_inserted, 0),
      'dayEvents', GREATEST(v_legacy_day_events - v_day_events_inserted, 0),
      'locks', GREATEST(v_legacy_locks - v_locks_inserted, 0)
    )
  );

  UPDATE public.attendance_core_migration_runs
  SET status = 'completed', report = v_report, completed_at = now()
  WHERE id = v_run_id;

  RETURN v_report;
EXCEPTION
  WHEN OTHERS THEN
    IF v_run_id IS NOT NULL THEN
      UPDATE public.attendance_core_migration_runs
      SET status = 'failed',
          report = jsonb_build_object('error', SQLERRM),
          completed_at = now()
      WHERE id = v_run_id;
    END IF;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

GRANT EXECUTE ON FUNCTION public.migrate_legacy_attendance_to_core() TO authenticated;

NOTIFY pgrst, 'reload schema';
