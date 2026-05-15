-- =====================================================
-- ACTIVITY LOGS & GUEST NOTIFICATIONS SETUP (FIXED)
-- Run this SQL in your Supabase SQL Editor
-- =====================================================

-- 1. Activity Logs Table (for Dashboard)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('owner', 'guest')),
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can insert their own activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow insert for guest activities" ON public.activity_logs;
CREATE POLICY "Allow insert for guest activities"
  ON public.activity_logs FOR INSERT
  WITH CHECK (true);

-- 2. Guest Users Table (for storing guest info)
-- Check if table exists and has the correct structure
DO $$
BEGIN
  -- Create table if not exists
  CREATE TABLE IF NOT EXISTS public.guest_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_access_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email, owner_user_id)
  );

  -- Add owner_user_id column if it doesn't exist (for existing tables)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'guest_users' 
    AND column_name = 'owner_user_id'
  ) THEN
    -- If you have an existing guest_users table without owner_user_id
    -- You may need to add it. Adjust as needed based on your data.
    ALTER TABLE public.guest_users ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index
CREATE INDEX IF NOT EXISTS idx_guest_users_owner ON public.guest_users(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_guest_users_email ON public.guest_users(email);

-- Enable RLS
ALTER TABLE public.guest_users ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view guests that accessed their data" ON public.guest_users;
CREATE POLICY "Users can view guests that accessed their data"
  ON public.guest_users FOR SELECT
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Allow guest user creation" ON public.guest_users;
CREATE POLICY "Allow guest user creation"
  ON public.guest_users FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow guest user updates" ON public.guest_users;
CREATE POLICY "Allow guest user updates"
  ON public.guest_users FOR UPDATE
  USING (true);

-- 3. Guest Audit Logs Table (for detailed guest activities)
-- First, check if table exists and needs migration
DO $$
BEGIN
  -- Check if guest_audit_logs exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'guest_audit_logs'
  ) THEN
    -- Add owner_user_id if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'guest_audit_logs' 
      AND column_name = 'owner_user_id'
    ) THEN
      -- Add the column
      ALTER TABLE public.guest_audit_logs 
        ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
      
      -- Try to populate it from shared_links (if possible)
      UPDATE public.guest_audit_logs gal
      SET owner_user_id = sl.user_id
      FROM public.shared_links sl
      WHERE gal.shared_link_id = sl.id
      AND gal.owner_user_id IS NULL;
    END IF;
  END IF;
END $$;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.guest_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_link_id UUID NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_email TEXT NOT NULL,
  guest_name TEXT,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_shared_link ON public.guest_audit_logs(shared_link_id);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_owner ON public.guest_audit_logs(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_guest_audit_logs_created_at ON public.guest_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.guest_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their guests' audit logs" ON public.guest_audit_logs;
CREATE POLICY "Users can view their guests' audit logs"
  ON public.guest_audit_logs FOR SELECT
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Allow guest audit log insertion" ON public.guest_audit_logs;
CREATE POLICY "Allow guest audit log insertion"
  ON public.guest_audit_logs FOR INSERT
  WITH CHECK (true);

-- 4. Update notifications table to support guest access notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'data'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN data JSONB DEFAULT '{}';
  END IF;
END $$;

-- 5. Grant permissions
GRANT ALL ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO anon;
GRANT ALL ON public.guest_users TO authenticated;
GRANT ALL ON public.guest_users TO anon;
GRANT ALL ON public.guest_audit_logs TO authenticated;
GRANT ALL ON public.guest_audit_logs TO anon;

-- =====================================================
-- VERIFICATION
-- Run these queries to verify the setup
-- =====================================================

-- Check activity_logs
SELECT 'activity_logs' as table_name, COUNT(*) as record_count FROM public.activity_logs
UNION ALL
SELECT 'guest_users', COUNT(*) FROM public.guest_users
UNION ALL
SELECT 'guest_audit_logs', COUNT(*) FROM public.guest_audit_logs;

-- Check columns
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('activity_logs', 'guest_users', 'guest_audit_logs')
ORDER BY table_name, ordinal_position;
