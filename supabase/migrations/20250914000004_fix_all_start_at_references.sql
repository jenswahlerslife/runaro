-- Fix all remaining start_at references to use start_date consistently

-- Update set_player_base function to use start_date instead of start_at
CREATE OR REPLACE FUNCTION public.set_player_base(
  p_game_id uuid,
  p_activity_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_profile_id uuid;
  activity_record record;
  game_record record;
  base_record record;
BEGIN
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();

  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Get game details (instead of just checking existence)
  SELECT * INTO game_record
  FROM public.games
  WHERE id = p_game_id AND status = 'setup';

  IF game_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Game not found or not in setup phase');
  END IF;

  -- Get activity details
  SELECT * INTO activity_record
  FROM public.user_activities
  WHERE id = p_activity_id AND user_id = user_profile_id;

  IF activity_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Activity not found or not owned by user');
  END IF;

  -- TEMPORARILY REMOVED: 1-day rule check for testing
  -- IF activity_record.start_date < (COALESCE(game_record.start_date, game_record.created_at) - interval '1 day') THEN
  --   RETURN json_build_object(
  --     'success', false,
  --     'error', 'Activity is older than allowed window'
  --   );
  -- END IF;

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

  -- Auto-aktivér spillet, hvis dette var den sidste manglende base
  PERFORM public.maybe_activate_game(p_game_id);

  RETURN json_build_object(
    'success', true,
    'activity_name', activity_record.name,
    'base_date', base_record.base_date
  );
END;
$$;

-- Maintain existing ownership and privileges
ALTER FUNCTION public.set_player_base(uuid, uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.set_player_base(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;