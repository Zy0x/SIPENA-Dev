-- Migration: Attendance V2 Holiday Class Scope
-- Add class_id column to attendance_v2_holidays for class-specific holidays and update unique constraint

-- 1. Add class_id referencing public.classes
ALTER TABLE public.attendance_v2_holidays 
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

-- 2. Drop old unique constraint
ALTER TABLE public.attendance_v2_holidays 
DROP CONSTRAINT IF EXISTS attendance_v2_holidays_user_id_date_key;

-- 3. Create a unique index that supports nullable class_id values (global holidays)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_v2_holidays_unique_date_class
ON public.attendance_v2_holidays (user_id, date, COALESCE(class_id, '00000000-0000-0000-0000-000000000000'::uuid));
