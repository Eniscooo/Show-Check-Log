-- Run this in your Supabase SQL Editor to create the necessary tables and buckets for the newly added features.

-- 1. Activity Log Table
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action TEXT NOT NULL,
    description TEXT NOT NULL,
    show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
    user_id UUID,
    user_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Realtime for activity_log (using safe idempotent approach below)

-- 2. Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    priority TEXT DEFAULT 'normal',
    author_id UUID NOT NULL,
    author_name TEXT NOT NULL,
    pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on Realtime for announcements (using safe idempotent approach below)

-- 3. Messenger System Tables
CREATE TABLE IF NOT EXISTS chat_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_email TEXT NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    content TEXT,
    file_url TEXT,
    file_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Schema Migration Fix: Since the old table used 'show_id', we must alter it explicitly if it hasn't mapped.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'show_id') THEN
        ALTER TABLE chat_messages DROP COLUMN show_id CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'group_id') THEN
        ALTER TABLE chat_messages ADD COLUMN group_id UUID REFERENCES chat_groups(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Turn on Realtime safely (idempotent setup to prevent ERROR: 42710)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_log') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'announcements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_groups') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_groups;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_group_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_group_members;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chat_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
END $$;

-- 4. Screenshots Storage Bucket
-- Ensure the storage extension is loaded and you create the bucket natively
-- If inserting into storage.buckets fails, you might need to create it manually in the Supabase Dashboard UI -> Storage
INSERT INTO storage.buckets (id, name, public) 
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for the storage bucket (to allow authenticated users to upload/delete their screenshots)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'screenshots' );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload screenshots' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Authenticated users can upload screenshots" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'screenshots' AND auth.role() = 'authenticated' );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update/delete own screenshots' AND tablename = 'objects' AND schemaname = 'storage') THEN
        CREATE POLICY "Users can update/delete own screenshots" ON storage.objects FOR DELETE USING ( bucket_id = 'screenshots' AND auth.uid() = owner );
    END IF;
END $$;

-- Apply explicit RLS and ALLOW ALL policies for the chat messenger system
ALTER TABLE chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_chat_groups' AND tablename = 'chat_groups' AND schemaname = 'public') THEN
        CREATE POLICY "allow_all_chat_groups" ON chat_groups FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_chat_group_members' AND tablename = 'chat_group_members' AND schemaname = 'public') THEN
        CREATE POLICY "allow_all_chat_group_members" ON chat_group_members FOR ALL USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'allow_all_chat_messages' AND tablename = 'chat_messages' AND schemaname = 'public') THEN
        CREATE POLICY "allow_all_chat_messages" ON chat_messages FOR ALL USING (true);
    END IF;
END $$;

-- Explicitly flush the Supabase API Schema Cache so the frontend instantly sees the new 'group_id' columns
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- RPC: get_user_id_by_email
-- Allows the frontend to look up an auth.users UUID by email address.
-- This runs with SECURITY DEFINER so it can access auth.users safely.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_id_by_email(lookup_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  found_id UUID;
BEGIN
  SELECT id INTO found_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(lookup_email)
  LIMIT 1;
  RETURN found_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_id_by_email(TEXT) TO authenticated;

-- ============================================================================
-- Make chat_group_members visible to ALL authenticated users (not just owner).
-- This ensures any teammate can see all groups and join them.
-- ============================================================================
DROP POLICY IF EXISTS "allow_all_chat_groups" ON chat_groups;
CREATE POLICY "allow_all_chat_groups" ON chat_groups
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_chat_group_members" ON chat_group_members;
CREATE POLICY "allow_all_chat_group_members" ON chat_group_members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "allow_all_chat_messages" ON chat_messages;
CREATE POLICY "allow_all_chat_messages" ON chat_messages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- RPC: get_user_by_username
-- Looks up a user by their username stored in raw_user_meta_data.
-- Returns their UUID and email so the frontend can add them to a group.
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_by_username(lookup_username TEXT)
RETURNS TABLE(user_id UUID, user_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT id, email::TEXT
  FROM auth.users
  WHERE LOWER(raw_user_meta_data->>'username') = LOWER(lookup_username)
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_by_username(TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Shift Logs — for Clock In / Clock Out / Break / Weekly Reports
-- ============================================================================
CREATE TABLE IF NOT EXISTS shift_logs (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL,
    user_name       TEXT NOT NULL,
    user_email      TEXT,
    clock_in        TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_out       TIMESTAMP WITH TIME ZONE,
    break_start     TIMESTAMP WITH TIME ZONE,     -- timestamp when current break started
    break_minutes   INTEGER DEFAULT 0,            -- cumulative break minutes
    notes           TEXT,
    status          TEXT DEFAULT 'active',        -- 'active' | 'on_break' | 'completed'
    total_hours     DECIMAL(6, 2),                -- calculated on clock-out
    shift_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE shift_logs ENABLE ROW LEVEL SECURITY;

-- Each user can read/write only their own shifts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shift_logs_own' AND tablename = 'shift_logs' AND schemaname = 'public') THEN
        CREATE POLICY "shift_logs_own" ON shift_logs FOR ALL TO authenticated
            USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Allow admin / managers to read all shifts (for team reports)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'shift_logs_read_all' AND tablename = 'shift_logs' AND schemaname = 'public') THEN
        CREATE POLICY "shift_logs_read_all" ON shift_logs FOR SELECT TO authenticated
            USING (true);
    END IF;
END $$;

-- Enable realtime on shift_logs
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'shift_logs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE shift_logs;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Added columns for Group Photo and Channel/DM typing
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_groups' AND column_name = 'avatar_url') THEN
        ALTER TABLE chat_groups ADD COLUMN avatar_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_groups' AND column_name = 'type') THEN
        ALTER TABLE chat_groups ADD COLUMN type TEXT DEFAULT 'channel';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
