-- ============================================================================
-- 014_OCR_REFERENCE_SEED.sql
-- Skrip untuk menambahkan data murid acuan dan nilai dari gambar contoh ke database.
-- ============================================================================

-- Fungsi ini secara dinamis membuat kelas, murid, dan nilai berdasarkan gambar acuan
-- untuk user_id tertentu. Sangat aman dan tidak membebani server karena data
-- berupa records teks/angka terstruktur.

CREATE OR REPLACE FUNCTION public.seed_ocr_reference_data(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_academic_year_id UUID;
  v_semester_id UUID;
  v_class_id UUID;
  v_subject_id UUID;
  v_chapter_id UUID;
  v_assignment_id UUID;
  v_student_id UUID;
  v_result JSONB;
  
  -- Record data murid acuan dari gambar
  r_student RECORD;
  
  -- Array berisi data acuan
  v_students_data JSONB := '[
    {"name": "Ahmad Fauzi", "nisn": "0012345601", "grade": 85},
    {"name": "Aisyah Nurul Janah", "nisn": "0012345602", "grade": 90},
    {"name": "Budi Santoso", "nisn": "0012345603", "grade": 78},
    {"name": "Citra Maharani", "nisn": "0012345604", "grade": 88},
    {"name": "Dimas Pratama", "nisn": "0012345605", "grade": 80},
    {"name": "Eka Putri", "nisn": "0012345606", "grade": 92},
    {"name": "Fajar Ramadhan", "nisn": "0012345607", "grade": 75},
    {"name": "Gita Lestari", "nisn": "0012345608", "grade": 82},
    {"name": "Hafizh Alfarizi", "nisn": "0012345609", "grade": 70},
    {"name": "Indah Permatasari", "nisn": "0012345610", "grade": 95}
  ]'::jsonb;
BEGIN
  -- 1. Dapatkan atau buat Academic Year aktif
  SELECT id INTO v_academic_year_id 
  FROM public.academic_years 
  WHERE user_id = p_user_id AND is_active = true 
  LIMIT 1;
  
  IF v_academic_year_id IS NULL THEN
    INSERT INTO public.academic_years (user_id, name, is_active)
    VALUES (p_user_id, '2026/2027', true)
    RETURNING id INTO v_academic_year_id;
  END IF;

  -- 2. Dapatkan atau buat Semester aktif
  SELECT id INTO v_semester_id 
  FROM public.semesters 
  WHERE user_id = p_user_id AND academic_year_id = v_academic_year_id AND is_active = true 
  LIMIT 1;
  
  IF v_semester_id IS NULL THEN
    INSERT INTO public.semesters (user_id, academic_year_id, name, number, is_active, start_date, end_date)
    VALUES (p_user_id, v_academic_year_id, 'Semester 1 (Ganjil)', 1, true, CURRENT_DATE, CURRENT_DATE + INTERVAL '6 months')
    RETURNING id INTO v_semester_id;
  END IF;

  -- 3. Dapatkan atau buat Kelas Acuan OCR
  SELECT id INTO v_class_id 
  FROM public.classes 
  WHERE user_id = p_user_id AND name = 'Kelas Uji Coba OCR'
  LIMIT 1;

  IF v_class_id IS NULL THEN
    INSERT INTO public.classes (user_id, name, description, academic_year_id, semester_id)
    VALUES (p_user_id, 'Kelas Uji Coba OCR', 'Kelas contoh untuk simulasi import nilai dari foto', v_academic_year_id, v_semester_id)
    RETURNING id INTO v_class_id;
  END IF;

  -- 4. Dapatkan atau buat Mata Pelajaran Acuan
  SELECT id INTO v_subject_id 
  FROM public.subjects 
  WHERE user_id = p_user_id AND name = 'Mata Pelajaran Uji Coba'
  LIMIT 1;

  IF v_subject_id IS NULL THEN
    INSERT INTO public.subjects (user_id, class_id, name, code, target_grade_kkm)
    VALUES (p_user_id, v_class_id, 'Mata Pelajaran Uji Coba', 'MP-OCR', 75)
    RETURNING id INTO v_subject_id;
  END IF;

  -- 5. Dapatkan atau buat BAB
  SELECT id INTO v_chapter_id 
  FROM public.chapters 
  WHERE user_id = p_user_id AND subject_id = v_subject_id AND name = 'BAB 1: Pengenalan OCR'
  LIMIT 1;

  IF v_chapter_id IS NULL THEN
    INSERT INTO public.chapters (user_id, subject_id, name, order_index)
    VALUES (p_user_id, v_subject_id, 'BAB 1: Pengenalan OCR', 1)
    RETURNING id INTO v_chapter_id;
  END IF;

  -- 6. Dapatkan atau buat Tugas/Assignment
  SELECT id INTO v_assignment_id 
  FROM public.assignments 
  WHERE user_id = p_user_id AND chapter_id = v_chapter_id AND name = 'Tugas 1 (Acuan)'
  LIMIT 1;

  IF v_assignment_id IS NULL THEN
    INSERT INTO public.assignments (user_id, chapter_id, name, order_index)
    VALUES (p_user_id, v_chapter_id, 'Tugas 1 (Acuan)', 1)
    RETURNING id INTO v_assignment_id;
  END IF;

  -- 7. Loop untuk memasukkan Murid & Nilai ke database
  FOR r_student IN 
    SELECT (elem->>'name')::text AS name, 
           (elem->>'nisn')::text AS nisn, 
           (elem->>'grade')::numeric AS grade
    FROM jsonb_array_elements(v_students_data) AS elem
  LOOP
    -- Cari murid lama agar tidak terjadi duplikasi
    SELECT id INTO v_student_id 
    FROM public.students 
    WHERE user_id = p_user_id AND class_id = v_class_id AND (nisn = r_student.nisn OR name = r_student.name)
    LIMIT 1;

    IF v_student_id IS NULL THEN
      INSERT INTO public.students (user_id, class_id, name, nisn)
      VALUES (p_user_id, v_class_id, r_student.name, r_student.nisn)
      RETURNING id INTO v_student_id;
    END IF;

    -- Masukkan atau timpa nilai untuk murid tersebut
    INSERT INTO public.grades (user_id, student_id, subject_id, assignment_id, grade_type, value)
    VALUES (p_user_id, v_student_id, v_subject_id, v_assignment_id, 'assignment', r_student.grade)
    ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;
  END LOOP;

  v_result := jsonb_build_object(
    'success', true,
    'class_id', v_class_id,
    'subject_id', v_subject_id,
    'message', 'Berhasil memasukkan data 10 murid acuan beserta nilai Tugas 1 (Acuan) ke Kelas Uji Coba OCR.'
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Catatan cara penggunaan bagi admin/developer:
-- Cukup panggil fungsi ini di SQL Editor Supabase:
-- SELECT public.seed_ocr_reference_data('UUID_USER_ANDA');
