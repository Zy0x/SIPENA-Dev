-- Force RLS for attendance core tables so migrated attendance data cannot bypass
-- owner-scoped policies through accidental table-owner access paths.

ALTER TABLE public.attendance_core_schools FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_academic_calendars FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_class_contexts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_calendar_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_records FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_locks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_audit_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_recap_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_delegations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_month_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_core_migration_runs FORCE ROW LEVEL SECURITY;
