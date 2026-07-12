-- Server-owned admin events cover email, OAuth, authenticated guest teachers,
-- and quick guest access without exposing the event stream to normal users.

CREATE TABLE IF NOT EXISTS public.admin_event_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  source_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  provider text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_event_notifications_unread
  ON public.admin_event_notifications(read, created_at DESC);

ALTER TABLE public.admin_event_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_event_notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_event_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_event_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.enqueue_admin_event(
  p_event_key text,
  p_event_type text,
  p_title text,
  p_message text,
  p_source_user_id uuid DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.admin_event_notifications (
    event_key, event_type, title, message, source_user_id, provider, metadata
  ) VALUES (
    left(p_event_key, 220), left(p_event_type, 80), left(p_title, 160),
    left(p_message, 800), p_source_user_id, left(p_provider, 80),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (event_key) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_admin_event(text, text, text, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_admin_event(text, text, text, text, uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_admin_auth_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider text := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');
  v_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1), 'Pengguna');
BEGIN
  PERFORM public.enqueue_admin_event(
    'auth-registration:' || NEW.id::text,
    'new_user_registration',
    'Akun SIPENA Baru',
    v_name || ' mendaftar melalui ' || upper(v_provider) || '.',
    NEW.id,
    v_provider,
    jsonb_build_object('email', NEW.email, 'registered_at', NEW.created_at)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_auth_registration ON auth.users;
CREATE TRIGGER notify_admin_on_auth_registration
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_auth_registration();

CREATE OR REPLACE FUNCTION public.notify_admin_guest_grant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.enqueue_admin_event(
    'guest-grant:' || NEW.id::text,
    'guest_teacher_access',
    'Akses Guru Tamu Baru',
    'Seorang guru menerima akses tamu ke kelas yang dibagikan.',
    NEW.guest_auth_user_id,
    'authenticated_guest',
    jsonb_build_object('class_id', NEW.class_id, 'subject_id', NEW.subject_id, 'accepted_at', NEW.accepted_at)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_guest_grant ON public.guest_access_grants;
CREATE TRIGGER notify_admin_on_guest_grant
AFTER INSERT ON public.guest_access_grants
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_guest_grant();

CREATE OR REPLACE FUNCTION public.notify_admin_quick_guest()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.enqueue_admin_event(
    'quick-guest:' || NEW.id::text,
    'quick_guest_registration',
    'Akses Cepat Guru Tamu',
    NEW.name || ' menggunakan akses cepat tanpa akun.',
    NULL,
    'quick_guest',
    jsonb_build_object('guest_user_id', NEW.id, 'email', NEW.email, 'registered_at', NEW.created_at)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_on_quick_guest ON public.guest_users;
CREATE TRIGGER notify_admin_on_quick_guest
AFTER INSERT ON public.guest_users
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_quick_guest();

NOTIFY pgrst, 'reload schema';
