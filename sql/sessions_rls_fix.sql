-- Fix RLS policies for the main sessions table
-- Run this in Supabase → SQL Editor

-- Enable RLS (in case it wasn't enabled)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe to re-run)
DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;
DROP POLICY IF EXISTS "sessions_delete_own" ON public.sessions;
DROP POLICY IF EXISTS "Users manage own sessions" ON public.sessions;

-- SELECT: each user sees only their own sessions
CREATE POLICY "sessions_select_own"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: each user can only insert rows with their own user_id
CREATE POLICY "sessions_insert_own"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
