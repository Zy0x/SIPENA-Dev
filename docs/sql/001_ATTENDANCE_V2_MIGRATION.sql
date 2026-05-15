-- =====================================================
-- SIPENA Attendance V2 Migration
-- Adds: Dispensasi (D) status, per-student notes, custom day events
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Update attendance_records: allow 'D' status and add note column
ALTER TABLE attendance_records 
  DROP CONSTRAINT IF EXISTS attendance_records_status_check;

ALTER TABLE attendance_records 
  ADD CONSTRAINT attendance_records_status_check 
  CHECK (status IN ('H', 'I', 'S', 'A', 'D'));

-- Add note column for per-student per-day notes
ALTER TABLE attendance_records 
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT NULL;

-- 2. Create attendance_day_events table for custom day labels
CREATE TABLE IF NOT EXISTS attendance_day_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT 'blue',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 3. Enable RLS on attendance_day_events
ALTER TABLE attendance_day_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for attendance_day_events
CREATE POLICY "Users can view own day events"
  ON attendance_day_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own day events"
  ON attendance_day_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own day events"
  ON attendance_day_events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own day events"
  ON attendance_day_events FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Index for performance
CREATE INDEX IF NOT EXISTS idx_attendance_day_events_user_date 
  ON attendance_day_events(user_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_note 
  ON attendance_records(class_id, date) WHERE note IS NOT NULL;

-- Done! The attendance system now supports:
-- - Dispensasi (D) status alongside H, I, S, A
-- - Per-student notes on each attendance record
-- - Custom day events/labels per date
