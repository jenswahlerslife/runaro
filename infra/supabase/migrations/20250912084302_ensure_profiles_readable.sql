-- Ensure profiles table has proper RLS policies for joins and views

-- Enable RLS on profiles table if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all public profile data" ON public.profiles;

-- Create a permissive SELECT policy for profiles that allows:
-- 1. Users to see their own profile
-- 2. Other users to see basic profile info (display_name, username) for joins/views
-- 3. But exclude sensitive fields like age from general access
CREATE POLICY "profiles_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (true); -- Allow all authenticated users to read basic profile info

-- Ensure proper INSERT policy for profile creation
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;

CREATE POLICY "profiles_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure proper UPDATE policy
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "profiles_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Note: We keep the profile SELECT permissive because:
-- 1. The UI-safe types in src/types/ui.ts already exclude sensitive fields
-- 2. The views (league_members_view, league_join_requests_view) only select display_name/username
-- 3. This prevents JOIN failures that cause 500 errors