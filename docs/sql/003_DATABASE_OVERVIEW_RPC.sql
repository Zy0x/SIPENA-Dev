-- ============================================================
-- RPC Function: get_all_public_tables
-- Digunakan oleh admin-database Edge Function untuk menemukan
-- semua tabel public secara dinamis (menghindari hardcode).
-- Jalankan SQL ini di Supabase SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_all_public_tables()
RETURNS TABLE (table_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.tablename::text AS table_name
  FROM pg_catalog.pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename NOT IN (
      'schema_migrations',
      'supabase_migrations',
      'buckets',
      'objects',
      's3_multipart_uploads',
      's3_multipart_uploads_parts',
      'hooks',
      'http_request_queue',
      'secrets',
      'key',
      'migrations'
    )
  ORDER BY t.tablename;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_all_public_tables() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_all_public_tables() TO authenticated;
