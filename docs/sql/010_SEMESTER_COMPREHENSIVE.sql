-- ============================================================================
-- SEMESTER COMPREHENSIVE SCHEMA & MIGRATION
-- Menambahkan layer semester ke sistem tahun ajaran untuk filtering granular
-- ============================================================================
-- PENTING: Script ini aman dijalankan berulang kali (idempotent)
-- Jalankan SETELAH ACADEMIC_YEAR_COMPREHENSIVE.sql
-- ============================================================================

-- ============================================================================
-- BAGIAN 1: UPDATE TABEL SEMESTERS DENGAN DATE RANGES
-- ============================================================================

-- Tambahkan kolom tanggal untuk semester (untuk presensi cross-calendar year)
DO $$
BEGIN
  -- Tanggal mulai semester
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'semesters' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE public.semesters ADD COLUMN start_date DATE;
    RAISE NOTICE 'Added start_date to semesters table';
  END IF;
  
  -- Tanggal selesai semester
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'semesters' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE public.semesters ADD COLUMN end_date DATE;
    RAISE NOTICE 'Added end_date to semesters table';
  END IF;
END $$;

-- ============================================================================
-- BAGIAN 2: TAMBAH KOLOM semester_id KE TABEL TRANSAKSIONAL
-- Tabel transaksional = nilai, tugas, bab, dll (semester-specific)
-- ============================================================================

-- 2.1 Tambahkan semester_id ke tabel grades
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grades') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'grades' AND column_name = 'semester_id'
    ) THEN
      ALTER TABLE public.grades 
      ADD COLUMN semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added semester_id to grades table';
    ELSE
      RAISE NOTICE 'Column semester_id already exists in grades table';
    END IF;
  END IF;
END $$;

-- 2.2 Tambahkan semester_id ke tabel chapters (BAB pembelajaran)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chapters') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'chapters' AND column_name = 'semester_id'
    ) THEN
      ALTER TABLE public.chapters 
      ADD COLUMN semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added semester_id to chapters table';
    ELSE
      RAISE NOTICE 'Column semester_id already exists in chapters table';
    END IF;
  END IF;
END $$;

-- 2.3 Tambahkan semester_id ke tabel assignments (tugas)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignments') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'semester_id'
    ) THEN
      ALTER TABLE public.assignments 
      ADD COLUMN semester_id UUID REFERENCES public.semesters(id) ON DELETE SET NULL;
      RAISE NOTICE 'Added semester_id to assignments table';
    ELSE
      RAISE NOTICE 'Column semester_id already exists in assignments table';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- BAGIAN 3: BUAT INDEXES UNTUK PERFORMA QUERY
-- ============================================================================

DO $$
BEGIN
  -- Index untuk grades.semester_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grades' AND column_name = 'semester_id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_grades_semester_id') THEN
      CREATE INDEX idx_grades_semester_id ON public.grades(semester_id);
      RAISE NOTICE 'Created index idx_grades_semester_id';
    END IF;
  END IF;
  
  -- Composite index untuk grades (academic_year_id + semester_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grades' AND column_name = 'semester_id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_grades_year_semester') THEN
      CREATE INDEX idx_grades_year_semester ON public.grades(academic_year_id, semester_id);
      RAISE NOTICE 'Created composite index idx_grades_year_semester';
    END IF;
  END IF;
  
  -- Index untuk chapters.semester_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chapters' AND column_name = 'semester_id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chapters_semester_id') THEN
      CREATE INDEX idx_chapters_semester_id ON public.chapters(semester_id);
      RAISE NOTICE 'Created index idx_chapters_semester_id';
    END IF;
  END IF;
  
  -- Index untuk assignments.semester_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'semester_id'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_assignments_semester_id') THEN
      CREATE INDEX idx_assignments_semester_id ON public.assignments(semester_id);
      RAISE NOTICE 'Created index idx_assignments_semester_id';
    END IF;
  END IF;
END $$;

-- ============================================================================
-- BAGIAN 4: CHECK CONSTRAINT UNTUK SEMESTER NUMBER
-- ============================================================================

DO $$
BEGIN
  -- Pastikan semester.number hanya 1 atau 2
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'semesters') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'chk_semester_number_valid' 
      AND conrelid = 'public.semesters'::regclass
    ) THEN
      ALTER TABLE public.semesters 
      ADD CONSTRAINT chk_semester_number_valid CHECK (number IN (1, 2));
      RAISE NOTICE 'Added check constraint for semester number (1 or 2)';
    END IF;
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'Check constraint already violated by existing data, skipping...';
END $$;

-- ============================================================================
-- BAGIAN 5: TRIGGER UNTUK AUTO-ASSIGN SEMESTER_ID PADA INSERT
-- ============================================================================

-- Function untuk mendapatkan semester aktif user
CREATE OR REPLACE FUNCTION get_active_semester_id(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_semester_id UUID;
BEGIN
  SELECT id INTO v_semester_id 
  FROM public.semesters 
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  RETURN v_semester_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function untuk auto-assign semester_id pada grades
CREATE OR REPLACE FUNCTION auto_assign_semester_to_grade()
RETURNS TRIGGER AS $$
BEGIN
  -- Jika semester_id tidak diisi, ambil dari semester aktif user
  IF NEW.semester_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.semester_id := get_active_semester_id(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Buat trigger untuk grades
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'grades') THEN
    DROP TRIGGER IF EXISTS trg_auto_assign_semester_grade ON public.grades;
    CREATE TRIGGER trg_auto_assign_semester_grade
      BEFORE INSERT ON public.grades
      FOR EACH ROW
      EXECUTE FUNCTION auto_assign_semester_to_grade();
    RAISE NOTICE 'Created trigger trg_auto_assign_semester_grade';
  END IF;
END $$;

-- Trigger function untuk auto-assign semester_id pada chapters
CREATE OR REPLACE FUNCTION auto_assign_semester_to_chapter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.semester_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.semester_id := get_active_semester_id(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Buat trigger untuk chapters
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chapters') THEN
    DROP TRIGGER IF EXISTS trg_auto_assign_semester_chapter ON public.chapters;
    CREATE TRIGGER trg_auto_assign_semester_chapter
      BEFORE INSERT ON public.chapters
      FOR EACH ROW
      EXECUTE FUNCTION auto_assign_semester_to_chapter();
    RAISE NOTICE 'Created trigger trg_auto_assign_semester_chapter';
  END IF;
END $$;

-- Trigger function untuk auto-assign semester_id pada assignments
CREATE OR REPLACE FUNCTION auto_assign_semester_to_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.semester_id IS NULL AND NEW.user_id IS NOT NULL THEN
    NEW.semester_id := get_active_semester_id(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Buat trigger untuk assignments
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'assignments') THEN
    DROP TRIGGER IF EXISTS trg_auto_assign_semester_assignment ON public.assignments;
    CREATE TRIGGER trg_auto_assign_semester_assignment
      BEFORE INSERT ON public.assignments
      FOR EACH ROW
      EXECUTE FUNCTION auto_assign_semester_to_assignment();
    RAISE NOTICE 'Created trigger trg_auto_assign_semester_assignment';
  END IF;
END $$;

-- ============================================================================
-- BAGIAN 6: MIGRASI DATA EXISTING KE SEMESTER 2 TAHUN AJARAN 2025/2026
-- ============================================================================

-- Pastikan tahun ajaran 2025/2026 ada untuk setiap user
DO $$
DECLARE
  v_user RECORD;
  v_year_id UUID;
  v_sem1_id UUID;
  v_sem2_id UUID;
BEGIN
  -- Loop untuk setiap user yang memiliki classes
  FOR v_user IN 
    SELECT DISTINCT user_id FROM public.classes WHERE user_id IS NOT NULL
  LOOP
    -- Cek atau buat tahun ajaran 2025/2026
    SELECT id INTO v_year_id
    FROM public.academic_years
    WHERE user_id = v_user.user_id AND name = '2025/2026';
    
    IF v_year_id IS NULL THEN
      INSERT INTO public.academic_years (user_id, name, is_active)
      VALUES (v_user.user_id, '2025/2026', true)
      RETURNING id INTO v_year_id;
      RAISE NOTICE 'Created academic year 2025/2026 for user %', v_user.user_id;
    END IF;
    
    -- Cek atau buat Semester 1
    SELECT id INTO v_sem1_id
    FROM public.semesters
    WHERE user_id = v_user.user_id 
      AND academic_year_id = v_year_id 
      AND number = 1;
    
    IF v_sem1_id IS NULL THEN
      INSERT INTO public.semesters (user_id, academic_year_id, name, number, is_active, start_date, end_date)
      VALUES (v_user.user_id, v_year_id, 'Semester 1', 1, false, '2025-07-01', '2025-12-31')
      RETURNING id INTO v_sem1_id;
      RAISE NOTICE 'Created Semester 1 for user %', v_user.user_id;
    END IF;
    
    -- Cek atau buat Semester 2 (aktif)
    SELECT id INTO v_sem2_id
    FROM public.semesters
    WHERE user_id = v_user.user_id 
      AND academic_year_id = v_year_id 
      AND number = 2;
    
    IF v_sem2_id IS NULL THEN
      INSERT INTO public.semesters (user_id, academic_year_id, name, number, is_active, start_date, end_date)
      VALUES (v_user.user_id, v_year_id, 'Semester 2', 2, true, '2026-01-01', '2026-06-30')
      RETURNING id INTO v_sem2_id;
      RAISE NOTICE 'Created Semester 2 (active) for user %', v_user.user_id;
    ELSE
      -- Aktifkan Semester 2
      UPDATE public.semesters SET is_active = true WHERE id = v_sem2_id;
    END IF;
    
    -- Set tahun ajaran sebagai aktif
    UPDATE public.academic_years 
    SET is_active = false 
    WHERE user_id = v_user.user_id AND id != v_year_id;
    
    UPDATE public.academic_years 
    SET is_active = true 
    WHERE id = v_year_id;
    
    -- Deaktifkan semester lain
    UPDATE public.semesters
    SET is_active = false
    WHERE user_id = v_user.user_id AND id != v_sem2_id;
  END LOOP;
END $$;

-- ============================================================================
-- BAGIAN 7: MIGRASI DATA TRANSAKSIONAL KE SEMESTER 2
-- ============================================================================

-- Update grades dengan semester_id (ke Semester 2 aktif)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grades' AND column_name = 'semester_id'
  ) THEN
    UPDATE public.grades g
    SET semester_id = (
      SELECT s.id 
      FROM public.semesters s 
      WHERE s.user_id = g.user_id 
        AND s.is_active = true
      LIMIT 1
    )
    WHERE g.semester_id IS NULL;
    RAISE NOTICE 'Migrated grades to active semester';
  END IF;
END $$;

-- Update chapters dengan semester_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chapters' AND column_name = 'semester_id'
  ) THEN
    UPDATE public.chapters c
    SET semester_id = (
      SELECT s.id 
      FROM public.semesters s 
      WHERE s.user_id = c.user_id 
        AND s.is_active = true
      LIMIT 1
    )
    WHERE c.semester_id IS NULL;
    RAISE NOTICE 'Migrated chapters to active semester';
  END IF;
END $$;

-- Update assignments dengan semester_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'semester_id'
  ) THEN
    UPDATE public.assignments a
    SET semester_id = (
      SELECT s.id 
      FROM public.semesters s 
      WHERE s.user_id = a.user_id 
        AND s.is_active = true
      LIMIT 1
    )
    WHERE a.semester_id IS NULL;
    RAISE NOTICE 'Migrated assignments to active semester';
  END IF;
END $$;

-- ============================================================================
-- BAGIAN 8: FUNCTION HELPER UNTUK QUERY AGREGASI
-- ============================================================================

-- Function untuk mendapatkan nilai gabungan dari kedua semester
CREATE OR REPLACE FUNCTION get_combined_semester_grades(
  p_user_id UUID,
  p_academic_year_id UUID,
  p_student_id UUID,
  p_subject_id UUID
)
RETURNS TABLE (
  semester_number INT,
  grade_type TEXT,
  avg_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.number::INT as semester_number,
    g.grade_type,
    AVG(g.value)::NUMERIC as avg_value
  FROM public.grades g
  JOIN public.semesters s ON g.semester_id = s.id
  WHERE g.user_id = p_user_id
    AND g.academic_year_id = p_academic_year_id
    AND g.student_id = p_student_id
    AND g.subject_id = p_subject_id
    AND g.value IS NOT NULL
  GROUP BY s.number, g.grade_type
  ORDER BY s.number, g.grade_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function untuk menghitung rata-rata nilai tahunan
CREATE OR REPLACE FUNCTION calculate_yearly_average(
  p_user_id UUID,
  p_academic_year_id UUID,
  p_student_id UUID,
  p_subject_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT AVG(g.value) INTO v_avg
  FROM public.grades g
  WHERE g.user_id = p_user_id
    AND g.academic_year_id = p_academic_year_id
    AND g.student_id = p_student_id
    AND g.subject_id = p_subject_id
    AND g.value IS NOT NULL;
  
  RETURN COALESCE(v_avg, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- BAGIAN 9: VERIFIKASI HASIL MIGRASI
-- ============================================================================

DO $$
DECLARE
  v_year_count INT;
  v_sem_count INT;
  v_grades_with_sem INT;
  v_chapters_with_sem INT;
  v_assignments_with_sem INT;
BEGIN
  -- Count data
  SELECT COUNT(*) INTO v_year_count FROM public.academic_years;
  SELECT COUNT(*) INTO v_sem_count FROM public.semesters;
  
  -- Count grades with semester
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'grades' AND column_name = 'semester_id'
  ) THEN
    SELECT COUNT(*) INTO v_grades_with_sem FROM public.grades WHERE semester_id IS NOT NULL;
  ELSE
    v_grades_with_sem := 0;
  END IF;
  
  -- Count chapters with semester
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'chapters' AND column_name = 'semester_id'
  ) THEN
    SELECT COUNT(*) INTO v_chapters_with_sem FROM public.chapters WHERE semester_id IS NOT NULL;
  ELSE
    v_chapters_with_sem := 0;
  END IF;
  
  -- Count assignments with semester
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'assignments' AND column_name = 'semester_id'
  ) THEN
    SELECT COUNT(*) INTO v_assignments_with_sem FROM public.assignments WHERE semester_id IS NOT NULL;
  ELSE
    v_assignments_with_sem := 0;
  END IF;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'HASIL MIGRASI SEMESTER';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Total Academic Years: %', v_year_count;
  RAISE NOTICE 'Total Semesters: %', v_sem_count;
  RAISE NOTICE 'Grades with semester_id: %', v_grades_with_sem;
  RAISE NOTICE 'Chapters with semester_id: %', v_chapters_with_sem;
  RAISE NOTICE 'Assignments with semester_id: %', v_assignments_with_sem;
  RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- MIGRASI SEMESTER SELESAI
-- ============================================================================
