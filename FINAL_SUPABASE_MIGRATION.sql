-- ===================================================================
-- FINAL SUPABASE MIGRATION - Run this in Supabase SQL Editor
-- ===================================================================
-- This will add display_name and age columns to profiles table
-- and set up automatic profile creation for new users

-- 1) Add the missing columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER;

-- 2) Add validation constraints
ALTER TABLE public.profiles 
ADD CONSTRAINT IF NOT EXISTS profiles_age_range 
CHECK (age IS NULL OR (age >= 5 AND age <= 120));

ALTER TABLE public.profiles 
ADD CONSTRAINT IF NOT EXISTS profiles_display_name_length 
CHECK (display_name IS NULL OR (LENGTH(display_name) >= 2 AND LENGTH(display_name) <= 50));

-- 3) Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4) Create/update RLS policies
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

-- 5) Create trigger function for automatic profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, display_name, age)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'username', 
      split_part(NEW.email, '@', 1)
    ),
    CASE 
      WHEN NEW.raw_user_meta_data->>'age' IS NOT NULL 
      THEN (NEW.raw_user_meta_data->>'age')::integer
      ELSE NULL 
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    display_name = COALESCE(
      EXCLUDED.display_name,
      profiles.display_name,
      profiles.username
    ),
    age = COALESCE(EXCLUDED.age, profiles.age);

  RETURN NEW;
END;
$$;

-- 6) Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7) Update existing profiles to have display_name
UPDATE public.profiles 
SET display_name = COALESCE(display_name, username)
WHERE display_name IS NULL AND username IS NOT NULL;

-- 8) Verification - check that everything works
SELECT 'Migration completed successfully!' AS status;

-- Show current table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND table_schema = 'public'
AND column_name IN ('display_name', 'age')
ORDER BY column_name;

-- Show sample data
SELECT id, username, display_name, age 
FROM public.profiles 
LIMIT 3;

SELECT 'Ready for signup with name and age!' AS final_status;