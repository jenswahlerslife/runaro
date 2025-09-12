-- Fix get_admin_pending_requests_count function to work with updated schema
-- This function is used by the LeaguesPage to count pending requests

-- Drop existing versions of the function
DROP FUNCTION IF EXISTS public.get_admin_pending_requests_count();
DROP FUNCTION IF EXISTS public.get_admin_pending_requests_count(uuid);

-- Create the correct version that works with league_members table instead of league_memberships
CREATE OR REPLACE FUNCTION public.get_admin_pending_requests_count(league_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Check if current user is admin/owner of the league using league_members
    IF NOT EXISTS (
        SELECT 1 FROM public.league_members 
        WHERE league_members.league_id = get_admin_pending_requests_count.league_id
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    ) THEN
        RETURN 0;
    END IF;

    -- Return count of pending requests
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.league_join_requests 
        WHERE league_join_requests.league_id = get_admin_pending_requests_count.league_id
        AND status = 'pending'
    );
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.get_admin_pending_requests_count(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_admin_pending_requests_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_pending_requests_count(uuid) TO authenticated;

-- Also ensure the get_admin_pending_requests function exists and works correctly
CREATE OR REPLACE FUNCTION public.get_admin_pending_requests(league_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    result json;
BEGIN
    -- Check if current user is admin/owner of the league using league_members
    IF NOT EXISTS (
        SELECT 1 FROM public.league_members 
        WHERE league_members.league_id = get_admin_pending_requests.league_id
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin')
    ) THEN
        RETURN '[]'::json;
    END IF;

    -- Get pending requests with user details
    SELECT json_agg(
        json_build_object(
            'id', ljr.id,
            'league_id', ljr.league_id,
            'user_id', ljr.user_id,
            'status', ljr.status,
            'created_at', ljr.created_at,
            'username', COALESCE(p.username, p.display_name, 'Unknown'),
            'email', au.email
        )
    )
    INTO result
    FROM public.league_join_requests ljr
    LEFT JOIN public.profiles p ON ljr.user_id = p.user_id
    LEFT JOIN auth.users au ON ljr.user_id = au.id
    WHERE ljr.league_id = get_admin_pending_requests.league_id
    AND ljr.status = 'pending'
    ORDER BY ljr.created_at;

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.get_admin_pending_requests(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_admin_pending_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_pending_requests(uuid) TO authenticated;

SELECT 'Admin pending requests functions fixed to work with league_members schema' as status;