-- Add missing RLS policies for league member management

-- Policy: Owners can delete members (except themselves if they're the only owner)
CREATE POLICY "owners_can_delete_members_in_their_league"
ON public.league_members
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_members.league_id
      AND lm.user_id = auth.uid()
      AND lm.role = 'owner'
  )
  -- Prevent owners from deleting themselves if they're the only owner
  AND NOT (
    league_members.user_id = auth.uid()
    AND league_members.role = 'owner'
    AND (
      SELECT COUNT(*) FROM public.league_members lm2
      WHERE lm2.league_id = league_members.league_id
        AND lm2.role = 'owner'
    ) = 1
  )
);

-- Policy: Owners can update member roles (except their own)
CREATE POLICY "owners_can_update_member_roles_in_their_league"
ON public.league_members
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_members.league_id
      AND lm.user_id = auth.uid()
      AND lm.role = 'owner'
  )
  -- Owners cannot change their own role
  AND league_members.user_id != auth.uid()
);