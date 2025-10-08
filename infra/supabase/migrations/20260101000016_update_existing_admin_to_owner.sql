-- Update existing league memberships where user is admin_user_id to have owner role
-- This fixes leagues that were created with the old trigger that set role to 'admin'

UPDATE public.league_members lm
SET role = 'owner'
FROM public.leagues l
WHERE lm.league_id = l.id
  AND lm.user_id = l.admin_user_id
  AND lm.role = 'admin';

SELECT 'Updated existing admin memberships to owner role' as status;
