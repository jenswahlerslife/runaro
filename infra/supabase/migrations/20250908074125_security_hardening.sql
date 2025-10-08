-- Security Hardening Migration (Minimal Safe Version)
-- Fixes critical Security Advisor issues without breaking existing setup

-- =============================================================================
-- PART A: RLS FOR EXISTING TABLES ONLY
-- =============================================================================

-- Only enable RLS on tables that exist and don't already have it
DO $$ 
BEGIN
    -- profiles table (most critical)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles' AND rowsecurity = true) THEN
            ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        END IF;
    END IF;
    
    -- user_activities table 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activities' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_activities' AND rowsecurity = true) THEN
            ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
        END IF;
    END IF;
    
    -- leagues table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leagues' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'leagues' AND rowsecurity = true) THEN
            ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
        END IF;
    END IF;
    
    -- league_memberships table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_memberships' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'league_memberships' AND rowsecurity = true) THEN
            ALTER TABLE public.league_memberships ENABLE ROW LEVEL SECURITY;
        END IF;
    END IF;
    
    -- league_join_requests table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_join_requests' AND table_schema = 'public') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'league_join_requests' AND rowsecurity = true) THEN
            ALTER TABLE public.league_join_requests ENABLE ROW LEVEL SECURITY;
        END IF;
    END IF;
END $$;

-- =============================================================================
-- PART B: SECURE EXISTING FUNCTIONS ONLY
-- =============================================================================

-- Fix existing join request functions (the most critical ones)
DO $$ 
BEGIN
    -- approve_join_request
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'approve_join_request' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        EXECUTE 'ALTER FUNCTION public.approve_join_request(uuid) SECURITY DEFINER SET search_path = public, pg_temp';
        EXECUTE 'REVOKE ALL ON FUNCTION public.approve_join_request(uuid) FROM PUBLIC, anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid) TO authenticated';
    END IF;
    
    -- decline_join_request  
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decline_join_request' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        EXECUTE 'ALTER FUNCTION public.decline_join_request(uuid) SECURITY DEFINER SET search_path = public, pg_temp';
        EXECUTE 'REVOKE ALL ON FUNCTION public.decline_join_request(uuid) FROM PUBLIC, anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.decline_join_request(uuid) TO authenticated';
    END IF;
    
    -- get_admin_pending_requests_count (check different signatures)
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_pending_requests_count' AND pronargs = 0) THEN
        EXECUTE 'ALTER FUNCTION public.get_admin_pending_requests_count() SECURITY DEFINER SET search_path = public, pg_temp';
        EXECUTE 'REVOKE ALL ON FUNCTION public.get_admin_pending_requests_count() FROM PUBLIC, anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_pending_requests_count() TO authenticated';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_pending_requests_count' AND pronargs = 1) THEN
        EXECUTE 'ALTER FUNCTION public.get_admin_pending_requests_count(uuid) SECURITY DEFINER SET search_path = public, pg_temp';
        EXECUTE 'REVOKE ALL ON FUNCTION public.get_admin_pending_requests_count(uuid) FROM PUBLIC, anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_pending_requests_count(uuid) TO authenticated';
    END IF;
    
    -- get_admin_pending_requests
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_pending_requests') THEN
        EXECUTE 'ALTER FUNCTION public.get_admin_pending_requests(uuid) SECURITY DEFINER SET search_path = public, pg_temp';
        EXECUTE 'REVOKE ALL ON FUNCTION public.get_admin_pending_requests(uuid) FROM PUBLIC, anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_pending_requests(uuid) TO authenticated';
    END IF;
    
    -- get_admin_recent_requests
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_admin_recent_requests') THEN
        EXECUTE 'ALTER FUNCTION public.get_admin_recent_requests(uuid) SECURITY DEFINER SET search_path = public, pg_temp';
        EXECUTE 'REVOKE ALL ON FUNCTION public.get_admin_recent_requests(uuid) FROM PUBLIC, anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_admin_recent_requests(uuid) TO authenticated';
    END IF;
    
    -- increment_user_points
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_user_points') THEN
        EXECUTE 'ALTER FUNCTION public.increment_user_points(uuid, integer) SECURITY DEFINER SET search_path = public, pg_temp';
        EXECUTE 'REVOKE ALL ON FUNCTION public.increment_user_points(uuid, integer) FROM PUBLIC, anon';
        EXECUTE 'GRANT EXECUTE ON FUNCTION public.increment_user_points(uuid, integer) TO authenticated';
    END IF;
END $$;

-- =============================================================================
-- PART C: BASIC POSTGIS SECURITY (MINIMAL)
-- =============================================================================

-- Only revoke PostGIS access if the tables exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spatial_ref_sys' AND table_schema = 'public') THEN
        REVOKE SELECT ON TABLE public.spatial_ref_sys FROM anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'geometry_columns' AND table_schema = 'public') THEN  
        REVOKE SELECT ON TABLE public.geometry_columns FROM anon, authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'geography_columns' AND table_schema = 'public') THEN
        REVOKE SELECT ON TABLE public.geography_columns FROM anon, authenticated;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if privileges don't exist
    NULL;
END $$;

-- =============================================================================
-- PART D: ESSENTIAL RLS POLICIES
-- =============================================================================

-- Only create essential policies for core tables
DO $$
BEGIN
    -- profiles policies (most critical)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        -- Drop and recreate to ensure consistency
        DROP POLICY IF EXISTS "Users can view and edit own profile" ON public.profiles;
        CREATE POLICY "Users can view and edit own profile" ON public.profiles
          FOR ALL
          USING (user_id = auth.uid())
          WITH CHECK (user_id = auth.uid());
    END IF;
    
    -- user_activities policies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activities' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users can manage own activities" ON public.user_activities;
        CREATE POLICY "Users can manage own activities" ON public.user_activities
          FOR ALL
          USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
          WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
    END IF;
    
    -- league_join_requests policies (already exist but ensure they're correct)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_join_requests' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Users can insert own join requests" ON public.league_join_requests;
        CREATE POLICY "Users can insert own join requests" ON public.league_join_requests
          FOR INSERT
          WITH CHECK (user_id = auth.uid());
          
        DROP POLICY IF EXISTS "Users can view own join requests" ON public.league_join_requests;
        CREATE POLICY "Users can view own join requests" ON public.league_join_requests
          FOR SELECT  
          USING (user_id = auth.uid());
          
        DROP POLICY IF EXISTS "Admins can view league requests" ON public.league_join_requests;
        CREATE POLICY "Admins can view league requests" ON public.league_join_requests
          FOR SELECT
          USING (
            league_id IN (
              SELECT league_id 
              FROM public.league_memberships 
              WHERE user_id = auth.uid() AND role = 'admin'
            )
          );
    END IF;
END $$;

-- =============================================================================
-- COMPLETION LOG  
-- =============================================================================

SELECT 'Security Hardening (Minimal) - Core RLS and function security applied' AS status;