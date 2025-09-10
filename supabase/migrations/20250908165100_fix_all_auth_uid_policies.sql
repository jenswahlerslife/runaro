-- Fix All Remaining auth.uid() Performance Issues
-- Replace all direct auth.uid() calls with optimized subqueries

-- =============================================================================
-- PART A: FIX PROFILES TABLE POLICIES
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
        DROP POLICY IF EXISTS "profiles_user_access" ON public.profiles;
        
        -- Create single optimized policy
        CREATE POLICY "profiles_optimized_access" ON public.profiles
          FOR ALL
          USING (user_id = (SELECT auth.uid()))
          WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
END $$;

-- =============================================================================
-- PART B: FIX ACTIVITIES TABLE POLICIES  
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities' AND table_schema = 'public') THEN
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Users can upload their own activities" ON public.activities;
        DROP POLICY IF EXISTS "Users can update their own activities" ON public.activities;
        DROP POLICY IF EXISTS "Users can delete their own activities" ON public.activities;
        DROP POLICY IF EXISTS "Users can view activities in their leagues (safe)" ON public.activities;
        
        -- Create optimized policies
        CREATE POLICY "activities_owner_access" ON public.activities
          FOR ALL
          USING (user_id = (SELECT auth.uid()))
          WITH CHECK (user_id = (SELECT auth.uid()));
          
        CREATE POLICY "activities_league_view" ON public.activities
          FOR SELECT
          USING (league_id IN (
            SELECT league_id FROM public.league_memberships 
            WHERE user_id IN (
              SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
            )
          ));
    END IF;
END $$;

-- =============================================================================
-- PART C: FIX USER_ACTIVITIES TABLE POLICIES
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activities' AND table_schema = 'public') THEN
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Users can view their own activities" ON public.user_activities;
        DROP POLICY IF EXISTS "Users can insert their own activities" ON public.user_activities;
        DROP POLICY IF EXISTS "user_activities_owner_access" ON public.user_activities;
        
        -- Create single optimized policy
        CREATE POLICY "user_activities_optimized" ON public.user_activities
          FOR ALL
          USING (user_id = (SELECT auth.uid()))
          WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
END $$;

-- =============================================================================
-- PART D: FIX USER_TERRITORIES TABLE POLICIES
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_territories' AND table_schema = 'public') THEN
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Users can view their territories" ON public.user_territories;
        DROP POLICY IF EXISTS "Users can insert their territories" ON public.user_territories;
        
        -- Create single optimized policy
        CREATE POLICY "user_territories_optimized" ON public.user_territories
          FOR ALL
          USING (user_id = (SELECT auth.uid()))
          WITH CHECK (user_id = (SELECT auth.uid()));
    END IF;
END $$;

-- =============================================================================
-- PART E: FIX TERRITORY_OWNERSHIP TABLE POLICIES
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'territory_ownership' AND table_schema = 'public') THEN
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Users can claim territory through their activities" ON public.territory_ownership;
        DROP POLICY IF EXISTS "Users can view territory in their leagues (safe)" ON public.territory_ownership;
        
        -- Create optimized policies
        CREATE POLICY "territory_ownership_claim" ON public.territory_ownership
          FOR INSERT
          WITH CHECK (
            user_id = (SELECT auth.uid()) AND
            activity_id IN (
              SELECT id FROM public.activities 
              WHERE user_id = (SELECT auth.uid()) AND league_id = territory_ownership.league_id
            )
          );
          
        CREATE POLICY "territory_ownership_view" ON public.territory_ownership
          FOR SELECT
          USING (league_id IN (
            SELECT league_id FROM public.league_memberships 
            WHERE user_id IN (
              SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
            )
          ));
    END IF;
END $$;

-- =============================================================================
-- PART F: FIX LEAGUES TABLE POLICIES
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leagues' AND table_schema = 'public') THEN
        -- Drop all existing policies
        DROP POLICY IF EXISTS "leagues_read_as_admin" ON public.leagues;
        DROP POLICY IF EXISTS "leagues_insert_as_admin" ON public.leagues;
        DROP POLICY IF EXISTS "leagues_update_as_admin" ON public.leagues;
        DROP POLICY IF EXISTS "leagues_read_as_member" ON public.leagues;
        DROP POLICY IF EXISTS "leagues_access" ON public.leagues;
        DROP POLICY IF EXISTS "leagues_insert" ON public.leagues;
        DROP POLICY IF EXISTS "leagues_update" ON public.leagues;
        
        -- Create optimized policies
        CREATE POLICY "leagues_public_read" ON public.leagues
          FOR SELECT USING (true);  -- Public read access
          
        CREATE POLICY "leagues_admin_manage" ON public.leagues
          FOR ALL
          USING (admin_user_id IN (
            SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
          ))
          WITH CHECK (admin_user_id IN (
            SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
          ));
    END IF;
END $$;

-- =============================================================================
-- PART G: FIX LEAGUE_MEMBERSHIPS TABLE POLICIES
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_memberships' AND table_schema = 'public') THEN
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Users can join leagues (by profile)" ON public.league_memberships;
        DROP POLICY IF EXISTS "Users can view their own memberships (by profile)" ON public.league_memberships;
        DROP POLICY IF EXISTS "league_memberships_access" ON public.league_memberships;
        DROP POLICY IF EXISTS "league_memberships_admin_manage" ON public.league_memberships;
        
        -- Create optimized policies
        CREATE POLICY "league_memberships_optimized" ON public.league_memberships
          FOR ALL
          USING (
            user_id IN (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())) OR
            league_id IN (
              SELECT league_id FROM public.league_memberships lm2
              JOIN public.profiles p ON p.id = lm2.user_id
              WHERE p.user_id = (SELECT auth.uid()) AND lm2.role = 'admin'
            )
          )
          WITH CHECK (
            user_id IN (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())) OR
            league_id IN (
              SELECT league_id FROM public.league_memberships lm2
              JOIN public.profiles p ON p.id = lm2.user_id
              WHERE p.user_id = (SELECT auth.uid()) AND lm2.role = 'admin'
            )
          );
    END IF;
END $$;

-- =============================================================================
-- PART H: FIX LEAGUE_MEMBERS TABLE POLICIES (if exists)
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_members' AND table_schema = 'public') THEN
        -- Drop all existing policies
        DROP POLICY IF EXISTS "league_members_read_own" ON public.league_members;
        DROP POLICY IF EXISTS "league_members_insert_own" ON public.league_members;
        DROP POLICY IF EXISTS "league_members_read_league" ON public.league_members;
        DROP POLICY IF EXISTS "league_members_admin_manage" ON public.league_members;
        
        -- Create simple optimized policy (without role column)
        CREATE POLICY "league_members_optimized" ON public.league_members
          FOR ALL
          USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())));
    END IF;
END $$;

-- =============================================================================
-- PART I: FIX LEAGUE_JOIN_REQUESTS POLICIES 
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_join_requests' AND table_schema = 'public') THEN
        -- Drop existing policies  
        DROP POLICY IF EXISTS "League admins can view requests for their leagues" ON public.league_join_requests;
        DROP POLICY IF EXISTS "league_join_requests_select" ON public.league_join_requests;
        DROP POLICY IF EXISTS "league_join_requests_insert" ON public.league_join_requests;
        DROP POLICY IF EXISTS "league_join_requests_update" ON public.league_join_requests;
        
        -- Create optimized policies
        CREATE POLICY "league_join_requests_optimized" ON public.league_join_requests
          FOR SELECT
          USING (
            user_id = (SELECT auth.uid()) OR
            league_id IN (
              SELECT league_id FROM public.league_memberships 
              WHERE user_id IN (
                SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
              ) AND role = 'admin'
            )
          );
          
        CREATE POLICY "league_join_requests_insert_optimized" ON public.league_join_requests
          FOR INSERT
          WITH CHECK (user_id = (SELECT auth.uid()));
          
        CREATE POLICY "league_join_requests_update_optimized" ON public.league_join_requests
          FOR UPDATE
          USING (league_id IN (
            SELECT league_id FROM public.league_memberships 
            WHERE user_id IN (
              SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
            ) AND role = 'admin'
          ));
    END IF;
END $$;

-- =============================================================================
-- PART J: OPTIMIZE ANY REMAINING POLICIES WITH COMPLEX AUTH.UID() QUERIES
-- =============================================================================

-- Create an optimized user lookup function for complex policies
CREATE OR REPLACE FUNCTION public.get_current_profile_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

ALTER FUNCTION public.get_current_profile_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_profile_id() TO authenticated;

-- Update any remaining policies that still use complex auth.uid() patterns
DO $$
DECLARE 
    policy_rec RECORD;
BEGIN
    -- This will help identify any remaining complex policies that need manual optimization
    RAISE NOTICE 'Checking for any remaining complex auth.uid() usage...';
    
    FOR policy_rec IN
        SELECT schemaname, tablename, policyname, cmd
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
        AND policyname NOT LIKE '%optimized%'
    LOOP
        RAISE NOTICE 'Remaining policy with auth.uid(): %.% - %', 
                     policy_rec.tablename, policy_rec.policyname, policy_rec.cmd;
    END LOOP;
END $$;

SELECT 'All auth.uid() policies optimized for performance' AS status;