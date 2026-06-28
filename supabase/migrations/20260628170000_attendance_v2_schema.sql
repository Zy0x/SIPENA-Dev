-- =====================================================
-- SIPENA Attendance V2 Production Database Schema
-- Migration: 20260628170000_attendance_v2_schema.sql
-- =====================================================

-- 1. Create attendance_v2_records table
CREATE TABLE IF NOT EXISTS public.attendance_v2_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('H', 'I', 'S', 'A', 'D', 'L', '-')),
  note TEXT DEFAULT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'ocr', 'sync', 'shadow')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id, class_id, student_id, date)
);

-- 2. Create attendance_v2_holidays table
CREATE TABLE IF NOT EXISTS public.attendance_v2_holidays (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  is_national BOOLEAN DEFAULT false,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 3. Create attendance_v2_day_events table
CREATE TABLE IF NOT EXISTS public.attendance_v2_day_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id UUID DEFAULT NULL,
  date DATE NOT NULL,
  label TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  color TEXT DEFAULT 'blue',
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 4. Create attendance_v2_locks table
CREATE TABLE IF NOT EXISTS public.attendance_v2_locks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'), -- YYYY-MM
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ DEFAULT NULL,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT DEFAULT NULL,
  UNIQUE(class_id, month)
);

-- 5. Create attendance_v2_overrides table
CREATE TABLE IF NOT EXISTS public.attendance_v2_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  school_id UUID DEFAULT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create attendance_v2_audit_logs table
CREATE TABLE IF NOT EXISTS public.attendance_v2_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  record_id UUID DEFAULT NULL,
  action TEXT NOT NULL,
  before_data JSONB DEFAULT '{}'::jsonb,
  after_data JSONB DEFAULT '{}'::jsonb,
  reason_code TEXT DEFAULT NULL,
  applied_rule_ids JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL DEFAULT 'owner' CHECK (actor_type IN ('owner', 'admin', 'system', 'guest')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create attendance_v2_idempotency_keys table
CREATE TABLE IF NOT EXISTS public.attendance_v2_idempotency_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  operation TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(user_id, key)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_att_v2_rec_class_date ON public.attendance_v2_records(class_id, date);
CREATE INDEX IF NOT EXISTS idx_att_v2_rec_user_class ON public.attendance_v2_records(user_id, class_id);
CREATE INDEX IF NOT EXISTS idx_att_v2_rec_student_date ON public.attendance_v2_records(student_id, date);
CREATE INDEX IF NOT EXISTS idx_att_v2_locks_class_month ON public.attendance_v2_locks(class_id, month);
CREATE INDEX IF NOT EXISTS idx_att_v2_locks_user_class ON public.attendance_v2_locks(user_id, class_id);
CREATE INDEX IF NOT EXISTS idx_att_v2_audit_class_created ON public.attendance_v2_audit_logs(class_id, created_at);
CREATE INDEX IF NOT EXISTS idx_att_v2_idemp_key_expires ON public.attendance_v2_idempotency_keys(expires_at);

-- =====================================================
-- Enable Row Level Security (RLS)
-- =====================================================
ALTER TABLE public.attendance_v2_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_day_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_v2_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS Policies
-- =====================================================
CREATE POLICY "Users can manage own V2 records" ON public.attendance_v2_records
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own V2 holidays" ON public.attendance_v2_holidays
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own V2 day events" ON public.attendance_v2_day_events
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own V2 locks" ON public.attendance_v2_locks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own V2 overrides" ON public.attendance_v2_overrides
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own V2 audit logs" ON public.attendance_v2_audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own V2 audit logs" ON public.attendance_v2_audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own V2 idempotency keys" ON public.attendance_v2_idempotency_keys
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- Helper Functions / Stored Procedures
-- =====================================================

-- Function to check if a class period is locked
CREATE OR REPLACE FUNCTION public.check_attendance_locked(p_class_id UUID, p_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
  v_month TEXT;
  v_is_locked BOOLEAN;
BEGIN
  v_month := to_char(p_date, 'YYYY-MM');
  SELECT is_locked INTO v_is_locked
  FROM public.attendance_v2_locks
  WHERE class_id = p_class_id AND month = v_month;
  
  RETURN COALESCE(v_is_locked, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to insert an audit log entry
CREATE OR REPLACE FUNCTION public.insert_attendance_audit_log(
  p_user_id UUID,
  p_class_id UUID,
  p_student_id UUID,
  p_record_id UUID,
  p_action TEXT,
  p_before_data JSONB,
  p_after_data JSONB,
  p_reason_code TEXT,
  p_applied_rule_ids JSONB,
  p_metadata JSONB,
  p_actor_id UUID,
  p_actor_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.attendance_v2_audit_logs (
    user_id, class_id, student_id, record_id, action,
    before_data, after_data, reason_code, applied_rule_ids,
    metadata, actor_id, actor_type
  ) VALUES (
    p_user_id, p_class_id, p_student_id, p_record_id, p_action,
    p_before_data, p_after_data, p_reason_code, p_applied_rule_ids,
    p_metadata, p_actor_id, p_actor_type
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Stored Procedure to Upsert a single V2 attendance record with locking guard
CREATE OR REPLACE FUNCTION public.upsert_attendance_record(
  p_user_id UUID,
  p_class_id UUID,
  p_student_id UUID,
  p_date DATE,
  p_status TEXT,
  p_note TEXT,
  p_source TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_before_data JSONB := '{}'::jsonb;
  v_after_data JSONB := '{}'::jsonb;
  v_record_id UUID;
  v_existing_id UUID;
  v_existing_status TEXT;
  v_existing_note TEXT;
BEGIN
  -- 1. Check lock status
  v_is_locked := public.check_attendance_locked(p_class_id, p_date);
  IF v_is_locked THEN
    RETURN json_build_object('success', false, 'error_code', 'ATTENDANCE_LOCKED_PERIOD', 'message', 'Writes are blocked because the period is locked.');
  END IF;

  -- 2. Fetch existing data
  SELECT id, status, note INTO v_existing_id, v_existing_status, v_existing_note
  FROM public.attendance_v2_records
  WHERE user_id = p_user_id AND class_id = p_class_id AND student_id = p_student_id AND date = p_date;

  IF v_existing_id IS NOT NULL THEN
    v_before_data := json_build_object('status', v_existing_status, 'note', v_existing_note);
  END IF;

  -- 3. Perform Insert or Update
  IF p_status IS NULL OR p_status = '-' THEN
    -- Delete record if status is null or placeholder
    IF v_existing_id IS NOT NULL THEN
      DELETE FROM public.attendance_v2_records WHERE id = v_existing_id;
      
      -- Audit Delete
      PERFORM public.insert_attendance_audit_log(
        p_user_id, p_class_id, p_student_id, v_existing_id, 'DELETE',
        v_before_data, '{}'::jsonb, 'MANUAL_DELETION', '[]'::jsonb,
        json_build_object('source', p_source)::jsonb, p_user_id, 'owner'
      );
    END IF;
    RETURN json_build_object('success', true, 'action', 'DELETE');
  ELSE
    -- Upsert
    INSERT INTO public.attendance_v2_records (
      user_id, class_id, student_id, date, status, note, source, created_by, updated_by
    ) VALUES (
      p_user_id, p_class_id, p_student_id, p_date, p_status, p_note, p_source, p_user_id, p_user_id
    ) ON CONFLICT (user_id, class_id, student_id, date) DO UPDATE SET
      status = EXCLUDED.status,
      note = EXCLUDED.note,
      source = EXCLUDED.source,
      updated_by = EXCLUDED.user_id,
      updated_at = now()
    RETURNING id, status, note INTO v_record_id, v_existing_status, v_existing_note;

    v_after_data := json_build_object('status', v_existing_status, 'note', v_existing_note);

    -- Audit Save
    PERFORM public.insert_attendance_audit_log(
      p_user_id, p_class_id, p_student_id, v_record_id, 
      CASE WHEN v_existing_id IS NOT NULL THEN 'UPDATE' ELSE 'CREATE' END,
      v_before_data, v_after_data, 'MANUAL_STATUS_ASSIGNMENT', '[]'::jsonb,
      json_build_object('source', p_source)::jsonb, p_user_id, 'owner'
    );

    RETURN json_build_object('success', true, 'action', CASE WHEN v_existing_id IS NOT NULL THEN 'UPDATE' ELSE 'CREATE' END, 'record_id', v_record_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
