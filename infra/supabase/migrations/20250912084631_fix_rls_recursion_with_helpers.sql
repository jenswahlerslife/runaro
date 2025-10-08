-- Fix RLS recursion by using SECURITY DEFINER helper functions
-- This breaks the circular dependency between leagues and league_members policies

-- A. Create helper functions (bypass RLS safely)

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.is_league_admin(uuid);
DROP FUNCTION IF EXISTS public.is_league_member(uuid);

CREATE OR REPLACE FUNCTION public.is_league_admin(p_league uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = p_league
      AND l.admin_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_member(p_league uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members m
    WHERE m.league_id = p_league
      AND m.user_id = auth.uid()
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_league_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_league_member(uuid) TO authenticated;

-- B. Rewrite the policies to use the helpers

-- League Members Policies (SELECT / UPDATE / DELETE)
-- Clean slate
DROP POLICY IF EXISTS "lm_select" ON public.league_members;
DROP POLICY IF EXISTS "lm_update_role" ON public.league_members;  
DROP POLICY IF EXISTS "lm_delete" ON public.league_members;

-- Members can see their own row; owner/admin can see all members of that league
CREATE POLICY "lm_select"
ON public.league_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_league_admin(league_members.league_id)
);

-- Owner can promote/demote others (not self) between admin/member
CREATE POLICY "lm_update_role"
ON public.league_members
FOR UPDATE
TO authenticated
USING (
  public.is_league_admin(league_members.league_id)
  AND league_members.user_id <> auth.uid()
)
WITH CHECK (
  league_members.user_id <> auth.uid()
  AND role IN ('admin','member')
);

-- Owner can remove others (not self)
CREATE POLICY "lm_delete"
ON public.league_members
FOR DELETE
TO authenticated
USING (
  public.is_league_admin(league_members.league_id)
  AND league_members.user_id <> auth.uid()
);

-- Leagues Policy (SELECT)
DROP POLICY IF EXISTS "leagues_select" ON public.leagues;

CREATE POLICY "leagues_select"
ON public.leagues
FOR SELECT
TO authenticated
USING (
  is_public
  OR admin_user_id = auth.uid()
  OR public.is_league_member(id)
);

-- C. Recreate views to ensure they're clean
DROP VIEW IF EXISTS public.league_members_view;
DROP VIEW IF EXISTS public.league_join_requests_view;

CREATE VIEW public.league_members_view AS
SELECT
  lm.id,
  lm.league_id,
  lm.user_id,
  lm.role,
  lm.joined_at,
  COALESCE(p.display_name, p.username, 'Bruger') as display_name
FROM public.league_members lm
LEFT JOIN public.profiles p ON p.user_id = lm.user_id;

CREATE VIEW public.league_join_requests_view AS
SELECT
  r.id,
  r.league_id,
  r.user_id,
  r.created_at,
  COALESCE(p.display_name, p.username, 'Bruger') as display_name
FROM public.league_join_requests r
LEFT JOIN public.profiles p ON p.user_id = r.user_id
WHERE r.status = 'pending';

-- Grant permissions on views
GRANT SELECT ON public.league_members_view TO authenticated;
GRANT SELECT ON public.league_join_requests_view TO authenticated;