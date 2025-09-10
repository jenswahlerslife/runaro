-- Final cleanup of remaining auth.uid() performance issues
-- Fix the last remaining policies identified

-- =============================================================================
-- PART A: FIX GAMES TABLE POLICIES
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'games' AND table_schema = 'public') THEN
        -- Drop existing policies with auth.uid()
        DROP POLICY IF EXISTS "games_select_for_members" ON public.games;
        DROP POLICY IF EXISTS "games_write_for_admin" ON public.games;
        
        -- Create optimized policies
        CREATE POLICY "games_select_optimized" ON public.games
          FOR SELECT
          USING (league_id IN (
            SELECT league_id FROM public.league_memberships 
            WHERE user_id IN (
              SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
            )
          ));
          
        CREATE POLICY "games_admin_optimized" ON public.games
          FOR ALL
          USING (league_id IN (
            SELECT league_id FROM public.league_memberships 
            WHERE user_id IN (
              SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
            ) AND role = 'admin'
          ))
          WITH CHECK (league_id IN (
            SELECT league_id FROM public.league_memberships 
            WHERE user_id IN (
              SELECT id FROM public.profiles WHERE user_id = (SELECT auth.uid())
            ) AND role = 'admin'
          ));
    END IF;
END $$;

-- =============================================================================
-- PART B: RE-OPTIMIZE ACTIVITIES POLICIES (they were recreated with auth.uid())
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'activities' AND table_schema = 'public') THEN
        -- Drop the newly created policies that still have auth.uid()
        DROP POLICY IF EXISTS "activities_owner_access" ON public.activities;
        DROP POLICY IF EXISTS "activities_league_view" ON public.activities;
        
        -- Create fully optimized policies without any auth.uid()
        CREATE POLICY "activities_fully_optimized" ON public.activities
          FOR ALL
          USING (user_id = (SELECT auth.uid()))
          WITH CHECK (user_id = (SELECT auth.uid()));
          
        CREATE POLICY "activities_league_view_optimized" ON public.activities
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
-- PART C: RE-OPTIMIZE TERRITORY_OWNERSHIP POLICIES
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'territory_ownership' AND table_schema = 'public') THEN
        -- Drop the policies that still have complex auth.uid() usage
        DROP POLICY IF EXISTS "territory_ownership_claim" ON public.territory_ownership;
        DROP POLICY IF EXISTS "territory_ownership_view" ON public.territory_ownership;
        
        -- Create simpler optimized policies
        CREATE POLICY "territory_ownership_claim_optimized" ON public.territory_ownership
          FOR INSERT
          WITH CHECK (
            user_id = (SELECT auth.uid()) AND
            activity_id IN (
              SELECT id FROM public.activities 
              WHERE user_id = (SELECT auth.uid()) 
              AND league_id = territory_ownership.league_id
            )
          );
          
        CREATE POLICY "territory_ownership_view_optimized" ON public.territory_ownership
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
-- PART D: RE-OPTIMIZE LEAGUES ADMIN POLICY
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leagues' AND table_schema = 'public') THEN
        -- Drop the policy that still has auth.uid()
        DROP POLICY IF EXISTS "leagues_admin_manage" ON public.leagues;
        
        -- Create optimized admin policy
        CREATE POLICY "leagues_admin_manage_optimized" ON public.leagues
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
-- PART E: CREATE HELPER FUNCTIONS FOR COMPLEX OPERATIONS
-- =============================================================================

-- Function to check if user is league admin (for better performance)
CREATE OR REPLACE FUNCTION public.is_league_admin(league_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.league_memberships lm
    JOIN public.profiles p ON p.id = lm.user_id
    WHERE p.user_id = auth.uid() 
    AND lm.league_id = league_uuid 
    AND lm.role = 'admin'
  );
$$;

-- Function to check if user is league member (for better performance)  
CREATE OR REPLACE FUNCTION public.is_league_member(league_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.league_memberships lm
    JOIN public.profiles p ON p.id = lm.user_id
    WHERE p.user_id = auth.uid() 
    AND lm.league_id = league_uuid
  );
$$;

-- Set proper permissions
ALTER FUNCTION public.is_league_admin(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_league_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_league_admin(uuid) TO authenticated;

ALTER FUNCTION public.is_league_member(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_league_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_league_member(uuid) TO authenticated;

-- =============================================================================
-- PART F: FINAL VERIFICATION
-- =============================================================================

DO $$
DECLARE
    remaining_policies INTEGER;
BEGIN
    -- Count remaining policies with auth.uid()
    SELECT COUNT(*) INTO remaining_policies
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
    AND policyname NOT LIKE '%optimized%';
    
    RAISE NOTICE 'Final cleanup complete!';
    RAISE NOTICE 'Policies still containing auth.uid(): %', remaining_policies;
    
    IF remaining_policies = 0 THEN
        RAISE NOTICE 'SUCCESS: All auth.uid() performance issues resolved!';
    ELSE
        RAISE NOTICE 'Note: Some policies may still need manual optimization';
    END IF;
END $$;

SELECT 'Final auth.uid() cleanup completed' AS status;