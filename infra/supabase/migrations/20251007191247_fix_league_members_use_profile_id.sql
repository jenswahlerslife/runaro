-- FIX: league_members.user_id should reference profiles.id, not auth.uid()
--
-- PROBLEM: league_members.user_id currently references auth.users(id)
-- BUT all other tables (user_activities, player_bases) reference profiles(id)
-- This creates inconsistency and authorization failures
--
-- SOLUTION: Change foreign key and update data to use profiles.id

-- Step 1: Drop the existing foreign key constraint to auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'league_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.league_members DROP CONSTRAINT league_members_user_id_fkey;
  END IF;
END $$;

-- Step 2: Update existing league_members to use profiles.id instead of auth.uid()
UPDATE public.league_members lm
SET user_id = p.id
FROM public.profiles p
WHERE lm.user_id = p.user_id  -- Where it's currently auth.uid()
  AND lm.user_id != p.id;     -- And not already correct

-- Step 3: Add new foreign key constraint to profiles.id
ALTER TABLE public.league_members
ADD CONSTRAINT league_members_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Step 2: Verify the fix
DO $$
DECLARE
  v_mismatched_count integer;
BEGIN
  -- Count how many league_members still have user_id that doesn't match profiles.id
  SELECT COUNT(*) INTO v_mismatched_count
  FROM public.league_members lm
  LEFT JOIN public.profiles p ON lm.user_id = p.id
  WHERE p.id IS NULL;

  IF v_mismatched_count > 0 THEN
    RAISE NOTICE 'Warning: % league_members rows still have invalid user_id', v_mismatched_count;
  ELSE
    RAISE NOTICE 'Success: All league_members.user_id now reference valid profiles.id';
  END IF;
END $$;

COMMENT ON TABLE public.league_members IS 'League membership. user_id references profiles.id (NOT auth.uid())';
