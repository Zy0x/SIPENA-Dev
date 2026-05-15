-- ============================================================================
-- COMPREHENSIVE ACADEMIC YEAR MIGRATION SCRIPT
-- ============================================================================
-- This script implements full academic year data isolation with the hierarchy:
-- Academic Year → Class → Subject → Grade → Other Components
--
-- SAFETY: All operations are idempotent and use existence checks
-- BACKUP: Run backup before executing this script
-- ============================================================================

-- Transaction start
BEGIN;

-- ============================================================================
-- PHASE 1: TABLE STRUCTURE - Add academic_year_id columns if not exist
-- ============================================================================

-- 1.1 Add academic_year_id to subjects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subjects' 
    AND column_name = 'academic_year_id'
  ) THEN
    ALTER TABLE public.subjects 
    ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Added academic_year_id column to subjects table';
  ELSE
    RAISE NOTICE 'academic_year_id column already exists in subjects table';
  END IF;
END $$;

-- 1.2 Add academic_year_id to grades table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'grades' 
    AND column_name = 'academic_year_id'
  ) THEN
    ALTER TABLE public.grades 
    ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Added academic_year_id column to grades table';
  ELSE
    RAISE NOTICE 'academic_year_id column already exists in grades table';
  END IF;
END $$;

-- 1.3 Add academic_year_id to attendance_records table (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'attendance_records'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'attendance_records' 
      AND column_name = 'academic_year_id'
    ) THEN
      ALTER TABLE public.attendance_records 
      ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
      
      RAISE NOTICE 'Added academic_year_id column to attendance_records table';
    ELSE
      RAISE NOTICE 'academic_year_id column already exists in attendance_records table';
    END IF;
  ELSE
    RAISE NOTICE 'attendance_records table does not exist, skipping';
  END IF;
END $$;

-- 1.4 Add academic_year_id to attendance_locks table (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'attendance_locks'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'attendance_locks' 
      AND column_name = 'academic_year_id'
    ) THEN
      ALTER TABLE public.attendance_locks 
      ADD COLUMN academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL;
      
      RAISE NOTICE 'Added academic_year_id column to attendance_locks table';
    ELSE
      RAISE NOTICE 'academic_year_id column already exists in attendance_locks table';
    END IF;
  ELSE
    RAISE NOTICE 'attendance_locks table does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- PHASE 2: INDEXES - Create indexes for performance optimization
-- ============================================================================

-- 2.1 Index on subjects.academic_year_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'subjects' 
    AND indexname = 'idx_subjects_academic_year'
  ) THEN
    CREATE INDEX idx_subjects_academic_year ON public.subjects(academic_year_id);
    RAISE NOTICE 'Created index idx_subjects_academic_year';
  ELSE
    RAISE NOTICE 'Index idx_subjects_academic_year already exists';
  END IF;
END $$;

-- 2.2 Index on grades.academic_year_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'grades' 
    AND indexname = 'idx_grades_academic_year'
  ) THEN
    CREATE INDEX idx_grades_academic_year ON public.grades(academic_year_id);
    RAISE NOTICE 'Created index idx_grades_academic_year';
  ELSE
    RAISE NOTICE 'Index idx_grades_academic_year already exists';
  END IF;
END $$;

-- 2.3 Index on attendance_records.academic_year_id (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'attendance_records'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename = 'attendance_records' 
      AND indexname = 'idx_attendance_records_academic_year'
    ) THEN
      CREATE INDEX idx_attendance_records_academic_year ON public.attendance_records(academic_year_id);
      RAISE NOTICE 'Created index idx_attendance_records_academic_year';
    ELSE
      RAISE NOTICE 'Index idx_attendance_records_academic_year already exists';
    END IF;
  END IF;
END $$;

-- 2.4 Composite indexes for common queries
DO $$
BEGIN
  -- subjects(user_id, academic_year_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'subjects' 
    AND indexname = 'idx_subjects_user_year'
  ) THEN
    CREATE INDEX idx_subjects_user_year ON public.subjects(user_id, academic_year_id);
    RAISE NOTICE 'Created index idx_subjects_user_year';
  END IF;
  
  -- grades(user_id, academic_year_id)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'grades' 
    AND indexname = 'idx_grades_user_year'
  ) THEN
    CREATE INDEX idx_grades_user_year ON public.grades(user_id, academic_year_id);
    RAISE NOTICE 'Created index idx_grades_user_year';
  END IF;
END $$;

-- ============================================================================
-- PHASE 3: DATA MIGRATION - Populate academic_year_id from relationships
-- ============================================================================

-- 3.1 Migrate subjects: inherit academic_year_id from class
UPDATE public.subjects s
SET academic_year_id = c.academic_year_id
FROM public.classes c
WHERE s.class_id = c.id
AND s.academic_year_id IS NULL
AND c.academic_year_id IS NOT NULL;

-- Report migration results for subjects
DO $$
DECLARE
  migrated_count INTEGER;
  remaining_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM public.subjects WHERE academic_year_id IS NOT NULL;
  SELECT COUNT(*) INTO remaining_null FROM public.subjects WHERE academic_year_id IS NULL;
  RAISE NOTICE 'Subjects migration: % with academic_year_id, % still null', migrated_count, remaining_null;
END $$;

-- 3.2 Migrate grades: inherit academic_year_id from subject
UPDATE public.grades g
SET academic_year_id = s.academic_year_id
FROM public.subjects s
WHERE g.subject_id = s.id
AND g.academic_year_id IS NULL
AND s.academic_year_id IS NOT NULL;

-- Report migration results for grades
DO $$
DECLARE
  migrated_count INTEGER;
  remaining_null INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count FROM public.grades WHERE academic_year_id IS NOT NULL;
  SELECT COUNT(*) INTO remaining_null FROM public.grades WHERE academic_year_id IS NULL;
  RAISE NOTICE 'Grades migration: % with academic_year_id, % still null', migrated_count, remaining_null;
END $$;

-- 3.3 Migrate attendance_records: inherit academic_year_id from class
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'attendance_records'
  ) THEN
    UPDATE public.attendance_records ar
    SET academic_year_id = c.academic_year_id
    FROM public.classes c
    WHERE ar.class_id = c.id
    AND ar.academic_year_id IS NULL
    AND c.academic_year_id IS NOT NULL;
    
    RAISE NOTICE 'Migrated attendance_records academic_year_id from classes';
  END IF;
END $$;

-- ============================================================================
-- PHASE 4: HELPER FUNCTIONS - Create utility functions
-- ============================================================================

-- 4.1 Function to get active academic year for a user
CREATE OR REPLACE FUNCTION public.get_active_academic_year_id(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id 
  FROM public.academic_years 
  WHERE user_id = p_user_id 
  AND is_active = true 
  LIMIT 1;
$$;

-- 4.2 Function to check if data belongs to active academic year
CREATE OR REPLACE FUNCTION public.is_in_active_year(p_user_id UUID, p_academic_year_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.academic_years 
    WHERE id = p_academic_year_id 
    AND user_id = p_user_id 
    AND is_active = true
  );
$$;

-- 4.3 Function to auto-assign academic_year_id on insert (trigger function)
CREATE OR REPLACE FUNCTION public.auto_assign_academic_year()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only set if not already provided
  IF NEW.academic_year_id IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT id INTO NEW.academic_year_id
    FROM public.academic_years
    WHERE user_id = NEW.user_id
    AND is_active = true
    LIMIT 1;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PHASE 5: TRIGGERS - Auto-assign academic_year_id on insert
-- ============================================================================

-- 5.1 Trigger for subjects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_subjects_auto_year'
  ) THEN
    CREATE TRIGGER trg_subjects_auto_year
    BEFORE INSERT ON public.subjects
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_academic_year();
    
    RAISE NOTICE 'Created trigger trg_subjects_auto_year';
  ELSE
    RAISE NOTICE 'Trigger trg_subjects_auto_year already exists';
  END IF;
END $$;

-- 5.2 Trigger for grades
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_grades_auto_year'
  ) THEN
    CREATE TRIGGER trg_grades_auto_year
    BEFORE INSERT ON public.grades
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_assign_academic_year();
    
    RAISE NOTICE 'Created trigger trg_grades_auto_year';
  ELSE
    RAISE NOTICE 'Trigger trg_grades_auto_year already exists';
  END IF;
END $$;

-- ============================================================================
-- PHASE 6: RLS POLICIES (Optional but recommended)
-- ============================================================================

-- Note: These policies add an extra layer of security by filtering
-- data at the database level based on the active academic year.
-- Uncomment if you want database-level enforcement.

/*
-- Example: Policy for subjects to only show active year data
CREATE POLICY "subjects_active_year_policy" ON public.subjects
  FOR SELECT
  USING (
    academic_year_id IS NULL 
    OR academic_year_id = public.get_active_academic_year_id(auth.uid())
    OR user_id = auth.uid()
  );
*/

-- ============================================================================
-- PHASE 7: VERIFICATION QUERIES
-- ============================================================================

-- Run these queries after migration to verify data integrity

-- 7.1 Check subjects migration status
DO $$
DECLARE
  total_subjects INTEGER;
  subjects_with_year INTEGER;
  subjects_without_year INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_subjects FROM public.subjects;
  SELECT COUNT(*) INTO subjects_with_year FROM public.subjects WHERE academic_year_id IS NOT NULL;
  SELECT COUNT(*) INTO subjects_without_year FROM public.subjects WHERE academic_year_id IS NULL;
  
  RAISE NOTICE '=== SUBJECTS VERIFICATION ===';
  RAISE NOTICE 'Total subjects: %', total_subjects;
  RAISE NOTICE 'With academic_year_id: %', subjects_with_year;
  RAISE NOTICE 'Without academic_year_id: %', subjects_without_year;
END $$;

-- 7.2 Check grades migration status
DO $$
DECLARE
  total_grades INTEGER;
  grades_with_year INTEGER;
  grades_without_year INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_grades FROM public.grades;
  SELECT COUNT(*) INTO grades_with_year FROM public.grades WHERE academic_year_id IS NOT NULL;
  SELECT COUNT(*) INTO grades_without_year FROM public.grades WHERE academic_year_id IS NULL;
  
  RAISE NOTICE '=== GRADES VERIFICATION ===';
  RAISE NOTICE 'Total grades: %', total_grades;
  RAISE NOTICE 'With academic_year_id: %', grades_with_year;
  RAISE NOTICE 'Without academic_year_id: %', grades_without_year;
END $$;

-- 7.3 Check classes migration status
DO $$
DECLARE
  total_classes INTEGER;
  classes_with_year INTEGER;
  classes_without_year INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_classes FROM public.classes;
  SELECT COUNT(*) INTO classes_with_year FROM public.classes WHERE academic_year_id IS NOT NULL;
  SELECT COUNT(*) INTO classes_without_year FROM public.classes WHERE academic_year_id IS NULL;
  
  RAISE NOTICE '=== CLASSES VERIFICATION ===';
  RAISE NOTICE 'Total classes: %', total_classes;
  RAISE NOTICE 'With academic_year_id: %', classes_with_year;
  RAISE NOTICE 'Without academic_year_id: %', classes_without_year;
END $$;

-- Commit transaction
COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
-- 
-- After running this script:
-- 1. Verify all data has been migrated using the verification queries above
-- 2. For any remaining NULL academic_year_id records, manually assign them
--    or create a default academic year
-- 3. Consider adding NOT NULL constraints after all data is migrated:
--    ALTER TABLE subjects ALTER COLUMN academic_year_id SET NOT NULL;
--    ALTER TABLE grades ALTER COLUMN academic_year_id SET NOT NULL;
-- 4. Test the application thoroughly to ensure filtering works correctly
--
-- ROLLBACK SCRIPT (in case of issues):
-- To remove the added columns:
--   ALTER TABLE subjects DROP COLUMN IF EXISTS academic_year_id;
--   ALTER TABLE grades DROP COLUMN IF EXISTS academic_year_id;
--   DROP FUNCTION IF EXISTS public.get_active_academic_year_id;
--   DROP FUNCTION IF EXISTS public.is_in_active_year;
--   DROP FUNCTION IF EXISTS public.auto_assign_academic_year CASCADE;
-- ============================================================================
