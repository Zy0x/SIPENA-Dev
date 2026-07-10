-- Persist guest-teacher shortcuts for authenticated SIPENA users.
-- Grants are only shortcuts to active shared links; they never revive revoked
-- or expired links and do not grant direct access to owner tables.

CREATE TABLE IF NOT EXISTS public.guest_access_grants (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_user_id uuid REFERENCES public.guest_users(id) ON DELETE SET NULL,
  shared_link_id uuid NOT NULL REFERENCES public.shared_links(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guest_access_grants_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text])),
  CONSTRAINT guest_access_grants_no_self_owner CHECK (guest_auth_user_id <> owner_user_id),
  CONSTRAINT guest_access_grants_unique_link UNIQUE (guest_auth_user_id, shared_link_id)
);

CREATE INDEX IF NOT EXISTS idx_guest_access_grants_guest_auth_user
  ON public.guest_access_grants (guest_auth_user_id, status);

CREATE INDEX IF NOT EXISTS idx_guest_access_grants_shared_link
  ON public.guest_access_grants (shared_link_id);

CREATE INDEX IF NOT EXISTS idx_guest_access_grants_owner_class
  ON public.guest_access_grants (owner_user_id, class_id);

DROP TRIGGER IF EXISTS update_guest_access_grants_updated_at ON public.guest_access_grants;
CREATE TRIGGER update_guest_access_grants_updated_at
  BEFORE UPDATE ON public.guest_access_grants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.guest_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own guest access grants" ON public.guest_access_grants;
CREATE POLICY "Users can view their own guest access grants"
  ON public.guest_access_grants
  FOR SELECT
  USING (auth.uid() = guest_auth_user_id);

DROP POLICY IF EXISTS "Owners can view guest access grants for their links" ON public.guest_access_grants;
CREATE POLICY "Owners can view guest access grants for their links"
  ON public.guest_access_grants
  FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE OR REPLACE FUNCTION public.accept_guest_access(
  p_token text,
  p_guest_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_link public.shared_links%ROWTYPE;
  v_grant public.guest_access_grants%ROWTYPE;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'guest_access_auth_required';
  END IF;

  v_link := public.require_valid_shared_link(p_token);

  IF v_link.user_id = v_auth_user_id THEN
    RETURN jsonb_build_object(
      'created', false,
      'skipped', true,
      'reason', 'owner_self_access',
      'sharedLinkId', v_link.id
    );
  END IF;

  INSERT INTO public.guest_access_grants (
    guest_auth_user_id,
    guest_user_id,
    shared_link_id,
    owner_user_id,
    class_id,
    subject_id,
    status,
    accepted_at,
    last_used_at
  )
  VALUES (
    v_auth_user_id,
    p_guest_user_id,
    v_link.id,
    v_link.user_id,
    v_link.class_id,
    v_link.subject_id,
    'active',
    now(),
    now()
  )
  ON CONFLICT (guest_auth_user_id, shared_link_id)
  DO UPDATE SET
    guest_user_id = COALESCE(EXCLUDED.guest_user_id, public.guest_access_grants.guest_user_id),
    owner_user_id = EXCLUDED.owner_user_id,
    class_id = EXCLUDED.class_id,
    subject_id = EXCLUDED.subject_id,
    status = 'active',
    last_used_at = now(),
    updated_at = now()
  RETURNING * INTO v_grant;

  RETURN jsonb_build_object(
    'created', true,
    'grantId', v_grant.id,
    'sharedLinkId', v_link.id,
    'classId', v_link.class_id,
    'subjectId', v_link.subject_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_guest_access(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_guest_access(text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_guest_accesses()
RETURNS TABLE (
  grant_id uuid,
  shared_link_id uuid,
  token text,
  owner_user_id uuid,
  owner_email text,
  owner_name text,
  class_id uuid,
  class_name text,
  class_description text,
  class_kkm integer,
  class_academic_year_id uuid,
  class_semester_id uuid,
  subject_id uuid,
  subject_name text,
  subject_kkm integer,
  subject_is_custom boolean,
  subject_academic_year_id uuid,
  student_count bigint,
  accepted_at timestamptz,
  last_used_at timestamptz,
  expired_at timestamptz,
  revoked boolean,
  grant_status text,
  is_active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    gag.id AS grant_id,
    sl.id AS shared_link_id,
    sl.token,
    sl.user_id AS owner_user_id,
    au.email::text AS owner_email,
    COALESCE(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      au.email
    )::text AS owner_name,
    c.id AS class_id,
    c.name AS class_name,
    c.description AS class_description,
    c.class_kkm,
    c.academic_year_id AS class_academic_year_id,
    c.semester_id AS class_semester_id,
    s.id AS subject_id,
    s.name AS subject_name,
    s.kkm AS subject_kkm,
    s.is_custom AS subject_is_custom,
    s.academic_year_id AS subject_academic_year_id,
    COALESCE(sc.student_count, 0) AS student_count,
    gag.accepted_at,
    COALESCE(gag.last_used_at, sl.last_used_at) AS last_used_at,
    sl.expired_at,
    sl.revoked,
    gag.status AS grant_status,
    (gag.status = 'active' AND sl.revoked = false AND sl.expired_at > now()) AS is_active
  FROM public.guest_access_grants gag
  JOIN public.shared_links sl ON sl.id = gag.shared_link_id
  JOIN public.classes c ON c.id = sl.class_id AND c.user_id = sl.user_id
  JOIN public.subjects s ON s.id = sl.subject_id AND s.class_id = sl.class_id AND s.user_id = sl.user_id
  LEFT JOIN auth.users au ON au.id = sl.user_id
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS student_count
    FROM public.students st
    WHERE st.class_id = sl.class_id
      AND st.user_id = sl.user_id
  ) sc ON true
  WHERE gag.guest_auth_user_id = auth.uid()
  ORDER BY is_active DESC, COALESCE(gag.last_used_at, gag.accepted_at) DESC, c.name ASC, s.name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_my_guest_accesses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_guest_accesses() TO authenticated;

CREATE OR REPLACE FUNCTION public.touch_guest_access(p_shared_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id uuid := auth.uid();
  v_link public.shared_links%ROWTYPE;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'guest_access_auth_required';
  END IF;

  SELECT *
    INTO v_link
    FROM public.shared_links
   WHERE id = p_shared_link_id
     AND revoked = false
     AND expired_at > now()
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_guest_token';
  END IF;

  UPDATE public.guest_access_grants
     SET last_used_at = now(),
         updated_at = now()
   WHERE guest_auth_user_id = v_auth_user_id
     AND shared_link_id = p_shared_link_id
     AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_access_not_found';
  END IF;

  UPDATE public.shared_links
     SET last_used_at = now()
   WHERE id = p_shared_link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_guest_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_guest_access(uuid) TO authenticated;
