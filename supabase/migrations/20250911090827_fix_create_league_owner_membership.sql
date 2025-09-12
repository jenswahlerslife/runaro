-- Fix create_league function to properly add owner to league_members with correct schema
-- This ensures that when a user creates a league, they are automatically added as owner/member

CREATE OR REPLACE FUNCTION public.create_league(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT false,
  p_max_members integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  league_record record;
  user_id_val uuid;
BEGIN
  -- Get the current user ID
  user_id_val := auth.uid();
  
  IF user_id_val IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Create the league
  INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
  VALUES (p_name, p_description, user_id_val, p_is_public, p_max_members)
  RETURNING * INTO league_record;

  -- Add the creator as owner in league_members table
  INSERT INTO public.league_members (league_id, user_id, role, joined_at)
  VALUES (league_record.id, user_id_val, 'owner', now());

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'invite_code', league_record.invite_code
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to create league: ' || SQLERRM
    );
END;
$$;

-- Update join_league function to match current schema as well
CREATE OR REPLACE FUNCTION public.join_league(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  league_record record;
  user_id_val uuid;
  member_count integer;
BEGIN
  -- Get the current user ID
  user_id_val := auth.uid();
  
  IF user_id_val IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Find the league by invite code
  SELECT * INTO league_record FROM public.leagues WHERE invite_code = p_invite_code;

  IF league_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'League not found');
  END IF;

  -- Check if user is already a member
  IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = league_record.id AND user_id = user_id_val) THEN
    RETURN json_build_object('success', false, 'error', 'Already a member of this league');
  END IF;

  -- Count current members
  SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = league_record.id;

  IF member_count >= league_record.max_members THEN
    RETURN json_build_object('success', false, 'error', 'League is full');
  END IF;

  -- For public leagues, add directly as member
  -- For private leagues, create a join request
  IF league_record.is_public THEN
    -- Add directly as member
    INSERT INTO public.league_members (league_id, user_id, role, joined_at)
    VALUES (league_record.id, user_id_val, 'member', now());
    
    RETURN json_build_object(
      'success', true,
      'league_id', league_record.id,
      'league_name', league_record.name,
      'status', 'approved'
    );
  ELSE
    -- Create join request for private leagues
    INSERT INTO public.league_join_requests (league_id, user_id, status)
    VALUES (league_record.id, user_id_val, 'pending');
    
    RETURN json_build_object(
      'success', true,
      'league_id', league_record.id,
      'league_name', league_record.name,
      'status', 'pending'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to join league: ' || SQLERRM
    );
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.create_league(text, text, boolean, integer) OWNER TO postgres;
ALTER FUNCTION public.join_league(text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_league(text, text, boolean, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_league(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;

SELECT 'create_league function updated to properly add owner to league_members' as status;