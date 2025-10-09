-- Complete League Functions for Supabase
-- Run this entire script in the Supabase SQL Editor

-- Function to create a new league
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

-- Function to join a league
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

  -- Check member limit
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = league_record.id AND status = 'approved';

  IF member_count >= league_record.max_members THEN
    RETURN json_build_object(
      'success', false,
      'error', 'League is full'
    );
  END IF;

  -- Join the league (pending approval unless it's a public league)
  INSERT INTO public.league_members (league_id, user_id, status)
  VALUES (
    league_record.id, 
    user_profile_id, 
    CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END
  );

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'league_name', league_record.name,
    'status', CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END
  );
END;
$$;

-- Function to approve/reject league membership
CREATE OR REPLACE FUNCTION public.manage_league_membership(
  p_league_id uuid,
  p_user_id uuid,
  p_action text -- 'approve' or 'reject'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_profile_id uuid;
  new_status text;
BEGIN
  -- Get requesting user's profile ID
  SELECT id INTO admin_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Check if user is league admin
  IF NOT EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = p_league_id AND admin_user_id = admin_profile_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to manage this league'
    );
  END IF;

  -- Set new status
  new_status := CASE 
    WHEN p_action = 'approve' THEN 'approved'
    WHEN p_action = 'reject' THEN 'rejected'
    ELSE 'pending'
  END;

  -- Update membership
  UPDATE public.league_members
  SET status = new_status,
      approved_at = CASE WHEN new_status = 'approved' THEN now() ELSE NULL END,
      approved_by = CASE WHEN new_status = 'approved' THEN admin_profile_id ELSE NULL END
  WHERE league_id = p_league_id AND user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'action', p_action,
    'new_status', new_status
  );
END;
$$;

-- Function to create a new game
CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  game_record record;
  user_profile_id uuid;
  member_count integer;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Check if user is league admin
  IF NOT EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = p_league_id AND admin_user_id = user_profile_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to create games in this league'
    );
  END IF;

  -- Check if league has at least 2 approved members
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = p_league_id AND status = 'approved';

  IF member_count < 2 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'League needs at least 2 approved members to create a game'
    );
  END IF;

  -- Create the game
  INSERT INTO public.games (league_id, name, created_by)
  VALUES (p_league_id, p_name, user_profile_id)
  RETURNING * INTO game_record;

  RETURN json_build_object(
    'success', true,
    'game_id', game_record.id,
    'game_name', game_record.name,
    'member_count', member_count
  );
END;
$$;

-- Function to set player base
CREATE OR REPLACE FUNCTION public.set_player_base(
  p_game_id uuid,
  p_activity_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id uuid;
  activity_record record;
  game_record record;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Verify user is member of the game's league
  SELECT g.* INTO game_record
  FROM public.games g
  JOIN public.league_members lm ON g.league_id = lm.league_id
  WHERE g.id = p_game_id AND lm.user_id = user_profile_id AND lm.status = 'approved';

  IF game_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to participate in this game'
    );
  END IF;

  -- Get activity details
  SELECT * INTO activity_record
  FROM public.user_activities
  WHERE id = p_activity_id AND user_id = user_profile_id;

  IF activity_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Activity not found or not owned by user'
    );
  END IF;

  -- Insert or update player base
  INSERT INTO public.player_bases (game_id, user_id, activity_id, base_date)
  VALUES (p_game_id, user_profile_id, p_activity_id, activity_record.start_date)
  ON CONFLICT (game_id, user_id)
  DO UPDATE SET 
    activity_id = EXCLUDED.activity_id,
    base_date = EXCLUDED.base_date,
    territory_size_km2 = 0,
    last_calculated_at = NULL;

  -- Update user_activities to mark this as base for this game context
  UPDATE public.user_activities
  SET is_base = false
  WHERE user_id = user_profile_id;
  
  UPDATE public.user_activities
  SET is_base = true
  WHERE id = p_activity_id;

  RETURN json_build_object(
    'success', true,
    'activity_name', activity_record.name,
    'base_date', activity_record.start_date
  );
END;
$$;

-- Function to start a game
CREATE OR REPLACE FUNCTION public.start_game(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_profile_id uuid;
  game_record record;
  base_count integer;
  member_count integer;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Check if user is league admin
  SELECT g.* INTO game_record
  FROM public.games g
  JOIN public.leagues l ON g.league_id = l.id
  WHERE g.id = p_game_id AND l.admin_user_id = user_profile_id;

  IF game_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to start this game'
    );
  END IF;

  -- Count approved members
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = game_record.league_id AND status = 'approved';

  -- Count players with bases set
  SELECT COUNT(*) INTO base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  IF member_count < 2 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Need at least 2 approved members'
    );
  END IF;

  IF base_count < 2 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Need at least 2 players with bases set'
    );
  END IF;

  -- Start the game (30 days from now)
  UPDATE public.games
  SET status = 'active',
      start_date = now(),
      end_date = now() + interval '30 days'
  WHERE id = p_game_id;

  RETURN json_build_object(
    'success', true,
    'start_date', now(),
    'end_date', now() + interval '30 days',
    'member_count', member_count,
    'base_count', base_count
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_league_membership(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game(uuid) TO authenticated;