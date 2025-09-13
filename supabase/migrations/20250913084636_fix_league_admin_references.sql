-- Fix league admin references to use correct profile IDs
-- Problem: Some leagues.admin_user_id points to profiles.user_id instead of profiles.id

-- Update leagues where admin_user_id doesn't match any profile.id but matches profile.user_id
UPDATE public.leagues 
SET admin_user_id = p.id
FROM public.profiles p
WHERE leagues.admin_user_id = p.user_id 
  AND leagues.admin_user_id != p.id
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2 WHERE p2.id = leagues.admin_user_id
  );

SELECT 'League admin references fixed' as status;