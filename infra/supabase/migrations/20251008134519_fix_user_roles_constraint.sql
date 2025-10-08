-- Fix user_roles foreign key constraint to reference auth.users instead of profiles
-- This allows admin role assignment to work before profile is created

-- Drop the existing constraint
ALTER TABLE public.user_roles 
  DROP CONSTRAINT IF EXISTS fk_user_roles_user_id;

-- Recreate with reference to auth.users
ALTER TABLE public.user_roles
  ADD CONSTRAINT fk_user_roles_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Update RLS policy to use auth.uid() directly
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);
