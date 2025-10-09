-- SQL commands to disable email confirmation for development
-- Run this in the Supabase SQL editor

-- Check current auth settings
SELECT * FROM auth.config;

-- Disable email confirmation (if you have access to modify auth settings)
-- Note: This might require service role access or manual configuration in Supabase dashboard

-- Alternative: Create a trigger to auto-confirm users
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm new users for development
  NEW.email_confirmed_at = NOW();
  NEW.confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-confirm users on signup
DROP TRIGGER IF EXISTS auto_confirm_users ON auth.users;
CREATE TRIGGER auto_confirm_users
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();

-- Also handle existing unconfirmed users
UPDATE auth.users 
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE 
  email_confirmed_at IS NULL 
  AND confirmed_at IS NULL;