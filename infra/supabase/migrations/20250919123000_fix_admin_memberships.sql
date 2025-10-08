-- Fix admin league memberships
-- Ensure all league admins are also members of their leagues
--
-- IMPORTANT: league_members.user_id references auth.users.id, NOT profiles.id
-- But leagues.admin_user_id references profiles.id
-- So we need to join through profiles to get the auth.users.id

BEGIN;

-- Insert missing admin memberships for existing leagues
-- Convert leagues.admin_user_id (profiles.id) to auth.users.id for league_members
INSERT INTO public.league_members (league_id, user_id, role, status, joined_at)
SELECT
  l.id as league_id,
  p.user_id as user_id,  -- This is auth.users.id from profiles table
  'admin' as role,
  'approved' as status,
  NOW() as joined_at
FROM public.leagues l
JOIN public.profiles p ON l.admin_user_id = p.id  -- Join to get auth.users.id
WHERE l.admin_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = l.id AND lm.user_id = p.user_id  -- Check against auth.users.id
  )
ON CONFLICT (league_id, user_id) DO UPDATE SET
  role = 'admin',
  status = 'approved',
  joined_at = NOW();

-- Log which leagues we're updating
DO $$
DECLARE
  league_record record;
BEGIN
  FOR league_record IN
    SELECT l.id, l.name, l.admin_user_id, p.username, p.user_id as auth_user_id
    FROM public.leagues l
    JOIN public.profiles p ON l.admin_user_id = p.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.league_members lm
      WHERE lm.league_id = l.id AND lm.user_id = p.user_id
    )
  LOOP
    RAISE NOTICE 'Adding admin membership for league: % (%) - Admin: % (profile_id: %, auth_user_id: %)',
      league_record.name, league_record.id, league_record.username,
      league_record.admin_user_id, league_record.auth_user_id;
  END LOOP;
END $$;

COMMIT;