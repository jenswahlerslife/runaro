-- Performance Tuning Migration (Safe Version)
-- Adds essential indexes for query performance

-- =============================================================================
-- PART A: CORE FOREIGN KEY INDEXES (EXISTING TABLES ONLY)
-- =============================================================================

-- Only create indexes on tables that exist
DO $$
BEGIN
    -- profiles table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
    END IF;
    
    -- user_activities table  
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activities' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);
    END IF;
    
    -- league_memberships table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_memberships' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_league_memberships_league_id ON public.league_memberships(league_id);
        CREATE INDEX IF NOT EXISTS idx_league_memberships_user_id ON public.league_memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_league_memberships_role ON public.league_memberships(role);
    END IF;
    
    -- league_join_requests table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_join_requests' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_league_join_requests_league_id ON public.league_join_requests(league_id);
        CREATE INDEX IF NOT EXISTS idx_league_join_requests_user_id ON public.league_join_requests(user_id);
        CREATE INDEX IF NOT EXISTS idx_league_join_requests_status ON public.league_join_requests(status);
    END IF;
    
    -- leagues table
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leagues' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_leagues_name_search ON public.leagues(lower(name));
    END IF;
END $$;

-- =============================================================================  
-- PART B: PARTIAL INDEXES FOR COMMON QUERIES
-- =============================================================================

DO $$
BEGIN
    -- Partial index for pending join requests (most common admin query)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_join_requests' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_league_join_requests_pending 
          ON public.league_join_requests(league_id, created_at DESC) 
          WHERE status = 'pending';
    END IF;
    
    -- Partial index for admin memberships (authorization checks)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_memberships' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_league_memberships_admin
          ON public.league_memberships(league_id, user_id)
          WHERE role = 'admin';
    END IF;
    
    -- Base activities index (territory calculations) - only if column exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_activities' AND column_name = 'is_base' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_user_activities_base
          ON public.user_activities(user_id)
          WHERE is_base = true;
    END IF;
END $$;

-- =============================================================================
-- PART C: UPDATE TABLE STATISTICS  
-- =============================================================================

-- Update statistics for better query planning (only on existing tables)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        ANALYZE public.profiles;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activities' AND table_schema = 'public') THEN
        ANALYZE public.user_activities;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leagues' AND table_schema = 'public') THEN
        ANALYZE public.leagues;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_memberships' AND table_schema = 'public') THEN
        ANALYZE public.league_memberships;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_join_requests' AND table_schema = 'public') THEN
        ANALYZE public.league_join_requests;
    END IF;
END $$;

-- =============================================================================
-- COMPLETION LOG
-- =============================================================================

SELECT 'Performance Tuning (Safe) - Essential indexes added for existing tables' AS status;