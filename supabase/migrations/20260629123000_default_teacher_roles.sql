BEGIN;

DELETE FROM public.feature_audiences
WHERE target_type = 'role'
  AND target_value = 'tester';

DELETE FROM public.user_roles
WHERE role = 'tester';

INSERT INTO public.user_roles (user_id, role, metadata)
SELECT
  users.id,
  'teacher',
  jsonb_build_object('source', 'default-teacher-backfill')
FROM auth.users AS users
ON CONFLICT (user_id, role) DO NOTHING;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint AS con
    WHERE con.conrelid = 'public.user_roles'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%tester%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_role_check
CHECK (role IN ('admin', 'teacher', 'beta_user'));

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint AS con
    WHERE con.conrelid = 'public.feature_audiences'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%target_type%'
      AND pg_get_constraintdef(con.oid) LIKE '%role%'
      AND pg_get_constraintdef(con.oid) LIKE '%tester%'
  LOOP
    EXECUTE format('ALTER TABLE public.feature_audiences DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.feature_audiences
DROP CONSTRAINT IF EXISTS feature_audience_role_target_check;

ALTER TABLE public.feature_audiences
ADD CONSTRAINT feature_audience_role_target_check
CHECK (
  target_type <> 'role'
  OR target_value IN ('admin', 'teacher', 'beta_user')
);

CREATE OR REPLACE FUNCTION public.assign_default_teacher_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, metadata)
  VALUES (
    NEW.id,
    'teacher',
    jsonb_build_object('source', 'auth-user-default')
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_default_teacher_role_on_auth_user ON auth.users;
CREATE TRIGGER assign_default_teacher_role_on_auth_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_teacher_role();

NOTIFY pgrst, 'reload schema';

COMMIT;
