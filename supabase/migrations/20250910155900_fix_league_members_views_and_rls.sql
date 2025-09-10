-- Create views for easy display_name access and proper RLS policies

-- 1) First, add role column to league_members if it doesn't exist
ALTER TABLE public.league_members 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' 
CHECK (role IN ('member', 'admin', 'owner'));

-- 2) Update existing members to have proper roles (owners get owner role)
UPDATE public.league_members 
SET role = 'owner'
FROM public.leagues l
WHERE league_members.league_id = l.id 
  AND league_members.user_id = l.admin_user_id
  AND league_members.role = 'member';

-- 3) Create league_members_view with joined profiles for display_name
CREATE OR REPLACE VIEW public.league_members_view AS
SELECT
  lm.id,
  lm.league_id,
  lm.user_id,
  COALESCE(p.display_name, p.username, 'Bruger') as display_name,
  lm.role,
  lm.joined_at
FROM public.league_members lm
LEFT JOIN public.profiles p ON p.user_id = lm.user_id;

-- 4) Create league_join_requests_view with joined profiles  
CREATE OR REPLACE VIEW public.league_join_requests_view AS
SELECT
  r.id,
  r.league_id,
  r.user_id,
  COALESCE(p.display_name, p.username, 'Bruger') as display_name,
  r.status,
  r.created_at
FROM public.league_join_requests r
LEFT JOIN public.profiles p ON p.user_id = r.user_id;

-- 5) Enable RLS on league_members if not already enabled
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- 6) Enable RLS on league_join_requests if not already enabled  
ALTER TABLE public.league_join_requests ENABLE ROW LEVEL SECURITY;

-- 7) Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "members_can_read_members_in_same_league" ON public.league_members;
DROP POLICY IF EXISTS "admins_can_read_requests_in_their_league" ON public.league_join_requests;
DROP POLICY IF EXISTS "admins_can_update_requests_in_their_league" ON public.league_join_requests;
DROP POLICY IF EXISTS "admins_can_insert_members_in_their_league" ON public.league_members;

-- 8) Create policy: Members can see other members in same league
CREATE POLICY "members_can_read_members_in_same_league"
ON public.league_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm2
    WHERE lm2.league_id = league_members.league_id
      AND lm2.user_id = auth.uid()
  )
);

-- 9) Create policy: Admins/owners can see join requests in their league
CREATE POLICY "admins_can_read_requests_in_their_league"
ON public.league_join_requests  
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_join_requests.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);

-- 10) Create policy: Admins/owners can update join requests (approve/reject)
CREATE POLICY "admins_can_update_requests_in_their_league"
ON public.league_join_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_join_requests.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);

-- 11) Create policy: Admins/owners can insert new members (when approving)
CREATE POLICY "admins_can_insert_members_in_their_league"
ON public.league_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_members.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);

-- 12) Grant necessary permissions on views
GRANT SELECT ON public.league_members_view TO authenticated;
GRANT SELECT ON public.league_join_requests_view TO authenticated;