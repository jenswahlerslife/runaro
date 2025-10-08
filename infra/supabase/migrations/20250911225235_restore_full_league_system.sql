-- Restore full league system with all required features
-- This will restore the functionality that was removed

-- 1) Ensure leagues table has all required columns
ALTER TABLE public.leagues 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS max_members integer DEFAULT 3;

-- 2) Add constraints for subscription enforcement
ALTER TABLE public.leagues 
ADD CONSTRAINT leagues_max_members_check 
CHECK (max_members >= 1 AND max_members <= 50);

-- 3) Restore comprehensive create_league_with_owner function
DROP FUNCTION IF EXISTS public.create_league_with_owner(text, text);

CREATE OR REPLACE FUNCTION public.create_league_with_owner(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT true,
  p_max_members integer DEFAULT 3
) RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_league public.leagues;
  v_user_is_pro boolean := false;
BEGIN
  -- Check authentication
  IF v_user IS NULL THEN 
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if user has pro subscription (you'll need to implement this based on your subscription logic)
  -- For now, default to free plan limits
  -- v_user_is_pro := check_user_subscription(v_user);

  -- Enforce subscription limits
  IF NOT v_user_is_pro AND p_max_members > 3 THEN
    RAISE EXCEPTION 'Free plan limited to 3 members. Upgrade to Pro for up to 50 members.';
  END IF;

  IF p_max_members > 50 THEN
    RAISE EXCEPTION 'Maximum 50 members per league';
  END IF;

  -- Create the league
  INSERT INTO public.leagues (
    name, 
    description, 
    is_public,
    max_members,
    admin_user_id, 
    created_by, 
    invite_code
  )
  VALUES (
    p_name, 
    p_description, 
    p_is_public,
    p_max_members,
    v_user,
    v_user,
    substring(md5(random()::text), 1, 8)
  )
  RETURNING * INTO v_league;

  -- Add the creator as owner in league_members table
  INSERT INTO public.league_members (league_id, user_id, role, status)
  VALUES (v_league.id, v_user, 'owner', 'approved');

  RETURN v_league;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) TO authenticated;

-- 4) Create function to get user leagues with proper member counts and admin status
CREATE OR REPLACE FUNCTION public.get_user_leagues(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  is_public boolean,
  max_members integer,
  invite_code text,
  created_at timestamptz,
  role text,
  member_count bigint,
  is_admin boolean,
  pending_requests_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.description,
    l.is_public,
    l.max_members,
    l.invite_code,
    l.created_at,
    lm.role,
    (SELECT COUNT(*) FROM league_members lm2 WHERE lm2.league_id = l.id AND lm2.status = 'approved') as member_count,
    (lm.role IN ('owner', 'admin')) as is_admin,
    CASE 
      WHEN lm.role IN ('owner', 'admin') THEN 
        (SELECT COUNT(*) FROM league_join_requests ljr WHERE ljr.league_id = l.id AND ljr.status = 'pending')
      ELSE 0 
    END as pending_requests_count
  FROM leagues l
  JOIN league_members lm ON l.id = lm.league_id
  WHERE lm.user_id = p_user_id 
    AND lm.status = 'approved'
  ORDER BY l.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_leagues(uuid) TO authenticated;

-- 5) Create league directory function for search
CREATE OR REPLACE FUNCTION public.search_leagues(
  p_user_id uuid DEFAULT auth.uid(),
  p_search_term text DEFAULT '',
  p_public_only boolean DEFAULT true,
  p_has_active_game boolean DEFAULT NULL,
  p_sort_by text DEFAULT 'newest' -- 'newest', 'most_members', 'alphabetical'
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  is_public boolean,
  max_members integer,
  member_count bigint,
  has_active_game boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER  
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.description,
    l.is_public,
    l.max_members,
    (SELECT COUNT(*) FROM league_members lm WHERE lm.league_id = l.id AND lm.status = 'approved') as member_count,
    (SELECT COUNT(*) > 0 FROM games g WHERE g.league_id = l.id AND g.status = 'active') as has_active_game,
    l.created_at
  FROM leagues l
  WHERE 
    -- User is not already in this league
    NOT EXISTS (
      SELECT 1 FROM league_members lm 
      WHERE lm.league_id = l.id 
      AND lm.user_id = p_user_id 
      AND lm.status IN ('approved', 'pending')
    )
    -- Public filter
    AND (NOT p_public_only OR l.is_public = true)
    -- Search term filter
    AND (p_search_term = '' OR l.name ILIKE '%' || p_search_term || '%' OR l.description ILIKE '%' || p_search_term || '%')
    -- Active game filter
    AND (p_has_active_game IS NULL OR 
         (p_has_active_game AND EXISTS(SELECT 1 FROM games g WHERE g.league_id = l.id AND g.status = 'active')) OR
         (NOT p_has_active_game AND NOT EXISTS(SELECT 1 FROM games g WHERE g.league_id = l.id AND g.status = 'active')))
  ORDER BY 
    CASE 
      WHEN p_sort_by = 'newest' THEN l.created_at
      ELSE NULL
    END DESC,
    CASE 
      WHEN p_sort_by = 'alphabetical' THEN l.name
      ELSE NULL
    END ASC,
    CASE 
      WHEN p_sort_by = 'most_members' THEN (SELECT COUNT(*) FROM league_members lm WHERE lm.league_id = l.id AND lm.status = 'approved')
      ELSE NULL
    END DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_leagues(uuid, text, boolean, boolean, text) TO authenticated;

SELECT 'Restored full league system with subscription enforcement and search' as status;