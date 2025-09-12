-- Restore atomic league creation - back to simple, working approach
-- Fix the foreign key constraint and create atomic RPC

-- 1) Ensure league_members.user_id references auth.users (the correct way)
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'league_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.league_members DROP CONSTRAINT league_members_user_id_fkey;
  END IF;
END $$;

-- Add proper foreign key constraint to auth.users (not profiles)
ALTER TABLE public.league_members 
ADD CONSTRAINT league_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2) Ensure created_by column exists in leagues table
ALTER TABLE public.leagues 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- 3) Create simple atomic league creation function
CREATE OR REPLACE FUNCTION public.create_league_with_owner(
  p_name text,
  p_description text DEFAULT NULL
) RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_league public.leagues;
BEGIN
  -- Check authentication
  IF v_user IS NULL THEN 
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the league
  INSERT INTO public.leagues (name, description, created_by, admin_user_id, invite_code)
  VALUES (
    p_name, 
    p_description, 
    v_user,
    v_user,
    substring(md5(random()::text), 1, 8)
  )
  RETURNING * INTO v_league;

  -- Add the creator as owner in league_members table
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (v_league.id, v_user, 'owner');

  RETURN v_league;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text) TO authenticated;

-- 4) Ensure proper RLS policies for league_members
DO $$
BEGIN
  -- Drop and recreate policies to ensure they are up to date
  DROP POLICY IF EXISTS "Users can view their own league memberships" ON public.league_members;
  CREATE POLICY "Users can view their own league memberships"
    ON public.league_members FOR SELECT
    USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "League admins can view all memberships for their leagues" ON public.league_members;
  CREATE POLICY "League admins can view all memberships for their leagues"
    ON public.league_members FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.leagues 
        WHERE leagues.id = league_members.league_id 
        AND leagues.admin_user_id = auth.uid()
      )
    );
END $$;

-- 5) RLS for leagues table
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can view leagues" ON public.leagues;
  CREATE POLICY "Anyone can view leagues"
    ON public.leagues FOR SELECT
    TO authenticated
    USING (true);
END $$;

SELECT 'Restored atomic league creation with proper auth.users references' as status;