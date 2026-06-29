-- Migration: Table Security Monitoring RPC
-- Create function to retrieve all public tables and their RLS status

CREATE OR REPLACE FUNCTION public.get_public_tables_security()
RETURNS TABLE (table_name text, rls_enabled boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    c.relname::text AS table_name,
    c.relrowsecurity AS rls_enabled
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname NOT IN (
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
  ORDER BY c.relname;
$$;

-- Grant execute permissions to roles
GRANT EXECUTE ON FUNCTION public.get_public_tables_security() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_public_tables_security() TO authenticated;
