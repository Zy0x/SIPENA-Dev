-- Atomic owner grade imports and duplicate-safe grade upserts.
-- This migration is intentionally non-destructive: existing duplicate grade rows
-- are reported and keep the full unique constraint from being created, while the
-- batch RPC still rejects duplicate target keys and runs atomically.

ALTER TABLE public.grades
  ADD COLUMN IF NOT EXISTS academic_year_id uuid,
  ADD COLUMN IF NOT EXISTS semester_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grades_academic_year_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.grades
      ADD CONSTRAINT grades_academic_year_id_fkey
      FOREIGN KEY (academic_year_id)
      REFERENCES public.academic_years(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grades_semester_id_fkey'
  ) THEN
    ALTER TABLE ONLY public.grades
      ADD CONSTRAINT grades_semester_id_fkey
      FOREIGN KEY (semester_id)
      REFERENCES public.semesters(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

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

  IF v_duplicate_count = 0 AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grades_unique_owner_scope'
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
  ELSIF v_duplicate_count > 0 THEN
    RAISE WARNING 'Data nilai duplikat ditemukan pada %. Unique constraint penuh dilewati sampai data dibersihkan.', v_duplicate_count;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_grades_batch(p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_item_index integer := 0;
  v_student_id uuid;
  v_subject_id uuid;
  v_assignment_id uuid;
  v_academic_year_id uuid;
  v_semester_id uuid;
  v_grade_type text;
  v_value numeric;
  v_existing_count integer;
  v_existing public.grades%ROWTYPE;
  v_grade public.grades%ROWTYPE;
  v_subject public.subjects%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_saved_count integer := 0;
  v_skipped_unchanged_count integer := 0;
  v_changed_rows jsonb := '[]'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna tidak terautentikasi. Silakan login kembali.'
      USING ERRCODE = '28000';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Payload import nilai tidak valid.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_item_index := v_item_index + 1;
    v_student_id := NULLIF(v_item->>'studentId', '')::uuid;
    v_subject_id := NULLIF(v_item->>'subjectId', '')::uuid;
    v_assignment_id := NULLIF(v_item->>'assignmentId', '')::uuid;
    v_academic_year_id := NULLIF(v_item->>'academicYearId', '')::uuid;
    v_semester_id := NULLIF(v_item->>'semesterId', '')::uuid;
    v_grade_type := v_item->>'gradeType';

    IF v_item ? 'value' AND v_item->>'value' IS NOT NULL THEN
      v_value := (v_item->>'value')::numeric;
    ELSE
      v_value := NULL;
    END IF;

    IF v_student_id IS NULL OR v_subject_id IS NULL OR v_grade_type IS NULL THEN
      RAISE EXCEPTION 'Item import nilai ke-% tidak lengkap.', v_item_index
        USING ERRCODE = '22023';
    END IF;

    IF v_grade_type NOT IN ('assignment', 'sts', 'sas') THEN
      RAISE EXCEPTION 'Tipe nilai tidak valid pada item ke-%: %.', v_item_index, v_grade_type
        USING ERRCODE = '22023';
    END IF;

    IF v_value IS NOT NULL AND (v_value < 0 OR v_value > 100) THEN
      RAISE EXCEPTION 'Nilai pada item ke-% harus berada pada rentang 0 sampai 100.', v_item_index
        USING ERRCODE = '22003';
    END IF;

    IF v_grade_type = 'assignment' AND v_assignment_id IS NULL THEN
      RAISE EXCEPTION 'Nilai tugas pada item ke-% wajib memiliki assignment_id.', v_item_index
        USING ERRCODE = '22023';
    END IF;

    IF v_grade_type IN ('sts', 'sas') AND v_assignment_id IS NOT NULL THEN
      RAISE EXCEPTION 'Nilai % pada item ke-% tidak boleh memiliki assignment_id.', upper(v_grade_type), v_item_index
        USING ERRCODE = '22023';
    END IF;

    SELECT *
      INTO v_subject
      FROM public.subjects
     WHERE id = v_subject_id
       AND user_id = v_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Mata pelajaran pada item ke-% tidak ditemukan atau bukan milik pengguna.', v_item_index
        USING ERRCODE = '42501';
    END IF;

    SELECT *
      INTO v_student
      FROM public.students
     WHERE id = v_student_id
       AND user_id = v_user_id;

    IF NOT FOUND OR v_student.class_id <> v_subject.class_id THEN
      RAISE EXCEPTION 'Siswa pada item ke-% tidak valid untuk mata pelajaran ini.', v_item_index
        USING ERRCODE = '42501';
    END IF;

    IF v_academic_year_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
        FROM public.academic_years ay
       WHERE ay.id = v_academic_year_id
         AND ay.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Tahun ajaran pada item ke-% tidak valid.', v_item_index
        USING ERRCODE = '42501';
    END IF;

    IF v_semester_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
        FROM public.semesters s
       WHERE s.id = v_semester_id
         AND s.user_id = v_user_id
         AND (
           v_academic_year_id IS NULL
           OR s.academic_year_id = v_academic_year_id
         )
    ) THEN
      RAISE EXCEPTION 'Semester pada item ke-% tidak valid.', v_item_index
        USING ERRCODE = '42501';
    END IF;

    IF v_assignment_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
        FROM public.assignments a
        JOIN public.chapters c ON c.id = a.chapter_id
       WHERE a.id = v_assignment_id
         AND a.user_id = v_user_id
         AND c.user_id = v_user_id
         AND c.subject_id = v_subject_id
    ) THEN
      RAISE EXCEPTION 'Tugas pada item ke-% tidak valid untuk mata pelajaran ini.', v_item_index
        USING ERRCODE = '42501';
    END IF;

    SELECT COUNT(*)
      INTO v_existing_count
      FROM public.grades g
     WHERE g.user_id = v_user_id
       AND g.student_id = v_student_id
       AND g.subject_id = v_subject_id
       AND g.grade_type = v_grade_type
       AND g.assignment_id IS NOT DISTINCT FROM v_assignment_id
       AND g.semester_id IS NOT DISTINCT FROM v_semester_id
       AND g.academic_year_id IS NOT DISTINCT FROM v_academic_year_id;

    IF v_existing_count > 1 THEN
      RAISE EXCEPTION 'Data nilai duplikat ditemukan. Perlu perbaikan database sebelum menyimpan.'
        USING ERRCODE = 'P0001';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(concat_ws(
      '|',
      v_user_id::text,
      v_student_id::text,
      v_subject_id::text,
      v_grade_type,
      COALESCE(v_assignment_id::text, '<null>'),
      COALESCE(v_semester_id::text, '<null>'),
      COALESCE(v_academic_year_id::text, '<null>')
    ), 0));

    v_existing := NULL;
    IF v_existing_count = 1 THEN
      SELECT *
        INTO v_existing
        FROM public.grades g
       WHERE g.user_id = v_user_id
         AND g.student_id = v_student_id
         AND g.subject_id = v_subject_id
         AND g.grade_type = v_grade_type
         AND g.assignment_id IS NOT DISTINCT FROM v_assignment_id
         AND g.semester_id IS NOT DISTINCT FROM v_semester_id
         AND g.academic_year_id IS NOT DISTINCT FROM v_academic_year_id;

      IF v_existing.value IS NOT DISTINCT FROM v_value THEN
        v_skipped_unchanged_count := v_skipped_unchanged_count + 1;
        CONTINUE;
      END IF;
    END IF;

    IF v_existing_count = 1 THEN
      UPDATE public.grades
         SET value = v_value,
             updated_at = now()
       WHERE id = v_existing.id
       RETURNING * INTO v_grade;
    ELSE
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
        v_user_id,
        v_student_id,
        v_subject_id,
        v_assignment_id,
        v_academic_year_id,
        v_semester_id,
        v_grade_type,
        v_value
      )
      RETURNING * INTO v_grade;
    END IF;

    v_saved_count := v_saved_count + 1;
    v_changed_rows := v_changed_rows || jsonb_build_array(jsonb_build_object(
      'gradeId', v_grade.id,
      'studentId', v_student_id,
      'subjectId', v_subject_id,
      'gradeType', v_grade_type,
      'assignmentId', v_assignment_id,
      'academicYearId', v_academic_year_id,
      'semesterId', v_semester_id,
      'oldValue', v_existing.value,
      'newValue', v_value
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'savedCount', v_saved_count,
    'skippedUnchangedCount', v_skipped_unchanged_count,
    'changedRows', v_changed_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_grades_batch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_grades_batch(jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
