-- V2.0 Base Schema Migration
-- Generated: 2025-09-17
-- Consolidates all table definitions from 95+ individual migrations
--
-- This migration creates a clean foundation schema that replaces
-- the need for all previous migrations when starting fresh.

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =============================================================================
-- CORE TABLES (in dependency order)
-- =============================================================================

-- 1. PROFILES TABLE (Foundation - links to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    username text UNIQUE,
    display_name text,
    age integer, -- SECURITY: Never expose to UI - use UIProfileSelect type
    strava_user_id text,
    strava_access_token text,
    strava_refresh_token text,
    strava_expires_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 2. LEAGUES TABLE (Core business logic)
CREATE TABLE IF NOT EXISTS public.leagues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    admin_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    max_members integer DEFAULT 50,
    is_private boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 3. LEAGUE_MEMBERS TABLE (Authorization with approval workflow)
CREATE TABLE IF NOT EXISTS public.league_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    joined_at timestamptz DEFAULT now() NOT NULL,
    approved_at timestamptz,
    approved_by uuid REFERENCES public.profiles(id),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(league_id, user_id)
);

-- 4. LEAGUE_MEMBERSHIPS TABLE (Simple membership tracking without workflow)
CREATE TABLE IF NOT EXISTS public.league_memberships (
    league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('member', 'admin', 'owner')),
    joined_at timestamptz DEFAULT now() NOT NULL,
    PRIMARY KEY (league_id, user_id)
);

-- 5. GAMES TABLE (Game instances)
CREATE TABLE IF NOT EXISTS public.games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    description text,
    status text DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'finished', 'cancelled')),
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    start_date timestamptz DEFAULT now(),
    end_date timestamptz,
    duration_days integer DEFAULT 14 CHECK (duration_days >= 1 AND duration_days <= 365),
    activated_at timestamptz,
    finished_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 6. ACTIVITIES TABLE (Strava integration - GPS activities)
CREATE TABLE IF NOT EXISTS public.activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    strava_activity_id text UNIQUE,
    activity_type text DEFAULT 'Run',
    distance_meters numeric,
    duration_seconds integer,
    elevation_gain_meters numeric,
    start_point geometry(Point, 4326),
    territory_geom geometry(Polygon, 4326),
    polyline text, -- Encoded polyline from Strava
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- 7. USER_ACTIVITIES TABLE (Junction table for user-activity relationships)
CREATE TABLE IF NOT EXISTS public.user_activities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    activity_id uuid REFERENCES public.activities(id) ON DELETE CASCADE NOT NULL,
    strava_activity_id text,
    points_earned integer DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(user_id, activity_id)
);

-- 8. PLAYER_BASES TABLE (Player starting positions in games)
CREATE TABLE IF NOT EXISTS public.player_bases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    activity_id uuid REFERENCES public.user_activities(id) ON DELETE SET NULL,
    base_territory geometry(Polygon, 4326),
    base_point geometry(Point, 4326),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(game_id, user_id)
);

-- 9. TERRITORY_OWNERSHIP TABLE (Territory control tracking)
CREATE TABLE IF NOT EXISTS public.territory_ownership (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    territory_geom geometry(Polygon, 4326) NOT NULL,
    captured_at timestamptz DEFAULT now() NOT NULL,
    activity_id uuid REFERENCES public.activities(id) ON DELETE SET NULL,
    points_value integer DEFAULT 1,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- 10. ERROR_REPORTS TABLE (System monitoring and debugging)
CREATE TABLE IF NOT EXISTS public.error_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    error_message text NOT NULL,
    error_code text,
    context jsonb,
    user_agent text,
    url text,
    timestamp timestamptz DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false,
    resolution_notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- =============================================================================
-- ESSENTIAL INDEXES (Performance critical)
-- =============================================================================

-- Authorization queries (most critical)
CREATE INDEX IF NOT EXISTS idx_league_members_user_status
ON public.league_members (user_id, status)
WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_league_members_league_role
ON public.league_members (league_id, role, status)
WHERE status = 'approved';

-- Game queries
CREATE INDEX IF NOT EXISTS idx_games_league_status
ON public.games (league_id, status)
WHERE status IN ('active', 'setup');

CREATE INDEX IF NOT EXISTS idx_games_status_created
ON public.games (status, created_at);

-- Activity queries
CREATE INDEX IF NOT EXISTS idx_activities_user_created
ON public.activities (user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_user_activities_user_created
ON public.user_activities (user_id, created_at);

-- Player base queries
CREATE INDEX IF NOT EXISTS idx_player_bases_game_user
ON public.player_bases (game_id, user_id);

-- Territory queries
CREATE INDEX IF NOT EXISTS idx_territory_ownership_game_user
ON public.territory_ownership (game_id, user_id);

-- Profile queries
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
ON public.profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_profiles_username
ON public.profiles (username)
WHERE username IS NOT NULL;

-- Geospatial indexes for performance
CREATE INDEX IF NOT EXISTS idx_activities_territory_geom
ON public.activities USING GIST (territory_geom)
WHERE territory_geom IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_bases_territory_geom
ON public.player_bases USING GIST (base_territory)
WHERE base_territory IS NOT NULL;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_ownership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Leagues policies (public read, admin write)
CREATE POLICY "Anyone can view leagues" ON public.leagues
FOR SELECT TO authenticated USING (true);

CREATE POLICY "League admins can manage leagues" ON public.leagues
FOR ALL USING (admin_user_id = auth.uid());

-- League members policies
CREATE POLICY "Users see own memberships" ON public.league_members
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "League admins see all members" ON public.league_members
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = league_id AND l.admin_user_id = auth.uid()
    )
);

CREATE POLICY "Users can request league membership" ON public.league_members
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "League admins can manage memberships" ON public.league_members
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.leagues l
        WHERE l.id = league_id AND l.admin_user_id = auth.uid()
    )
);

-- Games policies
CREATE POLICY "League members can view league games" ON public.games
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.league_members lm
        WHERE lm.league_id = games.league_id
        AND lm.user_id = auth.uid()
        AND lm.status = 'approved'
    )
);

CREATE POLICY "League admins can manage games" ON public.games
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.league_members lm
        WHERE lm.league_id = games.league_id
        AND lm.user_id = auth.uid()
        AND lm.role IN ('admin', 'owner')
        AND lm.status = 'approved'
    )
);

-- Activities policies
CREATE POLICY "Users can view own activities" ON public.activities
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own activities" ON public.activities
FOR ALL USING (user_id = auth.uid());

-- User activities policies
CREATE POLICY "Users can view own user activities" ON public.user_activities
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage own user activities" ON public.user_activities
FOR ALL USING (user_id = auth.uid());

-- Player bases policies
CREATE POLICY "Users can view own player bases" ON public.player_bases
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Game participants can view all bases in game" ON public.player_bases
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.games g
        JOIN public.league_members lm ON g.league_id = lm.league_id
        WHERE g.id = game_id
        AND lm.user_id = auth.uid()
        AND lm.status = 'approved'
    )
);

CREATE POLICY "Users can manage own player bases" ON public.player_bases
FOR ALL USING (user_id = auth.uid());

-- Territory ownership policies
CREATE POLICY "Game participants can view territory in their games" ON public.territory_ownership
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.games g
        JOIN public.league_members lm ON g.league_id = lm.league_id
        WHERE g.id = game_id
        AND lm.user_id = auth.uid()
        AND lm.status = 'approved'
    )
);

-- Error reports policies
CREATE POLICY "Users can view own error reports" ON public.error_reports
FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can create error reports" ON public.error_reports
FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- =============================================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to relevant tables
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER leagues_updated_at
    BEFORE UPDATE ON public.leagues
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER league_members_updated_at
    BEFORE UPDATE ON public.league_members
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER games_updated_at
    BEFORE UPDATE ON public.games
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER activities_updated_at
    BEFORE UPDATE ON public.activities
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER player_bases_updated_at
    BEFORE UPDATE ON public.player_bases
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
    table_count integer;
    index_count integer;
    policy_count integer;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'profiles', 'leagues', 'league_members', 'league_memberships',
        'games', 'activities', 'user_activities', 'player_bases',
        'territory_ownership', 'error_reports'
    );

    -- Count indexes
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname LIKE 'idx_%';

    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public';

    RAISE NOTICE 'V2.0 BASE SCHEMA DEPLOYMENT SUMMARY:';
    RAISE NOTICE '  Tables created: %', table_count;
    RAISE NOTICE '  Indexes created: %', index_count;
    RAISE NOTICE '  RLS policies created: %', policy_count;

    IF table_count >= 10 AND index_count >= 10 AND policy_count >= 15 THEN
        RAISE NOTICE '✅ V2.0 base schema deployment SUCCESSFUL';
    ELSE
        RAISE WARNING '⚠️ V2.0 base schema deployment may be INCOMPLETE';
    END IF;
END;
$$;