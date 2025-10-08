-- Fix RLS policies for user_activities table
-- Problem: Policies were using auth.uid() directly, but user_activities.user_id
-- references profiles.id, not auth.users.id
-- Solution: Update policies to join through profiles table

-- Ensure RLS is enabled
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view their own activities" ON public.user_activities;
DROP POLICY IF EXISTS "Users can insert their own activities" ON public.user_activities;
DROP POLICY IF EXISTS "Users can update their own activities" ON public.user_activities;
DROP POLICY IF EXISTS "Users can delete their own activities" ON public.user_activities;

-- Create new SELECT policy that joins through profiles
CREATE POLICY "Users can view their own activities"
ON public.user_activities
FOR SELECT
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Create new INSERT policy that joins through profiles
CREATE POLICY "Users can insert their own activities"
ON public.user_activities
FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Create new UPDATE policy that joins through profiles
CREATE POLICY "Users can update their own activities"
ON public.user_activities
FOR UPDATE
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Create new DELETE policy that joins through profiles
CREATE POLICY "Users can delete their own activities"
ON public.user_activities
FOR DELETE
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- Add comment explaining the fix
COMMENT ON TABLE public.user_activities IS 'User activities imported from Strava. user_id references profiles.id (not auth.uid() directly). RLS policies updated 2025-10-02 to join through profiles table.';
