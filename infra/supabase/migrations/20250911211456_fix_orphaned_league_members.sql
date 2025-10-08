-- Clean up orphaned league_members records before adding foreign key constraint
-- Remove any league_members records where user_id doesn't exist in auth.users

DELETE FROM public.league_members 
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

-- Also clean up any league_join_requests with invalid user_id
DELETE FROM public.league_join_requests 
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

SELECT 'Cleaned up orphaned league membership records' as status;