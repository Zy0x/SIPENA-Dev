-- Auth login lockout reset requests.
-- Public users submit requests through the auth-lockout-reset Edge Function.
-- Admins review requests through the same function using ADMIN_DB_PASSWORD.

CREATE TABLE IF NOT EXISTS public.auth_lockout_reset_settings (
  id text PRIMARY KEY DEFAULT 'global' CHECK (id = 'global'),
  auto_approve_enabled boolean NOT NULL DEFAULT true,
  auto_approve_hours integer NOT NULL DEFAULT 24 CHECK (auto_approve_hours > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.auth_lockout_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  normalized_email text NOT NULL,
  reason text NOT NULL CHECK (char_length(trim(reason)) >= 12),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  lockout_level integer NOT NULL CHECK (lockout_level >= 6),
  failure_count integer NOT NULL CHECK (failure_count >= 18),
  locked_until timestamptz NULL,
  auto_approve_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  admin_response text NULL,
  processed_at timestamptz NULL,
  processed_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_lockout_reset_requests_status_created_idx
  ON public.auth_lockout_reset_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_lockout_reset_requests_email_status_idx
  ON public.auth_lockout_reset_requests (normalized_email, status);

CREATE INDEX IF NOT EXISTS auth_lockout_reset_requests_auto_approve_idx
  ON public.auth_lockout_reset_requests (auto_approve_at)
  WHERE status = 'pending';

ALTER TABLE public.auth_lockout_reset_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_lockout_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_lockout_reset_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_lockout_reset_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_lockout_reset_settings_edge_function_only
  ON public.auth_lockout_reset_settings;
DROP POLICY IF EXISTS auth_lockout_reset_requests_edge_function_only
  ON public.auth_lockout_reset_requests;

CREATE POLICY auth_lockout_reset_settings_edge_function_only
ON public.auth_lockout_reset_settings
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY auth_lockout_reset_requests_edge_function_only
ON public.auth_lockout_reset_requests
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

REVOKE ALL ON TABLE public.auth_lockout_reset_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.auth_lockout_reset_requests FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.auth_lockout_reset_settings TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.auth_lockout_reset_requests TO service_role;

INSERT INTO public.auth_lockout_reset_settings (id, auto_approve_enabled, auto_approve_hours)
VALUES ('global', true, 24)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_auth_lockout_reset_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_auth_lockout_reset_requests_updated_at
  ON public.auth_lockout_reset_requests;

CREATE TRIGGER set_auth_lockout_reset_requests_updated_at
  BEFORE UPDATE ON public.auth_lockout_reset_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_auth_lockout_reset_updated_at();

DROP TRIGGER IF EXISTS set_auth_lockout_reset_settings_updated_at
  ON public.auth_lockout_reset_settings;

CREATE TRIGGER set_auth_lockout_reset_settings_updated_at
  BEFORE UPDATE ON public.auth_lockout_reset_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_auth_lockout_reset_updated_at();
