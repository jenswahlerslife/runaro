-- Create bulletproof RPC function to list user's leagues with role
-- This avoids any RLS cross-table issues and ensures consistency

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
  ORDER BY l.created_at DESC;
$$;

-- Grant execute permissions
REVOKE ALL ON FUNCTION public.list_my_leagues_with_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_leagues_with_role() TO authenticated;