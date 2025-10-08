-- Fix ensure_admin_league_membership trigger to use 'owner' role
-- Problem: Trigger was setting role to 'admin' instead of 'owner' for league creators
-- This caused leagues not to appear in "my leagues" because of filtering logic

CREATE OR REPLACE FUNCTION public.ensure_admin_league_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert admin as owner (not 'admin') with approved status
  INSERT INTO public.league_members (league_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.admin_user_id, 'owner', 'approved', NOW())
  ON CONFLICT (league_id, user_id) DO UPDATE SET
    role = 'owner',  -- Changed from 'admin' to 'owner'
    status = 'approved',
    joined_at = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ensure_admin_league_membership() IS
'Trigger function that automatically creates owner membership when a league is created. Uses owner role for proper league visibility.';

SELECT 'Fixed ensure_admin_league_membership to use owner role' as status;
