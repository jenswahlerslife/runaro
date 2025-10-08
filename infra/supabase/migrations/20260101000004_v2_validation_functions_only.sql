-- V2.0 Validation Functions Only
-- Generated: 2025-09-17
-- Adds V2.0 validation functions without data manipulation

BEGIN;

-- =============================================================================
-- V2.0 VALIDATION FUNCTIONS
-- =============================================================================

-- Function to validate data integrity for current schema
CREATE OR REPLACE FUNCTION public.validate_v2_data_integrity()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  validation_results json;
  profile_issues integer := 0;
  league_issues integer := 0;
  game_issues integer := 0;
  member_issues integer := 0;
  total_issues integer := 0;
BEGIN
  -- Check for profiles without valid user_id
  SELECT COUNT(*) INTO profile_issues
  FROM public.profiles
  WHERE user_id IS NULL;

  -- Check for games without valid league_id
  SELECT COUNT(*) INTO game_issues
  FROM public.games
  WHERE league_id IS NULL;

  -- Check for league_members without valid relationships
  SELECT COUNT(*) INTO member_issues
  FROM public.league_members
  WHERE league_id IS NULL OR user_id IS NULL;

  -- Check for leagues without valid admin
  SELECT COUNT(*) INTO league_issues
  FROM public.leagues
  WHERE admin_user_id IS NULL;

  total_issues := profile_issues + league_issues + game_issues + member_issues;

  validation_results := json_build_object(
    'total_issues', total_issues,
    'profile_issues', profile_issues,
    'league_issues', league_issues,
    'game_issues', game_issues,
    'member_issues', member_issues,
    'validation_passed', (total_issues = 0),
    'timestamp', NOW()
  );

  RETURN validation_results;
END;
$$;

-- Create migration report function
CREATE OR REPLACE FUNCTION public.generate_v2_migration_report()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  migration_report json;
  table_stats json;
  data_validation json;
  performance_stats json;
BEGIN
  -- Get table statistics
  SELECT json_build_object(
    'profiles', (SELECT COUNT(*) FROM public.profiles),
    'leagues', (SELECT COUNT(*) FROM public.leagues),
    'league_members', (SELECT COUNT(*) FROM public.league_members),
    'league_memberships', (SELECT COUNT(*) FROM public.league_memberships),
    'games', (SELECT COUNT(*) FROM public.games),
    'error_reports', (SELECT COUNT(*) FROM public.error_reports)
  ) INTO table_stats;

  -- Validate data integrity
  SELECT public.validate_v2_data_integrity() INTO data_validation;

  -- Get performance statistics
  SELECT json_build_object(
    'approved_league_members', (
      SELECT COUNT(*) FROM public.league_members WHERE status = 'approved'
    ),
    'active_games', (
      SELECT COUNT(*) FROM public.games WHERE status = 'active'
    ),
    'setup_games', (
      SELECT COUNT(*) FROM public.games WHERE status = 'setup'
    ),
    'strava_connected_users', (
      SELECT COUNT(*) FROM public.profiles WHERE strava_access_token IS NOT NULL
    )
  ) INTO performance_stats;

  -- Build comprehensive report
  migration_report := json_build_object(
    'migration_version', 'v2.0',
    'migration_timestamp', NOW(),
    'table_statistics', table_stats,
    'data_validation', data_validation,
    'performance_statistics', performance_stats,
    'migration_status', CASE
      WHEN (data_validation->>'validation_passed')::boolean THEN 'SUCCESS'
      ELSE 'ISSUES_FOUND'
    END
  );

  RETURN migration_report;
END;
$$;

-- =============================================================================
-- SET FUNCTION PERMISSIONS
-- =============================================================================

REVOKE ALL ON FUNCTION public.validate_v2_data_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_v2_data_integrity() TO authenticated;

REVOKE ALL ON FUNCTION public.generate_v2_migration_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_v2_migration_report() TO authenticated;

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  validation_result json;
  migration_report json;
BEGIN
  -- Test the new functions
  SELECT public.validate_v2_data_integrity() INTO validation_result;
  SELECT public.generate_v2_migration_report() INTO migration_report;

  RAISE NOTICE 'V2.0 VALIDATION FUNCTIONS DEPLOYMENT:';
  RAISE NOTICE '  Data validation: %', CASE
    WHEN (validation_result->>'validation_passed')::boolean THEN 'PASSED ✅'
    ELSE 'ISSUES FOUND ⚠️'
  END;

  RAISE NOTICE '  Migration report: %', migration_report->>'migration_status';
  RAISE NOTICE '✅ V2.0 validation functions deployed successfully';
END;
$$;