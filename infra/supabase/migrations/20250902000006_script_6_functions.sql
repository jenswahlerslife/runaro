-- Script 6: Create essential functions

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
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
  VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members)
  RETURNING * INTO league_record;

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
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  SELECT * INTO league_record FROM public.leagues WHERE invite_code = p_invite_code;

  IF league_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'League not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = league_record.id AND user_id = user_profile_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already a member of this league');
  END IF;

  SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = league_record.id AND status = 'approved';

  IF member_count >= league_record.max_members THEN
    RETURN json_build_object('success', false, 'error', 'League is full');
  END IF;

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

-- Territory refresh function
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
  SELECT COUNT(*) INTO total_count FROM public.user_activities WHERE user_id = p_user;
  
  IF total_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No activities found for user', 'territory_count', 0, 'total_count', 0, 'base_count', 0);
  END IF;

  SELECT COUNT(*) INTO base_count FROM public.user_activities WHERE user_id = p_user AND is_base = true;
  
  IF base_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No base activity set for user', 'territory_count', 0, 'total_count', total_count, 'base_count', 0);
  END IF;

  BEGIN
    UPDATE public.user_activities SET included_in_game = false WHERE user_id = p_user;

    WITH RECURSIVE territory AS (
      SELECT ua.id, ua.route, 1 as depth
      FROM public.user_activities ua
      WHERE ua.user_id = p_user 
        AND ua.is_base = true 
        AND ua.route IS NOT NULL

      UNION

      SELECT ua2.id, ua2.route, t.depth + 1 as depth
      FROM public.user_activities ua2
      JOIN territory t ON (
        ua2.user_id = p_user 
        AND ua2.route IS NOT NULL
        AND ua2.id != t.id
        AND ST_DWithin(ua2.route::geography, t.route::geography, p_tolerance_m)
      )
      WHERE t.depth < 100
    )
    UPDATE public.user_activities ua
    SET included_in_game = true
    FROM territory t
    WHERE ua.id = t.id;

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
    RAISE;
  END;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_territory(uuid, integer) TO authenticated;

SELECT 'Script 6 Complete: All functions created' as status;