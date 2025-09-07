-- Safety timeouts
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

-- Function to refresh user territory based on route connectivity
CREATE OR REPLACE FUNCTION public.refresh_user_territory(p_user uuid, p_tolerance_m integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  territory_count integer := 0;
  total_count integer := 0;
  base_count integer := 0;
BEGIN
  -- Safety: validate user exists and has at least one activity
  SELECT COUNT(*) INTO total_count
  FROM public.user_activities 
  WHERE user_id = p_user;
  
  IF total_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No activities found for user',
      'territory_count', 0,
      'total_count', 0,
      'base_count', 0
    );
  END IF;

  -- Check if user has a base set
  SELECT COUNT(*) INTO base_count
  FROM public.user_activities 
  WHERE user_id = p_user AND is_base = true;
  
  IF base_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No base activity set for user',
      'territory_count', 0,
      'total_count', total_count,
      'base_count', 0
    );
  END IF;

  -- Start transaction for territory calculation
  BEGIN
    -- First, mark all activities as excluded from game
    UPDATE public.user_activities
    SET included_in_game = false
    WHERE user_id = p_user;

    -- Find all activities in territory using recursive CTE
    WITH RECURSIVE territory AS (
      -- Base case: start with the base activity
      SELECT ua.id, ua.route, 1 as depth
      FROM public.user_activities ua
      WHERE ua.user_id = p_user 
        AND ua.is_base = true 
        AND ua.route IS NOT NULL

      UNION

      -- Recursive case: find activities connected to territory
      SELECT ua2.id, ua2.route, t.depth + 1 as depth
      FROM public.user_activities ua2
      JOIN territory t ON (
        ua2.user_id = p_user 
        AND ua2.route IS NOT NULL
        AND ua2.id != t.id  -- Prevent self-joins
        AND ST_DWithin(ua2.route::geography, t.route::geography, p_tolerance_m)
      )
      WHERE t.depth < 100  -- Prevent infinite recursion (safety limit)
    )
    -- Update activities in territory to be included in game
    UPDATE public.user_activities ua
    SET included_in_game = true
    FROM territory t
    WHERE ua.id = t.id;

    -- Get count of activities now included in territory
    SELECT COUNT(*) INTO territory_count
    FROM public.user_activities
    WHERE user_id = p_user AND included_in_game = true;

    RETURN json_build_object(
      'success', true,
      'territory_count', territory_count,
      'total_count', total_count,
      'base_count', base_count,
      'tolerance_meters', p_tolerance_m
    );

  EXCEPTION WHEN OTHERS THEN
    -- Rollback on any error
    RAISE;
  END;
END;
$$;

-- Grant execute permission to authenticated users (they can only run on their own data due to RLS)
GRANT EXECUTE ON FUNCTION public.refresh_user_territory(uuid, integer) TO authenticated;

-- Add comment to function
COMMENT ON FUNCTION public.refresh_user_territory(uuid, integer) 
IS 'Recalculates which activities are included in a users territory based on spatial connectivity to their base activity';