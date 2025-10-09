-- MANUAL SUPABASE SQL FIX FOR LEAGUES
-- Copy and paste this entire SQL into Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql/new

-- 1. Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  admin_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  is_public boolean NOT NULL DEFAULT false,
  max_members integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.league_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'left')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  UNIQUE(league_id, user_id)
);

-- 2. Enable RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies and create new permissive ones
DROP POLICY IF EXISTS "leagues_select_policy" ON public.leagues;
DROP POLICY IF EXISTS "Users can view leagues they are members of or public leagues" ON public.leagues;
DROP POLICY IF EXISTS "Only authenticated users can create leagues" ON public.leagues;

-- Create very permissive policies to start
CREATE POLICY "leagues_select_policy" ON public.leagues 
FOR SELECT USING (true);

CREATE POLICY "leagues_insert_policy" ON public.leagues 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "leagues_update_policy" ON public.leagues 
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- League members policies
DROP POLICY IF EXISTS "league_members_select_policy" ON public.league_members;
DROP POLICY IF EXISTS "Users can view memberships for leagues they can see" ON public.league_members;
DROP POLICY IF EXISTS "Users can join leagues" ON public.league_members;

CREATE POLICY "league_members_select_policy" ON public.league_members 
FOR SELECT USING (true);

CREATE POLICY "league_members_insert_policy" ON public.league_members 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "league_members_update_policy" ON public.league_members 
FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 4. Create the essential functions
CREATE OR REPLACE FUNCTION public.create_league(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT false,
  p_max_members integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  league_record record;
  user_profile_id uuid;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  -- Create the league
  INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
  VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members)
  RETURNING * INTO league_record;

  -- Auto-approve the admin as a member
  INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
  VALUES (league_record.id, user_profile_id, 'approved', now(), user_profile_id);

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'invite_code', league_record.invite_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.join_league(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  league_record record;
  user_profile_id uuid;
  member_count integer;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  -- Find the league
  SELECT * INTO league_record
  FROM public.leagues
  WHERE invite_code = p_invite_code;

  IF league_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'League not found'
    );
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = league_record.id AND user_id = user_profile_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Already a member of this league'
    );
  END IF;

  -- Join the league (auto-approve for now to keep it simple)
  INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
  VALUES (league_record.id, user_profile_id, 'approved', now(), league_record.admin_user_id);

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'league_name', league_record.name,
    'status', 'approved'
  );
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leagues_admin ON public.leagues(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);
CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);

-- DONE! Your leagues system should now work.