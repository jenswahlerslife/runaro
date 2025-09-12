-- Fix infinite recursion RLS policies for league members functionality

-- 1) Fix SELECT policies (remove the recursion)

-- league_members: members can see themselves; league owner/admin can see all
DROP POLICY IF EXISTS "lm_select" ON public.league_members;
DROP POLICY IF EXISTS "members_can_read_members_in_same_league" ON public.league_members;

CREATE POLICY "lm_select"
ON public.league_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = league_members.league_id
      AND l.admin_user_id = auth.uid()
  )
);

-- leagues: viewers can see leagues they belong to, the ones they own/admin, or public ones
DROP POLICY IF EXISTS "leagues_select" ON public.leagues;

CREATE POLICY "leagues_select"
ON public.leagues
FOR SELECT
TO authenticated
USING (
  is_public
  OR admin_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.league_members m
    WHERE m.league_id = leagues.id
      AND m.user_id = auth.uid()
  )
);

-- 2) Ensure update/delete policies exist for member management

-- UPDATE role (owner can promote/demote/remove others only; can't change/remove self)
DROP POLICY IF EXISTS "lm_update_role" ON public.league_members;
DROP POLICY IF EXISTS "owners_can_update_member_roles_in_their_league" ON public.league_members;

CREATE POLICY "lm_update_role"
ON public.league_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.league_members x
    WHERE x.league_id = league_members.league_id
      AND x.user_id = auth.uid()
      AND x.role = 'owner'
  )
  AND league_members.user_id <> auth.uid()
)
-- only allow role to admin/member
WITH CHECK (
  league_members.user_id <> auth.uid()
  AND role IN ('admin','member')
);

-- DELETE member (owner over others only)
DROP POLICY IF EXISTS "lm_delete" ON public.league_members;
DROP POLICY IF EXISTS "owners_can_delete_members_in_their_league" ON public.league_members;

CREATE POLICY "lm_delete"
ON public.league_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.league_members x
    WHERE x.league_id = league_members.league_id
      AND x.user_id = auth.uid()
      AND x.role = 'owner'
  )
  AND league_members.user_id <> auth.uid()
);

-- 3) Recreate views to be simple (no recursion)

-- Drop existing views first to avoid column conflicts
DROP VIEW IF EXISTS public.league_members_view;
DROP VIEW IF EXISTS public.league_join_requests_view;

-- Members view
CREATE VIEW public.league_members_view AS
SELECT
  lm.id,
  lm.league_id,
  lm.user_id,
  COALESCE(p.display_name, p.username, 'Bruger') as display_name,
  lm.role,
  lm.joined_at
FROM public.league_members lm
LEFT JOIN public.profiles p ON p.user_id = lm.user_id;

-- Join requests view
CREATE VIEW public.league_join_requests_view AS
SELECT
  r.id,
  r.league_id,
  r.user_id,
  COALESCE(p.display_name, p.username, 'Bruger') as display_name,
  r.status,
  r.created_at
FROM public.league_join_requests r
LEFT JOIN public.profiles p ON p.user_id = r.user_id;

-- Ensure proper permissions on views
GRANT SELECT ON public.league_members_view TO authenticated;
GRANT SELECT ON public.league_join_requests_view TO authenticated;