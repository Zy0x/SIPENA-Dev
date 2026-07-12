-- New attendance months are fail-safe: without an explicit unlock they remain read-only.
-- Existing rows, including explicit is_locked = false choices, are intentionally preserved.

ALTER TABLE IF EXISTS public.attendance_locks
  ALTER COLUMN is_locked SET DEFAULT true;

ALTER TABLE IF EXISTS public.attendance_v2_locks
  ALTER COLUMN is_locked SET DEFAULT true;

ALTER TABLE IF EXISTS public.attendance_core_locks
  ALTER COLUMN is_locked SET DEFAULT true;

NOTIFY pgrst, 'reload schema';
