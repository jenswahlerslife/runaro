-- Verification Script: Security & Performance Hardening
-- Run this after deploying the hardening migrations to verify fixes

-- =============================================================================
-- PART A: RLS STATUS VERIFICATION  
-- =============================================================================

SELECT 'RLS Status on App Tables:' as section;

SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE WHEN rowsecurity THEN '✅' ELSE '❌' END as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 'user_activities', 'leagues', 'league_members', 
    'league_memberships', 'league_join_requests', 'games', 
    'player_bases', 'territory_takeovers'
  )
ORDER BY tablename;

-- =============================================================================
-- PART B: POSTGIS SYSTEM TABLES PRIVILEGES
-- =============================================================================

SELECT 'PostGIS System Tables Access:' as section;

SELECT 
  table_name,
  privilege_type,
  grantee,
  CASE 
    WHEN grantee IN ('anon', 'authenticated') AND privilege_type = 'SELECT' 
    THEN '❌ SHOULD BE REVOKED'
    ELSE '✅ OK'
  END as security_status
FROM information_schema.role_table_grants 
WHERE table_schema = 'public' 
  AND table_name IN ('spatial_ref_sys', 'geometry_columns', 'geography_columns')
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY table_name, grantee;

-- =============================================================================
-- PART C: FUNCTION SECURITY STATUS
-- =============================================================================

SELECT 'Function Security Status:' as section;

SELECT 
  proname as function_name,
  prosecdef as security_definer,
  proconfig as search_path_config,
  CASE 
    WHEN prosecdef AND proconfig IS NOT NULL THEN '✅ SECURE'
    WHEN prosecdef AND proconfig IS NULL THEN '⚠️  MISSING search_path'
    ELSE '❌ NOT SECURITY DEFINER'
  END as security_status
FROM pg_proc 
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  AND proname IN (
    'refresh_user_territory', 'increment_user_points', 'calculate_player_territory',
    'check_territory_takeover', 'recalculate_game_territories', 'get_game_leaderboard',
    'finish_game', 'create_game', 'set_player_base', 'start_game',
    'manage_league_membership', 'approve_join_request', 'decline_join_request',
    'get_admin_pending_requests_count', 'get_admin_pending_requests', 
    'get_admin_recent_requests'
  )
ORDER BY proname;

-- =============================================================================
-- PART D: INDEX STATUS FOR PERFORMANCE
-- =============================================================================

SELECT 'Performance Indexes Created:' as section;

SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND (
    indexname LIKE 'idx_%' 
    OR indexname LIKE 'uniq_%'
  )
  AND tablename IN (
    'profiles', 'user_activities', 'leagues', 'league_members',
    'league_memberships', 'league_join_requests', 'games',
    'player_bases', 'territory_takeovers'  
  )
ORDER BY tablename, indexname;

-- =============================================================================
-- PART E: SECURITY POLICIES COUNT
-- =============================================================================

SELECT 'RLS Policies per Table:' as section;

SELECT 
  schemaname,
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ HAS POLICIES'
    ELSE '❌ NO POLICIES'
  END as policy_status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'user_activities', 'leagues', 'league_members',
    'league_memberships', 'league_join_requests', 'games', 
    'player_bases', 'territory_takeovers'
  )
GROUP BY schemaname, tablename
ORDER BY tablename;

-- =============================================================================
-- PART F: FUNCTION EXECUTE PRIVILEGES  
-- =============================================================================

SELECT 'Function Execute Privileges:' as section;

SELECT 
  routine_name as function_name,
  grantee,
  privilege_type,
  CASE 
    WHEN grantee = 'authenticated' AND privilege_type = 'EXECUTE' THEN '✅ CORRECT'
    WHEN grantee IN ('anon', 'public') THEN '❌ TOO PERMISSIVE'  
    ELSE '⚠️  CHECK'
  END as privilege_status
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name IN (
    'refresh_user_territory', 'increment_user_points', 'calculate_player_territory',
    'approve_join_request', 'decline_join_request'
  )
ORDER BY routine_name, grantee;

-- =============================================================================
-- PART G: TABLE STATISTICS
-- =============================================================================

SELECT 'Table Statistics:' as section;

SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates, 
  n_tup_del as deletes,
  last_analyze,
  CASE 
    WHEN last_analyze > NOW() - INTERVAL '1 day' THEN '✅ RECENT'
    ELSE '⚠️  OLD STATS'
  END as stats_status
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
  AND relname IN (
    'profiles', 'user_activities', 'leagues', 'league_join_requests'
  )
ORDER BY relname;

-- =============================================================================
-- PART H: SUMMARY REPORT
-- =============================================================================

SELECT 'SECURITY & PERFORMANCE HARDENING SUMMARY:' as section;

WITH security_summary AS (
  SELECT 
    COUNT(*) as total_app_tables,
    COUNT(*) FILTER (WHERE rowsecurity = true) as rls_enabled_tables
  FROM pg_tables 
  WHERE schemaname = 'public' 
    AND tablename IN (
      'profiles', 'user_activities', 'leagues', 'league_members',
      'league_memberships', 'league_join_requests', 'games', 
      'player_bases', 'territory_takeovers'
    )
),
function_summary AS (
  SELECT 
    COUNT(*) as total_functions,
    COUNT(*) FILTER (WHERE prosecdef = true) as secure_functions,
    COUNT(*) FILTER (WHERE prosecdef = true AND proconfig IS NOT NULL) as hardened_functions
  FROM pg_proc 
  WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND proname LIKE '%user%' OR proname LIKE '%game%' OR proname LIKE '%league%'
),
index_summary AS (
  SELECT COUNT(*) as performance_indexes
  FROM pg_indexes 
  WHERE schemaname = 'public' 
    AND (indexname LIKE 'idx_%' OR indexname LIKE 'uniq_%')
)
SELECT 
  s.total_app_tables || ' app tables, ' || s.rls_enabled_tables || ' with RLS enabled' as rls_status,
  f.total_functions || ' functions, ' || f.hardened_functions || ' security hardened' as function_status, 
  i.performance_indexes || ' performance indexes created' as index_status,
  CASE 
    WHEN s.rls_enabled_tables = s.total_app_tables 
     AND f.hardened_functions >= 10  -- Expected minimum
     AND i.performance_indexes >= 15 -- Expected minimum
    THEN '✅ HARDENING SUCCESSFUL'
    ELSE '⚠️  REVIEW NEEDED'
  END as overall_status
FROM security_summary s, function_summary f, index_summary i;