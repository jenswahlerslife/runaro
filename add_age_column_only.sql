-- Simple Age Column Addition - Copy to Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql

-- Add the missing age column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;

-- Add constraint for age validation (5-120 years)
ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS profiles_age_range 
CHECK (age IS NULL OR (age >= 5 AND age <= 120));

-- Verify the addition
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('display_name', 'age');