-- Harden guest grade input writes behind token-bound RPCs.
-- The old guest write policies allowed writes to any active shared subject
-- when object ids were known. These functions validate the concrete token,
-- class, subject, student, and assignment before every mutation.

DROP POLICY IF EXISTS "Guests can create assignments for shared subjects" ON public.assignments;
DROP POLICY IF EXISTS "Guests can create chapters for shared subjects" ON public.chapters;
DROP POLICY IF EXISTS "Guests can delete assignments for shared subjects" ON public.assignments;
DROP POLICY IF EXISTS "Guests can delete chapters for shared subjects" ON public.chapters;
DROP POLICY IF EXISTS "Guests can insert assignments for shared subjects" ON public.assignments;
DROP POLICY IF EXISTS "Guests can insert chapters for shared subjects" ON public.chapters;
DROP POLICY IF EXISTS "Guests can insert grades for shared subjects" ON public.grades;
DROP POLICY IF EXISTS "Guests can update assignments for shared subjects" ON public.assignments;
DROP POLICY IF EXISTS "Guests can update chapters for shared subjects" ON public.chapters;
DROP POLICY IF EXISTS "Guests can update grades for shared subjects" ON public.grades;
DROP POLICY IF EXISTS "Guests can update shared subjects" ON public.subjects;

CREATE OR REPLACE FUNCTION public.require_valid_shared_link(p_token text)
RETURNS public.shared_links
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
BEGIN
  SELECT *
    INTO v_link
    FROM public.shared_links
   WHERE token = p_token
     AND revoked = false
     AND expired_at > now()
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_guest_token';
  END IF;

  RETURN v_link;
END;
$$;

REVOKE ALL ON FUNCTION public.require_valid_shared_link(text) FROM PUBLIC;

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

CREATE OR REPLACE FUNCTION public.guest_update_subject_kkm(p_token text, p_kkm integer)
RETURNS public.subjects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
  v_subject public.subjects%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  IF p_kkm < 0 OR p_kkm > 100 THEN
    RAISE EXCEPTION 'guest_invalid_grade_value';
  END IF;

  UPDATE public.subjects
     SET kkm = p_kkm,
         updated_at = now()
   WHERE id = v_link.subject_id
     AND class_id = v_link.class_id
     AND user_id = v_link.user_id
   RETURNING * INTO v_subject;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  RETURN v_subject;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_create_chapters(p_token text, p_names text[])
RETURNS SETOF public.chapters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
  v_class public.classes%ROWTYPE;
  v_name text;
  v_order integer;
  v_chapter public.chapters%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  SELECT * INTO v_class FROM public.classes WHERE id = v_link.class_id AND user_id = v_link.user_id;
  IF v_class.id IS NULL THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  SELECT COALESCE(MAX(order_index), 0)
    INTO v_order
    FROM public.chapters
   WHERE subject_id = v_link.subject_id
     AND user_id = v_link.user_id
     AND (
       v_class.semester_id IS NULL
       OR semester_id = v_class.semester_id
       OR semester_id IS NULL
     );

  FOREACH v_name IN ARRAY COALESCE(p_names, ARRAY[]::text[]) LOOP
    v_name := btrim(v_name);
    IF v_name = '' THEN
      CONTINUE;
    END IF;

    v_order := v_order + 1;
    INSERT INTO public.chapters (user_id, subject_id, name, order_index, semester_id)
    VALUES (v_link.user_id, v_link.subject_id, v_name, v_order, v_class.semester_id)
    RETURNING * INTO v_chapter;

    RETURN NEXT v_chapter;
  END LOOP;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_update_chapter(p_token text, p_chapter_id uuid, p_name text)
RETURNS public.chapters
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  UPDATE public.chapters
     SET name = btrim(p_name),
         updated_at = now()
   WHERE id = p_chapter_id
     AND subject_id = v_link.subject_id
     AND user_id = v_link.user_id
   RETURNING * INTO v_chapter;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  RETURN v_chapter;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_delete_chapter(p_token text, p_chapter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  DELETE FROM public.chapters
   WHERE id = p_chapter_id
     AND subject_id = v_link.subject_id
     AND user_id = v_link.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_create_assignments(p_token text, p_chapter_id uuid, p_names text[])
RETURNS SETOF public.assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
  v_chapter public.chapters%ROWTYPE;
  v_name text;
  v_order integer;
  v_assignment public.assignments%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  SELECT *
    INTO v_chapter
    FROM public.chapters
   WHERE id = p_chapter_id
     AND subject_id = v_link.subject_id
     AND user_id = v_link.user_id;

  IF v_chapter.id IS NULL THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  SELECT COALESCE(MAX(order_index), 0)
    INTO v_order
    FROM public.assignments
   WHERE chapter_id = p_chapter_id
     AND user_id = v_link.user_id;

  FOREACH v_name IN ARRAY COALESCE(p_names, ARRAY[]::text[]) LOOP
    v_name := btrim(v_name);
    IF v_name = '' THEN
      CONTINUE;
    END IF;

    v_order := v_order + 1;
    INSERT INTO public.assignments (user_id, chapter_id, name, order_index, semester_id)
    VALUES (v_link.user_id, p_chapter_id, v_name, v_order, v_chapter.semester_id)
    RETURNING * INTO v_assignment;

    RETURN NEXT v_assignment;
  END LOOP;

  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_update_assignment(p_token text, p_assignment_id uuid, p_name text)
RETURNS public.assignments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
  v_assignment public.assignments%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  UPDATE public.assignments a
     SET name = btrim(p_name),
         updated_at = now()
    FROM public.chapters c
   WHERE a.id = p_assignment_id
     AND a.chapter_id = c.id
     AND c.subject_id = v_link.subject_id
     AND a.user_id = v_link.user_id
     AND c.user_id = v_link.user_id
   RETURNING a.* INTO v_assignment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  RETURN v_assignment;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_delete_assignment(p_token text, p_assignment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  DELETE FROM public.assignments a
   USING public.chapters c
   WHERE a.id = p_assignment_id
     AND a.chapter_id = c.id
     AND c.subject_id = v_link.subject_id
     AND a.user_id = v_link.user_id
     AND c.user_id = v_link.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_upsert_grade(
  p_token text,
  p_student_id uuid,
  p_grade_type text,
  p_value numeric,
  p_assignment_id uuid DEFAULT NULL
)
RETURNS public.grades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.shared_links%ROWTYPE;
  v_class public.classes%ROWTYPE;
  v_existing_id uuid;
  v_grade public.grades%ROWTYPE;
BEGIN
  v_link := public.require_valid_shared_link(p_token);

  IF p_grade_type NOT IN ('assignment', 'sts', 'sas') THEN
    RAISE EXCEPTION 'guest_invalid_grade_type';
  END IF;

  IF p_value IS NOT NULL AND (p_value < 0 OR p_value > 100) THEN
    RAISE EXCEPTION 'guest_invalid_grade_value';
  END IF;

  SELECT *
    INTO v_class
    FROM public.classes
   WHERE id = v_link.class_id
     AND user_id = v_link.user_id;

  IF v_class.id IS NULL THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.students s
     WHERE s.id = p_student_id
       AND s.class_id = v_link.class_id
       AND s.user_id = v_link.user_id
  ) THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  IF p_assignment_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
      FROM public.assignments a
      JOIN public.chapters c ON c.id = a.chapter_id
     WHERE a.id = p_assignment_id
       AND c.subject_id = v_link.subject_id
       AND a.user_id = v_link.user_id
       AND c.user_id = v_link.user_id
  ) THEN
    RAISE EXCEPTION 'guest_scope_violation';
  END IF;

  SELECT id
    INTO v_existing_id
    FROM public.grades g
   WHERE g.user_id = v_link.user_id
     AND g.student_id = p_student_id
     AND g.subject_id = v_link.subject_id
     AND g.grade_type = p_grade_type
     AND g.assignment_id IS NOT DISTINCT FROM p_assignment_id
     AND g.semester_id IS NOT DISTINCT FROM v_class.semester_id
   ORDER BY g.updated_at DESC
   LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.grades (
      user_id,
      student_id,
      subject_id,
      assignment_id,
      academic_year_id,
      semester_id,
      grade_type,
      value
    )
    VALUES (
      v_link.user_id,
      p_student_id,
      v_link.subject_id,
      p_assignment_id,
      v_class.academic_year_id,
      v_class.semester_id,
      p_grade_type,
      p_value
    )
    RETURNING * INTO v_grade;
  ELSE
    UPDATE public.grades
       SET value = p_value,
           updated_at = now()
     WHERE id = v_existing_id
     RETURNING * INTO v_grade;
  END IF;

  RETURN v_grade;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_guest_grade_input_data(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_update_subject_kkm(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_create_chapters(text, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_update_chapter(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_delete_chapter(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_create_assignments(text, uuid, text[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_update_assignment(text, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_delete_assignment(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_upsert_grade(text, uuid, text, numeric, uuid) TO anon, authenticated;
