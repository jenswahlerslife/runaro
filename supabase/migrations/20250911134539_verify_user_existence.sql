-- Verify user existence and fix FK constraint issues
-- This migration checks for the specific issue with user IDs not existing in auth.users

-- First, let's check if we have any orphaned records in league_members
SELECT 
  'Checking for orphaned league_members records...' as status;

-- Check for league_members records that reference non-existent users
DO $$
DECLARE 
  orphaned_count integer;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM public.league_members lm
  LEFT JOIN auth.users u ON lm.user_id = u.id
  WHERE u.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned league_members records', orphaned_count;
    -- Clean up orphaned records
    DELETE FROM public.league_members 
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    RAISE NOTICE 'Cleaned up % orphaned league_members records', orphaned_count;
  ELSE
    RAISE NOTICE 'No orphaned league_members records found';
  END IF;
END $$;

-- Check if we have any orphaned records in league_join_requests
DO $$
DECLARE 
  orphaned_count integer;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM public.league_join_requests ljr
  LEFT JOIN auth.users u ON ljr.user_id = u.id
  WHERE u.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned league_join_requests records', orphaned_count;
    -- Clean up orphaned records
    DELETE FROM public.league_join_requests 
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    RAISE NOTICE 'Cleaned up % orphaned league_join_requests records', orphaned_count;
  ELSE
    RAISE NOTICE 'No orphaned league_join_requests records found';
  END IF;
END $$;

-- Check if we have any orphaned records in profiles
DO $$
DECLARE 
  orphaned_count integer;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.user_id = u.id
  WHERE u.id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE NOTICE 'Found % orphaned profiles records', orphaned_count;
    -- Clean up orphaned records
    DELETE FROM public.profiles 
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    RAISE NOTICE 'Cleaned up % orphaned profiles records', orphaned_count;
  ELSE
    RAISE NOTICE 'No orphaned profiles records found';
  END IF;
END $$;

-- Add a safer create_league function that handles edge cases better
CREATE OR REPLACE FUNCTION public.create_league_safe(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT false,
  p_max_members integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  league_record record;
  user_id_val uuid;
  user_exists boolean;
BEGIN
  -- Get the current user ID
  user_id_val := auth.uid();
  
  IF user_id_val IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;

  -- Verify the user actually exists in auth.users
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = user_id_val) INTO user_exists;
  
  IF NOT user_exists THEN
    RETURN json_build_object('success', false, 'error', 'User session invalid - user not found');
  END IF;

  -- Ensure user has a profile
  INSERT INTO public.profiles (id, user_id)
  VALUES (user_id_val, user_id_val)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create the league
  INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
  VALUES (p_name, p_description, user_id_val, p_is_public, p_max_members)
  RETURNING * INTO league_record;

  -- Add the creator as owner in league_members table
  INSERT INTO public.league_members (league_id, user_id, role, joined_at)
  VALUES (league_record.id, user_id_val, 'owner', now());

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'invite_code', league_record.invite_code,
    'debug_user_id', user_id_val
  );
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Foreign key constraint violation - user may not exist in auth.users',
      'debug_user_id', user_id_val,
      'debug_detail', SQLERRM
    );
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Failed to create league: ' || SQLERRM,
      'debug_user_id', user_id_val
    );
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.create_league_safe(text, text, boolean, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_league_safe(text, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league_safe(text, text, boolean, integer) TO authenticated;

SELECT 'User existence verification and safe create_league function added' as status;