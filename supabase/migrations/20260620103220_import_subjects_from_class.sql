-- Keep the local migration chain aligned with the production schema. These
-- columns already exist on older projects that ran the semester backfill.
ALTER TABLE public.chapters
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.import_subjects_from_class(
  p_target_class_id uuid,
  p_source_class_id uuid,
  p_subject_ids uuid[],
  p_source_semester_id uuid DEFAULT NULL,
  p_target_semester_id uuid DEFAULT NULL,
  p_include_structure boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_source_class public.classes%ROWTYPE;
  v_target_class public.classes%ROWTYPE;
  v_source_subject public.subjects%ROWTYPE;
  v_source_chapter public.chapters%ROWTYPE;
  v_new_subject_id uuid;
  v_new_chapter_id uuid;
  v_requested_count integer := 0;
  v_owned_count integer := 0;
  v_created integer := 0;
  v_skipped integer := 0;
  v_chapters integer := 0;
  v_assignments integer := 0;
  v_formulas integer := 0;
  v_links integer := 0;
  v_created_subjects jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF p_source_class_id = p_target_class_id THEN
    RAISE EXCEPTION 'source_and_target_must_differ';
  END IF;

  SELECT * INTO v_source_class
  FROM public.classes
  WHERE id = p_source_class_id AND user_id = v_user_id;

  SELECT * INTO v_target_class
  FROM public.classes
  WHERE id = p_target_class_id AND user_id = v_user_id;

  IF v_source_class.id IS NULL OR v_target_class.id IS NULL THEN
    RAISE EXCEPTION 'class_not_found_or_forbidden';
  END IF;

  SELECT count(*) INTO v_requested_count
  FROM (SELECT DISTINCT unnest(COALESCE(p_subject_ids, ARRAY[]::uuid[])) AS id) requested;

  IF v_requested_count = 0 THEN
    RAISE EXCEPTION 'no_subject_selected';
  END IF;

  SELECT count(*) INTO v_owned_count
  FROM public.subjects subject
  WHERE subject.id = ANY(p_subject_ids)
    AND subject.class_id = p_source_class_id
    AND subject.user_id = v_user_id;

  IF v_owned_count <> v_requested_count THEN
    RAISE EXCEPTION 'invalid_subject_selection';
  END IF;

  IF p_include_structure THEN
    IF p_source_semester_id IS NULL OR p_target_semester_id IS NULL THEN
      RAISE EXCEPTION 'semester_required_for_structure';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.semesters
      WHERE id = p_source_semester_id
        AND academic_year_id = v_source_class.academic_year_id
        AND user_id = v_user_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.semesters
      WHERE id = p_target_semester_id
        AND academic_year_id = v_target_class.academic_year_id
        AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'semester_not_found_or_forbidden';
    END IF;
  END IF;

  FOR v_source_subject IN
    SELECT subject.*
    FROM public.subjects subject
    WHERE subject.id = ANY(p_subject_ids)
      AND subject.class_id = p_source_class_id
      AND subject.user_id = v_user_id
    ORDER BY array_position(p_subject_ids, subject.id), subject.name
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.subjects target_subject
      WHERE target_subject.class_id = p_target_class_id
        AND target_subject.user_id = v_user_id
        AND lower(regexp_replace(btrim(target_subject.name), '\s+', ' ', 'g')) =
            lower(regexp_replace(btrim(v_source_subject.name), '\s+', ' ', 'g'))
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.subjects (
      user_id,
      class_id,
      academic_year_id,
      name,
      kkm,
      is_custom
    ) VALUES (
      v_user_id,
      p_target_class_id,
      v_target_class.academic_year_id,
      regexp_replace(btrim(v_source_subject.name), '\s+', ' ', 'g'),
      v_source_subject.kkm,
      COALESCE(v_source_subject.is_custom, false)
    )
    RETURNING id INTO v_new_subject_id;

    v_created := v_created + 1;
    v_created_subjects := v_created_subjects || jsonb_build_array(jsonb_build_object(
      'sourceSubjectId', v_source_subject.id,
      'targetSubjectId', v_new_subject_id,
      'name', v_source_subject.name
    ));

    IF NOT p_include_structure THEN
      CONTINUE;
    END IF;

    INSERT INTO public.grade_formula_settings (user_id, subject_id, formula)
    SELECT v_user_id, v_new_subject_id, source_formula.formula
    FROM public.grade_formula_settings source_formula
    WHERE source_formula.user_id = v_user_id
      AND source_formula.subject_id = v_source_subject.id
    ON CONFLICT (user_id, subject_id) DO NOTHING;
    GET DIAGNOSTICS v_owned_count = ROW_COUNT;
    v_formulas := v_formulas + v_owned_count;

    FOR v_source_chapter IN
      SELECT chapter.*
      FROM public.chapters chapter
      WHERE chapter.user_id = v_user_id
        AND chapter.subject_id = v_source_subject.id
        AND (chapter.semester_id = p_source_semester_id OR chapter.semester_id IS NULL)
      ORDER BY chapter.order_index, chapter.created_at, chapter.id
    LOOP
      INSERT INTO public.chapters (
        user_id,
        subject_id,
        semester_id,
        name,
        order_index
      ) VALUES (
        v_user_id,
        v_new_subject_id,
        p_target_semester_id,
        v_source_chapter.name,
        v_source_chapter.order_index
      )
      RETURNING id INTO v_new_chapter_id;

      v_chapters := v_chapters + 1;

      INSERT INTO public.assignments (
        user_id,
        chapter_id,
        semester_id,
        name,
        order_index
      )
      SELECT
        v_user_id,
        v_new_chapter_id,
        p_target_semester_id,
        source_assignment.name,
        source_assignment.order_index
      FROM public.assignments source_assignment
      WHERE source_assignment.user_id = v_user_id
        AND source_assignment.chapter_id = v_source_chapter.id
        AND (source_assignment.semester_id = p_source_semester_id OR source_assignment.semester_id IS NULL)
      ORDER BY source_assignment.order_index, source_assignment.created_at, source_assignment.id;

      GET DIAGNOSTICS v_owned_count = ROW_COUNT;
      v_assignments := v_assignments + v_owned_count;
    END LOOP;

    -- A copied active share gets a fresh token and no guest/history metadata.
    IF EXISTS (
      SELECT 1
      FROM public.shared_links source_link
      WHERE source_link.user_id = v_user_id
        AND source_link.class_id = p_source_class_id
        AND source_link.subject_id = v_source_subject.id
        AND source_link.revoked = false
        AND source_link.expired_at > now()
    ) THEN
      INSERT INTO public.shared_links (
        user_id,
        subject_id,
        class_id,
        token,
        revoked,
        expired_at
      ) VALUES (
        v_user_id,
        v_new_subject_id,
        p_target_class_id,
        encode(extensions.gen_random_bytes(32), 'hex'),
        false,
        now() + interval '1 year'
      );
      v_links := v_links + 1;
    END IF;
  END LOOP;

  -- Student grades are intentionally absent from this transaction.
  RETURN jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'chapters', v_chapters,
    'assignments', v_assignments,
    'formulas', v_formulas,
    'links', v_links,
    'subjects', v_created_subjects
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_subjects_from_class(uuid, uuid, uuid[], uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.import_subjects_from_class(uuid, uuid, uuid[], uuid, uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_subjects_from_class(uuid, uuid, uuid[], uuid, uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.import_subjects_from_class(uuid, uuid, uuid[], uuid, uuid, boolean)
IS 'Atomically copies selected subjects and optional semester structure between classes owned by the authenticated user. Never copies grades or link history.';

NOTIFY pgrst, 'reload schema';
