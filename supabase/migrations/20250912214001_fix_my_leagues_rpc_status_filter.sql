-- Fix RPC function to properly handle league member status
-- Only show approved members, but always show owners regardless of status

CREATE OR REPLACE FUNCTION public.list_my_leagues_with_role()
RETURNS TABLE (
  id uuid, 
  name text, 
  description text, 
  invite_code text,
  created_at timestamptz, 
  role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    l.id, 
    l.name, 
    l.description, 
    l.invite_code,
    l.created_at, 
    lm.role
  FROM public.leagues l
  JOIN public.league_members lm
    ON lm.league_id = l.id
   AND lm.user_id = auth.uid()
  WHERE lm.status = 'approved'
     OR lm.role = 'owner'  -- Owners always see their leagues regardless of status
  ORDER BY l.created_at DESC;
$$;