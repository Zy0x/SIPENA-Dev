-- Repair duplicate grade rows before enforcing the owner-scoped unique key.
--
-- Existing duplicates are not discarded silently. Every removed row is copied to
-- grade_duplicate_resolution_audit with the kept row, key, values, timestamps,
-- and conflict flag so a manual recovery remains possible.

CREATE TABLE IF NOT EXISTS public.grade_duplicate_resolution_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  kept_grade_id uuid NOT NULL,
  removed_grade_id uuid NOT NULL,
  user_id uuid NOT NULL,
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  assignment_id uuid NULL,
  academic_year_id uuid NULL,
  semester_id uuid NULL,
  grade_type text NOT NULL CHECK (grade_type IN ('assignment', 'sts', 'sas')),
  kept_value numeric NULL CHECK (kept_value IS NULL OR (kept_value >= 0 AND kept_value <= 100)),
  removed_value numeric NULL CHECK (removed_value IS NULL OR (removed_value >= 0 AND removed_value <= 100)),
  kept_created_at timestamptz NULL,
  kept_updated_at timestamptz NULL,
  removed_created_at timestamptz NULL,
  removed_updated_at timestamptz NULL,
  had_value_conflict boolean NOT NULL DEFAULT false,
  resolution_strategy text NOT NULL DEFAULT 'keep_latest_non_null_value'
);

CREATE INDEX IF NOT EXISTS grade_duplicate_resolution_audit_user_resolved_idx
  ON public.grade_duplicate_resolution_audit (user_id, resolved_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS grade_duplicate_resolution_audit_removed_grade_idx
  ON public.grade_duplicate_resolution_audit (removed_grade_id);

ALTER TABLE public.grade_duplicate_resolution_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'grade_duplicate_resolution_audit'
       AND policyname = 'grade_duplicate_resolution_audit_select_own'
  ) THEN
    CREATE POLICY grade_duplicate_resolution_audit_select_own
      ON public.grade_duplicate_resolution_audit
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

WITH duplicate_stats AS (
  SELECT
    user_id,
    student_id,
    subject_id,
    grade_type,
    assignment_id,
    semester_id,
    academic_year_id,
    count(DISTINCT value) FILTER (WHERE value IS NOT NULL) AS distinct_non_null_values
  FROM public.grades
  GROUP BY
    user_id,
    student_id,
    subject_id,
    grade_type,
    assignment_id,
    semester_id,
    academic_year_id
  HAVING COUNT(*) > 1
),
ranked_duplicates AS (
  SELECT
    g.*,
    row_number() OVER (
      PARTITION BY
        g.user_id,
        g.student_id,
        g.subject_id,
        g.grade_type,
        g.assignment_id,
        g.semester_id,
        g.academic_year_id
      ORDER BY
        (g.value IS NOT NULL) DESC,
        g.updated_at DESC NULLS LAST,
        g.created_at DESC NULLS LAST,
        g.id DESC
    ) AS duplicate_rank,
    first_value(g.id) OVER (
      PARTITION BY
        g.user_id,
        g.student_id,
        g.subject_id,
        g.grade_type,
        g.assignment_id,
        g.semester_id,
        g.academic_year_id
      ORDER BY
        (g.value IS NOT NULL) DESC,
        g.updated_at DESC NULLS LAST,
        g.created_at DESC NULLS LAST,
        g.id DESC
    ) AS kept_grade_id,
    first_value(g.value) OVER (
      PARTITION BY
        g.user_id,
        g.student_id,
        g.subject_id,
        g.grade_type,
        g.assignment_id,
        g.semester_id,
        g.academic_year_id
      ORDER BY
        (g.value IS NOT NULL) DESC,
        g.updated_at DESC NULLS LAST,
        g.created_at DESC NULLS LAST,
        g.id DESC
    ) AS kept_value,
    first_value(g.created_at) OVER (
      PARTITION BY
        g.user_id,
        g.student_id,
        g.subject_id,
        g.grade_type,
        g.assignment_id,
        g.semester_id,
        g.academic_year_id
      ORDER BY
        (g.value IS NOT NULL) DESC,
        g.updated_at DESC NULLS LAST,
        g.created_at DESC NULLS LAST,
        g.id DESC
    ) AS kept_created_at,
    first_value(g.updated_at) OVER (
      PARTITION BY
        g.user_id,
        g.student_id,
        g.subject_id,
        g.grade_type,
        g.assignment_id,
        g.semester_id,
        g.academic_year_id
      ORDER BY
        (g.value IS NOT NULL) DESC,
        g.updated_at DESC NULLS LAST,
        g.created_at DESC NULLS LAST,
        g.id DESC
    ) AS kept_updated_at,
    ds.distinct_non_null_values
  FROM public.grades g
  JOIN duplicate_stats ds
    ON ds.user_id = g.user_id
   AND ds.student_id = g.student_id
   AND ds.subject_id = g.subject_id
   AND ds.grade_type = g.grade_type
   AND ds.assignment_id IS NOT DISTINCT FROM g.assignment_id
   AND ds.semester_id IS NOT DISTINCT FROM g.semester_id
   AND ds.academic_year_id IS NOT DISTINCT FROM g.academic_year_id
),
rows_to_remove AS (
  SELECT *
  FROM ranked_duplicates
  WHERE duplicate_rank > 1
),
archived AS (
  INSERT INTO public.grade_duplicate_resolution_audit (
    kept_grade_id,
    removed_grade_id,
    user_id,
    student_id,
    subject_id,
    assignment_id,
    academic_year_id,
    semester_id,
    grade_type,
    kept_value,
    removed_value,
    kept_created_at,
    kept_updated_at,
    removed_created_at,
    removed_updated_at,
    had_value_conflict
  )
  SELECT
    kept_grade_id,
    id AS removed_grade_id,
    user_id,
    student_id,
    subject_id,
    assignment_id,
    academic_year_id,
    semester_id,
    grade_type,
    kept_value,
    value AS removed_value,
    kept_created_at,
    kept_updated_at,
    created_at AS removed_created_at,
    updated_at AS removed_updated_at,
    distinct_non_null_values > 1 AS had_value_conflict
  FROM rows_to_remove
  WHERE true
    AND NOT EXISTS (
      SELECT 1
        FROM public.grade_duplicate_resolution_audit existing_audit
       WHERE existing_audit.removed_grade_id = rows_to_remove.id
    )
  RETURNING removed_grade_id
)
DELETE FROM public.grades g
USING rows_to_remove r
WHERE g.id = r.id;

DO $$
DECLARE
  v_duplicate_count integer;
BEGIN
  SELECT COUNT(*)
    INTO v_duplicate_count
    FROM (
      SELECT
        user_id,
        student_id,
        subject_id,
        grade_type,
        assignment_id,
        semester_id,
        academic_year_id
      FROM public.grades
      GROUP BY
        user_id,
        student_id,
        subject_id,
        grade_type,
        assignment_id,
        semester_id,
        academic_year_id
      HAVING COUNT(*) > 1
    ) duplicate_scopes;

  IF v_duplicate_count > 0 THEN
    RAISE EXCEPTION 'Perbaikan nilai duplikat belum tuntas: % scope masih duplikat.', v_duplicate_count
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'grades_unique_owner_scope'
       AND conrelid = 'public.grades'::regclass
  ) THEN
    ALTER TABLE public.grades
      ADD CONSTRAINT grades_unique_owner_scope
      UNIQUE NULLS NOT DISTINCT (
        user_id,
        student_id,
        subject_id,
        grade_type,
        assignment_id,
        semester_id,
        academic_year_id
      );
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
