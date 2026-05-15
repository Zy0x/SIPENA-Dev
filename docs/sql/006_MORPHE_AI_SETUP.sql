-- ============================================
-- MORPHE AI CHAT — Database Schema
-- ============================================
-- Jalankan SQL ini di Supabase SQL Editor
-- ============================================

-- 1. Tabel Sessions
CREATE TABLE IF NOT EXISTS morphe_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Chat Baru',
  system_prompt TEXT,
  model TEXT DEFAULT 'llama-3.3-70b-versatile',
  is_pinned BOOLEAN DEFAULT false,
  summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabel Messages
CREATE TABLE IF NOT EXISTS morphe_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES morphe_sessions(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  token_count INTEGER DEFAULT 0,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_morphe_sessions_user ON morphe_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_morphe_messages_session ON morphe_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_morphe_sessions_updated ON morphe_sessions(updated_at DESC);

-- 4. RLS
ALTER TABLE morphe_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE morphe_messages ENABLE ROW LEVEL SECURITY;

-- Sessions: user can CRUD own sessions
CREATE POLICY "Users own sessions" ON morphe_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Messages: user can CRUD messages in own sessions
CREATE POLICY "Users manage own messages" ON morphe_messages
  FOR ALL USING (
    session_id IN (SELECT id FROM morphe_sessions WHERE user_id = auth.uid())
  )
  WITH CHECK (
    session_id IN (SELECT id FROM morphe_sessions WHERE user_id = auth.uid())
  );

-- 5. Auto-update updated_at on sessions
CREATE OR REPLACE FUNCTION update_morphe_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE morphe_sessions SET updated_at = now() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_morphe_message_update_session
  AFTER INSERT ON morphe_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_morphe_session_timestamp();
