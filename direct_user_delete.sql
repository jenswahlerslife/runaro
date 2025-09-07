-- Direct SQL to delete user account
-- This should be run in the Supabase SQL editor

-- First, let's see what users exist in auth.users
SELECT id, email, created_at FROM auth.users WHERE email = 'wahlers3@hotmail.com';

-- Delete from profiles table (if exists)
DELETE FROM public.profiles 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'wahlers3@hotmail.com'
);

-- Delete from activities table (if exists) 
DELETE FROM public.activities 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'wahlers3@hotmail.com'
);

-- Delete from league_memberships (if exists)
DELETE FROM public.league_memberships 
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'wahlers3@hotmail.com'
);

-- Finally delete the auth user (this requires service role privileges)
-- This part needs to be done via the Supabase dashboard or with proper admin privileges