-- Approve all existing league members to enable game creation
-- This fixes the issue where existing members have status='pending' instead of 'approved'

UPDATE public.league_members 
SET 
  status = 'approved',
  approved_at = COALESCE(approved_at, now()),
  approved_by = COALESCE(approved_by, (
    SELECT admin_user_id 
    FROM public.leagues 
    WHERE id = league_members.league_id
  ))
WHERE status != 'approved';

-- Also ensure league owners have the owner role and approved status
UPDATE public.league_members lm
SET 
  status = 'approved',
  role = 'owner',
  approved_at = COALESCE(approved_at, now()),
  approved_by = COALESCE(approved_by, l.admin_user_id)
FROM public.leagues l
WHERE lm.league_id = l.id
  AND lm.user_id = l.admin_user_id
  AND (lm.status != 'approved' OR lm.role != 'owner');

SELECT 'All existing league members approved for game creation' as status;