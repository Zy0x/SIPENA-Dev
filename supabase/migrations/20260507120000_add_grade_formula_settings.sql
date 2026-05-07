CREATE TABLE IF NOT EXISTS public.grade_formula_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  formula jsonb NOT NULL DEFAULT '{
    "enabled": false,
    "components": [
      {"id": "grandAvg", "name": "Rata-rata BAB", "enabled": true, "weight": 50},
      {"id": "sts", "name": "Nilai STS", "enabled": true, "weight": 25},
      {"id": "sas", "name": "Nilai SAS", "enabled": true, "weight": 25}
    ]
  }'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT grade_formula_settings_formula_object_check CHECK (jsonb_typeof(formula) = 'object')
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grade_formula_settings_pkey'
  ) THEN
    ALTER TABLE ONLY public.grade_formula_settings
      ADD CONSTRAINT grade_formula_settings_pkey PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grade_formula_settings_user_subject_key'
  ) THEN
    ALTER TABLE ONLY public.grade_formula_settings
      ADD CONSTRAINT grade_formula_settings_user_subject_key UNIQUE (user_id, subject_id);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_grade_formula_settings_user ON public.grade_formula_settings USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_grade_formula_settings_subject ON public.grade_formula_settings USING btree (subject_id);

ALTER TABLE ONLY public.grade_formula_settings REPLICA IDENTITY FULL;

DROP TRIGGER IF EXISTS update_grade_formula_settings_updated_at ON public.grade_formula_settings;
CREATE TRIGGER update_grade_formula_settings_updated_at
  BEFORE UPDATE ON public.grade_formula_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.grade_formula_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own grade formula settings" ON public.grade_formula_settings;
DROP POLICY IF EXISTS "Users can insert their own grade formula settings" ON public.grade_formula_settings;
DROP POLICY IF EXISTS "Users can update their own grade formula settings" ON public.grade_formula_settings;
DROP POLICY IF EXISTS "Users can delete their own grade formula settings" ON public.grade_formula_settings;

CREATE POLICY "Users can view their own grade formula settings"
ON public.grade_formula_settings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own grade formula settings"
ON public.grade_formula_settings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.subjects s
    WHERE s.id = grade_formula_settings.subject_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own grade formula settings"
ON public.grade_formula_settings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.subjects s
    WHERE s.id = grade_formula_settings.subject_id
      AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own grade formula settings"
ON public.grade_formula_settings
FOR DELETE
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_guest_grade_input_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
  v_class public.classes%ROWTYPE;
  v_subject public.subjects%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  SELECT *
    INTO v_class
    FROM public.classes
   WHERE id = v_link.class_id
     AND user_id = v_link.user_id;

  SELECT *
    INTO v_subject
    FROM public.subjects
   WHERE id = v_link.subject_id
     AND class_id = v_link.class_id
     AND user_id = v_link.user_id;

  IF v_class.id IS NULL OR v_subject.id IS NULL THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  UPDATE public.shared_links
     SET last_used_at = now()
   WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'access', jsonb_build_object(
      'ownerUserId', v_link.user_id,
      'classId', v_link.class_id,
      'subjectId', v_link.subject_id,
      'sharedLinkId', v_link.id
    ),
    'classInfo', to_jsonb(v_class),
    'subjectInfo', to_jsonb(v_subject),
    'formulaSetting', (
      SELECT to_jsonb(gfs)
        FROM public.grade_formula_settings gfs
       WHERE gfs.subject_id = v_link.subject_id
         AND gfs.user_id = v_link.user_id
       LIMIT 1
    ),
    'students', (
      SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.name), '[]'::jsonb)
        FROM (
          SELECT *
            FROM public.students
           WHERE class_id = v_link.class_id
             AND user_id = v_link.user_id
           ORDER BY name
        ) s
    ),
    'chapters', (
      SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.order_index), '[]'::jsonb)
        FROM (
          SELECT *
            FROM public.chapters
           WHERE subject_id = v_link.subject_id
             AND user_id = v_link.user_id
             AND (
               v_class.semester_id IS NULL
               OR semester_id = v_class.semester_id
               OR semester_id IS NULL
             )
           ORDER BY order_index
        ) c
    ),
    'assignments', (
      SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY c.order_index, a.order_index), '[]'::jsonb)
        FROM public.assignments a
        JOIN public.chapters c ON c.id = a.chapter_id
       WHERE c.subject_id = v_link.subject_id
         AND c.user_id = v_link.user_id
         AND a.user_id = v_link.user_id
         AND (
           v_class.semester_id IS NULL
           OR a.semester_id = v_class.semester_id
           OR a.semester_id IS NULL
         )
    ),
    'grades', (
      SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.updated_at DESC), '[]'::jsonb)
        FROM public.grades g
       WHERE g.subject_id = v_link.subject_id
         AND g.user_id = v_link.user_id
         AND (
           v_class.academic_year_id IS NULL
           OR g.academic_year_id = v_class.academic_year_id
           OR g.academic_year_id IS NULL
         )
         AND (
           v_class.semester_id IS NULL
           OR g.semester_id = v_class.semester_id
           OR g.semester_id IS NULL
         )
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_grade_input_data(text) TO anon, authenticated;
