-- Simple fixes for the database errors without major restructuring
-- This addresses immediate issues found in error logs

-- 1) Create league_memberships view to maintain compatibility
CREATE OR REPLACE VIEW public.league_memberships AS
SELECT 
    league_id,
    user_id,
    role,
    joined_at
FROM public.league_members;

-- Grant permissions on the view
GRANT SELECT ON public.league_memberships TO authenticated;

-- 2) Add policy to allow users to see their own join requests
ALTER TABLE public.league_join_requests ENABLE ROW LEVEL SECURITY;

-- Drop conflicting policy if exists
DROP POLICY IF EXISTS "users_can_read_own_requests" ON public.league_join_requests;

-- Create policy: Users can see their own requests
CREATE POLICY "users_can_read_own_requests"
ON public.league_join_requests
FOR SELECT
USING (user_id = auth.uid());

-- 3) Create a helper function for getting user leagues without complex joins
CREATE OR REPLACE FUNCTION get_user_leagues(user_uuid uuid)
RETURNS TABLE (
    league_id uuid,
    league_name text,
    is_admin boolean,
    pending_requests_count bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id as league_id,
        l.name as league_name,
        (lm.role IN ('owner', 'admin')) as is_admin,
        CASE 
            WHEN lm.role IN ('owner', 'admin') THEN (
                SELECT COUNT(*) 
                FROM league_join_requests ljr 
                WHERE ljr.league_id = l.id 
                AND ljr.status = 'pending'
            )
            ELSE 0::bigint
        END as pending_requests_count
    FROM public.leagues l
    INNER JOIN public.league_members lm ON lm.league_id = l.id
    WHERE lm.user_id = user_uuid;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_user_leagues(uuid) TO authenticated;

SELECT 'Simple database fixes applied' as status;