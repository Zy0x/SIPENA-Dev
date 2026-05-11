-- Optional audit trail tables for grade import sessions.
-- This migration is non-destructive and does not change the import RPC.

CREATE TABLE IF NOT EXISTS public.grade_import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  class_id uuid NULL REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id uuid NULL REFERENCES public.subjects(id) ON DELETE SET NULL,
  academic_year_id uuid NULL REFERENCES public.academic_years(id) ON DELETE SET NULL,
  semester_id uuid NULL REFERENCES public.semesters(id) ON DELETE SET NULL,
  source_type text NULL,
  file_name text NULL,
  total_operations integer NOT NULL DEFAULT 0 CHECK (total_operations >= 0),
  saved_count integer NOT NULL DEFAULT 0 CHECK (saved_count >= 0),
  skipped_count integer NOT NULL DEFAULT 0 CHECK (skipped_count >= 0),
  blocked_count integer NOT NULL DEFAULT 0 CHECK (blocked_count >= 0),
  warning_count integer NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grade_import_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.grade_import_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  student_id uuid NULL REFERENCES public.students(id) ON DELETE SET NULL,
  subject_id uuid NULL REFERENCES public.subjects(id) ON DELETE SET NULL,
  assignment_id uuid NULL REFERENCES public.assignments(id) ON DELETE SET NULL,
  grade_type text NULL CHECK (grade_type IS NULL OR grade_type IN ('assignment', 'sts', 'sas')),
  old_value numeric NULL CHECK (old_value IS NULL OR (old_value >= 0 AND old_value <= 100)),
  new_value numeric NULL CHECK (new_value IS NULL OR (new_value >= 0 AND new_value <= 100)),
  action text NULL,
  status text NULL,
  row_index integer NULL,
  column_index integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grade_import_sessions_user_created_idx
  ON public.grade_import_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS grade_import_sessions_subject_created_idx
  ON public.grade_import_sessions (subject_id, created_at DESC);

CREATE INDEX IF NOT EXISTS grade_import_session_items_session_idx
  ON public.grade_import_session_items (session_id);

CREATE INDEX IF NOT EXISTS grade_import_session_items_user_created_idx
  ON public.grade_import_session_items (user_id, created_at DESC);

ALTER TABLE public.grade_import_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_import_session_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'grade_import_sessions'
       AND policyname = 'grade_import_sessions_select_own'
  ) THEN
    CREATE POLICY grade_import_sessions_select_own
      ON public.grade_import_sessions
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'grade_import_sessions'
       AND policyname = 'grade_import_sessions_insert_own'
  ) THEN
    CREATE POLICY grade_import_sessions_insert_own
      ON public.grade_import_sessions
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'grade_import_session_items'
       AND policyname = 'grade_import_session_items_select_own'
  ) THEN
    CREATE POLICY grade_import_session_items_select_own
      ON public.grade_import_session_items
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'grade_import_session_items'
       AND policyname = 'grade_import_session_items_insert_own'
  ) THEN
    CREATE POLICY grade_import_session_items_insert_own
      ON public.grade_import_session_items
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
            FROM public.grade_import_sessions s
           WHERE s.id = session_id
             AND s.user_id = auth.uid()
        )
      );
  END IF;
END;
$$;
