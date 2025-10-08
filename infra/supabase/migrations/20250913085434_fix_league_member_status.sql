-- Fix league member status - approve existing members and fix functions
-- Problem: Members have status='pending' instead of 'approved', blocking game creation

-- 1) Backfill: mark league owners as approved members
UPDATE public.league_members lm
SET status = 'approved',
    approved_at = COALESCE(approved_at, now()),
    approved_by = COALESCE(approved_by, l.admin_user_id)
FROM public.leagues l
WHERE lm.league_id = l.id
  AND lm.user_id = l.admin_user_id
  AND lm.role = 'owner'
  AND lm.status != 'approved';

-- 2) Approve all current members in public leagues
UPDATE public.league_members lm
SET status = 'approved',
    approved_at = COALESCE(approved_at, now()),
    approved_by = COALESCE(approved_by, l.admin_user_id)
FROM public.leagues l
WHERE lm.league_id = l.id
  AND l.is_public = true
  AND lm.status != 'approved';

-- 3) Fix create_league: owner should be inserted as approved
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
  user_id_val := auth.uid();
  IF user_id_val IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  INSERT INTO public.leagues (name, description, is_public, max_members, admin_user_id)
  SELECT p_name, p_description, p_is_public, p_max_members, id
  FROM public.profiles
  WHERE user_id = user_id_val
  RETURNING * INTO league_record;

  -- Owner joins as approved
  INSERT INTO public.league_members (league_id, user_id, role, status, joined_at, approved_at, approved_by)
  VALUES (league_record.id,
          league_record.admin_user_id,
          'owner',
          'approved',
          now(),
          now(),
          league_record.admin_user_id);

  RETURN json_build_object('success', true, 'league_id', league_record.id, 'invite_code', league_record.invite_code);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to create league: ' || SQLERRM);
END;
$$;

-- 4) Fix join_league for public leagues: insert as approved
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
  user_profile_id uuid;
BEGIN
  user_id_val := auth.uid();
  IF user_id_val IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Get user profile ID
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = user_id_val;
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

  SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = league_record.id;
  IF member_count >= league_record.max_members THEN
    RETURN json_build_object('success', false, 'error', 'League is full');
  END IF;

  IF league_record.is_public THEN
    -- Approve immediately for public leagues
    INSERT INTO public.league_members (league_id, user_id, role, status, joined_at, approved_at, approved_by)
    VALUES (league_record.id, user_profile_id, 'member', 'approved', now(), now(), league_record.admin_user_id);
    RETURN json_build_object('success', true, 'league_id', league_record.id, 'league_name', league_record.name, 'status', 'approved');
  ELSE
    INSERT INTO public.league_join_requests (league_id, user_id, status)
    VALUES (league_record.id, user_profile_id, 'pending');
    RETURN json_build_object('success', true, 'league_id', league_record.id, 'league_name', league_record.name, 'status', 'pending');
  END IF;
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'Failed to join league: ' || SQLERRM);
END;
$$;

-- Make sure the RPCs are executable by authenticated
REVOKE ALL ON FUNCTION public.create_league(text, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.join_league(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;

SELECT 'League member status fixed - members should now be approved' as status;