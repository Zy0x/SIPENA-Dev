-- Fix legacy-to-core attendance migration for the real V1 lock schema.
-- Legacy attendance_locks.month is a date and has no reason column.

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
    to_char(legacy.month, 'YYYY-MM'),
    COALESCE(legacy.is_locked, false),
    legacy.locked_at,
    legacy.locked_by,
    NULL::text,
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

