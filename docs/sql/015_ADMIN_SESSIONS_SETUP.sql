-- Migration: Admin Sessions Stateful Tracking
-- Create table for tracking active admin sessions securely

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- No public policies are created because this table is only accessed via Supabase Edge Functions using the service_role client.
-- This ensures maximum security against unauthorized frontend queries.

-- Create index on token_hash for fast lookups during token verification
CREATE INDEX IF NOT EXISTS admin_sessions_token_hash_idx ON public.admin_sessions (token_hash);

-- Create index on expires_at to allow efficient cleanup of expired sessions
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON public.admin_sessions (expires_at);
