-- Fix subscription schema in start_game function

CREATE OR REPLACE FUNCTION public.start_game(p_game_id uuid, p_duration_days int DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin   boolean;
  v_plan       text;
  v_league_id  uuid;
  v_uid        uuid := auth.uid();
  v_allowed_max int := 14;
  user_profile_id uuid;
  game_record record;
  base_count integer;
BEGIN
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = v_uid;
  
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

  -- Subscription gating with correct schema
  SELECT CASE WHEN s.subscribed AND s.subscription_tier IN ('pro','enterprise') THEN 'pro' ELSE 'free' END
    INTO v_plan
  FROM public.subscribers s
  WHERE s.user_id = v_uid
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_plan = 'pro' THEN
    v_allowed_max := 30;
  END IF;

  IF p_duration_days IS NULL THEN
    p_duration_days := 14;
  END IF;

  IF p_duration_days > v_allowed_max THEN
    RETURN json_build_object('success', false, 'error', format('Duration exceeds your plan limit (%s days).', v_allowed_max));
  END IF;

  -- Count bases set
  SELECT COUNT(*) INTO base_count 
  FROM public.player_bases 
  WHERE game_id = p_game_id;

  -- save duration (game activates when all players have base)
  UPDATE public.games
     SET duration_days = p_duration_days,
         status = 'setup'
   WHERE id = p_game_id;

  -- if all players already have base, activate now
  PERFORM public.maybe_activate_game(p_game_id);

  RETURN json_build_object(
    'success', true,
    'duration_days', p_duration_days,
    'base_count', base_count,
    'plan', v_plan,
    'allowed_max', v_allowed_max
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_game(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_game(uuid, int) TO authenticated;

SELECT 'Subscription schema fix applied successfully!' as status;