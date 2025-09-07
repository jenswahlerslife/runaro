-- Additional functions needed by the leagues library

-- Function to create a game
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
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check if user is admin of the league
  IF NOT EXISTS (
    SELECT 1 FROM public.leagues 
    WHERE id = p_league_id AND admin_user_id = user_profile_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Only league admins can create games');
  END IF;

  -- Count approved members
  SELECT COUNT(*) INTO member_count 
  FROM public.league_members 
  WHERE league_id = p_league_id AND status = 'approved';

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

-- Function to set a player base
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
  base_record record;
BEGIN
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check if game exists and is in setup
  IF NOT EXISTS (
    SELECT 1 FROM public.games 
    WHERE id = p_game_id AND status = 'setup'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Game not found or not in setup phase');
  END IF;

  -- Get activity details
  SELECT * INTO activity_record 
  FROM public.user_activities 
  WHERE id = p_activity_id AND user_id = user_profile_id;

  IF activity_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Activity not found or not owned by user');
  END IF;

  -- Set activity as base and mark as base activity
  UPDATE public.user_activities 
  SET is_base = true 
  WHERE user_id = user_profile_id;

  UPDATE public.user_activities 
  SET is_base = false 
  WHERE user_id = user_profile_id AND id != p_activity_id;

  UPDATE public.user_activities 
  SET is_base = true 
  WHERE id = p_activity_id;

  -- Insert or update player base
  INSERT INTO public.player_bases (game_id, user_id, activity_id, base_date)
  VALUES (p_game_id, user_profile_id, p_activity_id, activity_record.start_date::timestamptz)
  ON CONFLICT (game_id, user_id) DO UPDATE SET
    activity_id = p_activity_id,
    base_date = activity_record.start_date::timestamptz,
    created_at = now()
  RETURNING * INTO base_record;

  RETURN json_build_object(
    'success', true,
    'activity_name', activity_record.name,
    'base_date', base_record.base_date
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
  start_date timestamptz := now();
  end_date timestamptz := now() + interval '30 days';
BEGIN
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Get game and check if user is league admin
  SELECT g.*, l.admin_user_id INTO game_record
  FROM public.games g
  JOIN public.leagues l ON g.league_id = l.id
  WHERE g.id = p_game_id;

  IF game_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;

  IF game_record.admin_user_id != user_profile_id THEN
    RETURN json_build_object('success', false, 'error', 'Only league admins can start games');
  END IF;

  IF game_record.status != 'setup' THEN
    RETURN json_build_object('success', false, 'error', 'Game is not in setup phase');
  END IF;

  -- Count bases set
  SELECT COUNT(*) INTO base_count 
  FROM public.player_bases 
  WHERE game_id = p_game_id;

  IF base_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'At least 2 players must set their bases');
  END IF;

  -- Start the game
  UPDATE public.games 
  SET status = 'active',
      start_date = start_date,
      end_date = end_date
  WHERE id = p_game_id;

  -- Calculate initial territories for all players
  PERFORM public.refresh_user_territory(pb.user_id) 
  FROM public.player_bases pb 
  WHERE pb.game_id = p_game_id;

  RETURN json_build_object(
    'success', true,
    'start_date', start_date,
    'end_date', end_date,
    'base_count', base_count,
    'member_count', base_count
  );
END;
$$;

-- Function to manage league membership
CREATE OR REPLACE FUNCTION public.manage_league_membership(
  p_league_id uuid,
  p_user_id uuid,
  p_action text
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
  SELECT id INTO admin_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF admin_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check if user is league admin
  IF NOT EXISTS (
    SELECT 1 FROM public.leagues 
    WHERE id = p_league_id AND admin_user_id = admin_profile_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Only league admins can manage memberships');
  END IF;

  new_status := CASE 
    WHEN p_action = 'approve' THEN 'approved'
    WHEN p_action = 'reject' THEN 'rejected'
    ELSE 'pending'
  END;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_game(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manage_league_membership(uuid, uuid, text) TO authenticated;

SELECT 'Additional functions created successfully!' as status;