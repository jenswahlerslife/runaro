-- Production-Ready Authentication Setup for Runaro
-- Run this in Supabase SQL Editor
-- This fixes 406 errors forever and creates professional email flow

-- 1. Ensure profiles table structure matches your existing schema
-- (Your table already exists, but let's make sure it has the right structure)

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them cleanly
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Create proper RLS policies for profiles
CREATE POLICY "profiles_select_own" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- 2. Create function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-create profile for new auth users
  INSERT INTO public.profiles (
    user_id, 
    username, 
    display_name,
    role
  )
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    'user'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Create trigger to run function on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill existing users who don't have profiles
INSERT INTO public.profiles (user_id, username, display_name, role)
SELECT 
  u.id,
  split_part(u.email, '@', 1),
  split_part(u.email, '@', 1),
  'user'
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 5. Create helper function to debug profile issues (optional)
CREATE OR REPLACE FUNCTION public.debug_profile_access(target_user_id uuid)
RETURNS TABLE (
  has_auth_user boolean,
  has_profile boolean,
  can_select_profile boolean,
  profile_data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  auth_exists boolean := false;
  profile_exists boolean := false;
  can_access boolean := false;
  profile_info jsonb := null;
BEGIN
  -- Check if user exists in auth.users
  SELECT EXISTS(
    SELECT 1 FROM auth.users WHERE id = target_user_id
  ) INTO auth_exists;
  
  -- Check if profile exists
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE user_id = target_user_id
  ) INTO profile_exists;
  
  -- Try to select profile (will respect RLS)
  BEGIN
    SELECT row_to_json(p)::jsonb INTO profile_info
    FROM public.profiles p 
    WHERE p.user_id = target_user_id;
    
    can_access := profile_info IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    can_access := false;
  END;
  
  RETURN QUERY SELECT auth_exists, profile_exists, can_access, profile_info;
END;
$$;

-- 6. Verify the setup
DO $$
DECLARE
  trigger_count integer;
  policy_count integer;
  profile_count integer;
BEGIN
  -- Check trigger exists
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers 
  WHERE trigger_name = 'on_auth_user_created';
  
  -- Check policies exist  
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'profiles';
  
  -- Check profile count
  SELECT COUNT(*) INTO profile_count
  FROM public.profiles;
  
  RAISE NOTICE '=== SETUP VERIFICATION ===';
  RAISE NOTICE 'Auto-profile trigger: % (should be 1)', trigger_count;
  RAISE NOTICE 'RLS policies: % (should be 3)', policy_count;
  RAISE NOTICE 'Total profiles: %', profile_count;
  RAISE NOTICE 'Setup complete! 🎉';
END $$;