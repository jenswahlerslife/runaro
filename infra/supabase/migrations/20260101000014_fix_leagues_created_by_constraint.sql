-- Fix leagues.created_by foreign key constraint
-- Problem: created_by references auth.users(id) but should reference profiles(id)
-- Previous migrations set it to auth.users, causing foreign key violations

-- Drop the incorrect foreign key constraint
ALTER TABLE public.leagues
DROP CONSTRAINT IF EXISTS leagues_created_by_fkey;

-- Migrate existing data: convert auth.users IDs to profiles IDs
UPDATE public.leagues
SET created_by = p.id
FROM public.profiles p
WHERE leagues.created_by = p.user_id;

-- Set to NULL if no matching profile found
UPDATE public.leagues
SET created_by = NULL
WHERE created_by NOT IN (SELECT id FROM public.profiles);

-- Add the correct foreign key constraint pointing to profiles
ALTER TABLE public.leagues
ADD CONSTRAINT leagues_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

COMMENT ON COLUMN public.leagues.created_by IS
'Profile ID of the user who created the league. References profiles(id).';

SELECT 'Fixed leagues.created_by foreign key to reference profiles(id) and migrated existing data' as status;
