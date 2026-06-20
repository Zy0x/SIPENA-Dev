-- The initial production migration resolves pgcrypto functions through the
-- extensions schema. Keep the already-deployed RPC compatible without
-- broadening privileges or changing its SECURITY INVOKER behavior.
ALTER FUNCTION public.import_subjects_from_class(uuid, uuid, uuid[], uuid, uuid, boolean)
  SET search_path = public, extensions;

COMMENT ON FUNCTION public.import_subjects_from_class(uuid, uuid, uuid[], uuid, uuid, boolean)
IS 'Atomically copies selected subjects and optional semester structure between classes owned by the authenticated user. Never copies grades or link history.';

NOTIFY pgrst, 'reload schema';
