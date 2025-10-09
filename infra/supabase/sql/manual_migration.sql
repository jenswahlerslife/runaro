-- Manual migration to add display_name and age to profiles
-- Run this directly in the Supabase SQL Editor

-- 1) Add columns if they don't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS age INT;

-- 2) Add constraints for validation
ALTER TABLE public.profiles 
ADD CONSTRAINT IF NOT EXISTS profiles_age_range 
CHECK (age IS NULL OR (age >= 5 AND age <= 120));

ALTER TABLE public.profiles 
ADD CONSTRAINT IF NOT EXISTS profiles_display_name_length 
CHECK (display_name IS NULL OR (LENGTH(display_name) >= 2 AND LENGTH(display_name) <= 50));

-- 3) Enable RLS (if not already enabled)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4) Create RLS policies if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'profiles_select_own'
    ) THEN
        CREATE POLICY profiles_select_own
        ON public.profiles FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'profiles_insert_own'
    ) THEN
        CREATE POLICY profiles_insert_own
        ON public.profiles FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'profiles_update_own'
    ) THEN
        CREATE POLICY profiles_update_own
        ON public.profiles FOR UPDATE
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- 5) Create trigger function for new user profile creation
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
      THEN (NEW.raw_user_meta_data->>'age')::int 
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

-- 6) Create trigger for new user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7) Update existing profiles that might be missing display_name
UPDATE public.profiles 
SET display_name = COALESCE(display_name, username)
WHERE display_name IS NULL AND username IS NOT NULL;

-- Test the migration
SELECT 'Migration completed successfully!' as status;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('display_name', 'age');