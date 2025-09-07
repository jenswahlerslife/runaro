-- Safety timeouts
SET LOCAL statement_timeout = '30s';  -- Longer timeout for complex spatial operations
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

-- Function to calculate territory for a player in a game
CREATE OR REPLACE FUNCTION public.calculate_player_territory(
  p_game_id uuid,
  p_user_id uuid,
  p_tolerance_m integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_record record;
  territory_count integer := 0;
  total_activities integer := 0;
  territory_geometry geometry;
BEGIN
  -- Get player's base for this game
  SELECT pb.*, ua.route as base_route
  INTO base_record
  FROM public.player_bases pb
  JOIN public.user_activities ua ON pb.activity_id = ua.id
  WHERE pb.game_id = p_game_id AND pb.user_id = p_user_id;

  IF base_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No base found for player in this game'
    );
  END IF;

  -- Count total activities after base date
  SELECT COUNT(*) INTO total_activities
  FROM public.user_activities
  WHERE user_id = p_user_id
    AND start_date >= base_record.base_date
    AND route IS NOT NULL;

  -- Calculate territory using recursive CTE
  WITH RECURSIVE territory AS (
    -- Base case: start with the base activity
    SELECT ua.id, ua.route, 1 as depth
    FROM public.user_activities ua
    WHERE ua.id = base_record.activity_id
      AND ua.route IS NOT NULL

    UNION

    -- Recursive case: find activities connected to territory
    SELECT ua2.id, ua2.route, t.depth + 1 as depth
    FROM public.user_activities ua2
    JOIN territory t ON (
      ua2.user_id = p_user_id
      AND ua2.route IS NOT NULL
      AND ua2.id != t.id
      AND ua2.start_date >= base_record.base_date  -- Only activities after base
      AND ST_DWithin(ua2.route::geography, t.route::geography, p_tolerance_m)
    )
    WHERE t.depth < 50  -- Prevent excessive recursion
  )
  SELECT COUNT(*), ST_Union(route) 
  INTO territory_count, territory_geometry
  FROM territory;

  -- Calculate territory area in km²
  DECLARE
    territory_area_km2 numeric := 0;
  BEGIN
    IF territory_geometry IS NOT NULL THEN
      territory_area_km2 := ST_Area(ST_ConvexHull(territory_geometry)::geography) / 1000000.0;
    END IF;
  END;

  -- Update player base with territory info
  UPDATE public.player_bases
  SET territory_size_km2 = territory_area_km2,
      last_calculated_at = now()
  WHERE game_id = p_game_id AND user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'territory_count', territory_count,
    'total_activities', total_activities,
    'territory_area_km2', territory_area_km2,
    'base_date', base_record.base_date
  );
END;
$$;

-- Function to check for territory takeovers when new activity is added
CREATE OR REPLACE FUNCTION public.check_territory_takeover(
  p_game_id uuid,
  p_new_activity_id uuid,
  p_tolerance_m integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_activity_record record;
  takeover_record record;
  intersection_point geometry;
  takeovers_created integer := 0;
BEGIN
  -- Get the new activity details
  SELECT ua.*, pb.user_id as owner_id
  INTO new_activity_record
  FROM public.user_activities ua
  JOIN public.player_bases pb ON (
    ua.user_id = pb.user_id 
    AND ua.start_date >= pb.base_date
    AND EXISTS (SELECT 1 FROM public.games WHERE id = p_game_id)
  )
  WHERE ua.id = p_new_activity_id;

  IF new_activity_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Activity not found or not valid for game'
    );
  END IF;

  -- Find intersections with other players' territories
  FOR takeover_record IN
    SELECT DISTINCT
      pb.user_id as victim_user_id,
      ua.id as victim_activity_id,
      ST_Intersection(ua.route, new_activity_record.route) as intersection_geom
    FROM public.player_bases pb
    JOIN public.user_activities ua ON (
      ua.user_id = pb.user_id
      AND ua.start_date >= pb.base_date
      AND ua.route IS NOT NULL
      AND pb.game_id = p_game_id
      AND pb.user_id != new_activity_record.owner_id  -- Different player
    )
    WHERE ST_Intersects(ua.route, new_activity_record.route)
      OR ST_DWithin(ua.route::geography, new_activity_record.route::geography, p_tolerance_m)
  LOOP
    -- Calculate intersection point (centroid of intersection)
    intersection_point := ST_Centroid(takeover_record.intersection_geom);
    
    -- Log the takeover
    INSERT INTO public.territory_takeovers (
      game_id,
      taken_from_user_id,
      taken_by_user_id,
      activity_id,
      intersection_point,
      territory_lost_km2,  -- Will be calculated later
      territory_gained_km2  -- Will be calculated later
    ) VALUES (
      p_game_id,
      takeover_record.victim_user_id,
      new_activity_record.owner_id,
      p_new_activity_id,
      intersection_point,
      0,  -- Placeholder - complex calculation
      0   -- Placeholder - complex calculation
    );
    
    takeovers_created := takeovers_created + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'takeovers_created', takeovers_created,
    'activity_name', new_activity_record.name
  );
END;
$$;

-- Function to recalculate all territories for a game
CREATE OR REPLACE FUNCTION public.recalculate_game_territories(
  p_game_id uuid,
  p_tolerance_m integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  player_record record;
  territory_result json;
  players_updated integer := 0;
  total_territory_km2 numeric := 0;
BEGIN
  -- Recalculate territory for each player in the game
  FOR player_record IN
    SELECT DISTINCT pb.user_id
    FROM public.player_bases pb
    WHERE pb.game_id = p_game_id
  LOOP
    SELECT public.calculate_player_territory(p_game_id, player_record.user_id, p_tolerance_m)
    INTO territory_result;
    
    IF (territory_result->>'success')::boolean THEN
      players_updated := players_updated + 1;
      total_territory_km2 := total_territory_km2 + COALESCE((territory_result->>'territory_area_km2')::numeric, 0);
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'players_updated', players_updated,
    'total_territory_km2', total_territory_km2,
    'tolerance_meters', p_tolerance_m
  );
END;
$$;

-- Function to get game leaderboard
CREATE OR REPLACE FUNCTION public.get_game_leaderboard(p_game_id uuid)
RETURNS TABLE (
  user_id uuid,
  user_email text,
  territory_size_km2 numeric,
  activity_count integer,
  base_activity_name text,
  last_activity_date timestamptz,
  rank integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH player_stats AS (
    SELECT 
      pb.user_id,
      pb.territory_size_km2,
      pb.base_date,
      ua_base.name as base_activity_name,
      p.email,
      COUNT(ua.id) as activity_count,
      MAX(ua.start_date) as last_activity_date
    FROM public.player_bases pb
    JOIN public.profiles p ON pb.user_id = p.id
    JOIN public.user_activities ua_base ON pb.activity_id = ua_base.id
    LEFT JOIN public.user_activities ua ON (
      ua.user_id = pb.user_id 
      AND ua.start_date >= pb.base_date
    )
    WHERE pb.game_id = p_game_id
    GROUP BY pb.user_id, pb.territory_size_km2, pb.base_date, ua_base.name, p.email
  )
  SELECT 
    ps.user_id,
    ps.email,
    ps.territory_size_km2,
    ps.activity_count::integer,
    ps.base_activity_name,
    ps.last_activity_date,
    ROW_NUMBER() OVER (ORDER BY ps.territory_size_km2 DESC, ps.activity_count DESC)::integer as rank
  FROM player_stats ps
  ORDER BY ps.territory_size_km2 DESC, ps.activity_count DESC;
END;
$$;

-- Function to finish a game and determine winner
CREATE OR REPLACE FUNCTION public.finish_game(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  game_record record;
  winner_record record;
  admin_profile_id uuid;
BEGIN
  -- Get requesting user's profile ID
  SELECT id INTO admin_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  -- Check if user is authorized to finish this game
  SELECT g.*, l.admin_user_id
  INTO game_record
  FROM public.games g
  JOIN public.leagues l ON g.league_id = l.id
  WHERE g.id = p_game_id AND l.admin_user_id = admin_profile_id;

  IF game_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to finish this game'
    );
  END IF;

  -- Get the winner (player with largest territory)
  SELECT user_id, territory_size_km2, user_email, base_activity_name
  INTO winner_record
  FROM public.get_game_leaderboard(p_game_id)
  WHERE rank = 1
  LIMIT 1;

  -- Update game status and set winner
  UPDATE public.games
  SET status = 'finished',
      winner_user_id = winner_record.user_id,
      end_date = COALESCE(end_date, now())  -- Use planned end date or now
  WHERE id = p_game_id;

  RETURN json_build_object(
    'success', true,
    'winner_user_id', winner_record.user_id,
    'winner_email', winner_record.user_email,
    'winner_territory_km2', winner_record.territory_size_km2,
    'winner_base_name', winner_record.base_activity_name
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_player_territory(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_territory_takeover(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_game_territories(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_game_leaderboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_game(uuid) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.calculate_player_territory(uuid, uuid, integer) 
IS 'Calculates territory size and updates player_bases for a specific player in a game';

COMMENT ON FUNCTION public.check_territory_takeover(uuid, uuid, integer)
IS 'Checks if a new activity intersects with other players territories and logs takeovers';

COMMENT ON FUNCTION public.recalculate_game_territories(uuid, integer)
IS 'Recalculates territories for all players in a game';

COMMENT ON FUNCTION public.get_game_leaderboard(uuid)
IS 'Returns ranked leaderboard for a game based on territory size';

COMMENT ON FUNCTION public.finish_game(uuid)
IS 'Finishes a game and determines the winner based on territory size';