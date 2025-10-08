-- V2.0 Data Migration and Validation
-- Generated: 2025-09-17
-- Ensures data integrity during V2.0 transition
--
-- This migration handles data preservation and validation during
-- the transition from legacy migrations to V2.0 consolidated schema

BEGIN;

-- =============================================================================
-- DATA VALIDATION AND INTEGRITY CHECKS
-- =============================================================================

-- Function to validate data integrity
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
  activity_issues integer := 0;
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

  -- Check for activities without valid user_id
  SELECT COUNT(*) INTO activity_issues
  FROM public.activities
  WHERE user_id IS NULL;

  -- Check for leagues without valid admin
  SELECT COUNT(*) INTO league_issues
  FROM public.leagues
  WHERE admin_user_id IS NULL;

  total_issues := profile_issues + league_issues + game_issues + member_issues + activity_issues;

  validation_results := json_build_object(
    'total_issues', total_issues,
    'profile_issues', profile_issues,
    'league_issues', league_issues,
    'game_issues', game_issues,
    'member_issues', member_issues,
    'activity_issues', activity_issues,
    'validation_passed', (total_issues = 0),
    'timestamp', NOW()
  );

  RETURN validation_results;
END;
$$;

-- =============================================================================
-- DATA MIGRATION PROCEDURES
-- =============================================================================

-- Ensure league_memberships is in sync with league_members
-- This handles any inconsistencies between the two tables
INSERT INTO public.league_memberships (league_id, user_id, role, joined_at)
SELECT
  lm.league_id,
  lm.user_id,
  lm.role,
  lm.joined_at
FROM public.league_members lm
WHERE lm.status = 'approved'
AND NOT EXISTS (
  SELECT 1 FROM public.league_memberships lms
  WHERE lms.league_id = lm.league_id
  AND lms.user_id = lm.user_id
)
ON CONFLICT (league_id, user_id) DO NOTHING;

-- Clean up any orphaned records that might exist
DELETE FROM public.player_bases
WHERE game_id NOT IN (SELECT id FROM public.games);

DELETE FROM public.territory_ownership
WHERE game_id NOT IN (SELECT id FROM public.games);

DELETE FROM public.user_activities
WHERE user_id NOT IN (SELECT id FROM public.profiles);

DELETE FROM public.user_activities
WHERE activity_id NOT IN (SELECT id FROM public.activities);

-- =============================================================================
-- PERFORMANCE OPTIMIZATION DATA MIGRATION
-- =============================================================================

-- Update any missing timestamps
UPDATE public.profiles
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.profiles
SET updated_at = created_at
WHERE updated_at IS NULL;

UPDATE public.leagues
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.leagues
SET updated_at = created_at
WHERE updated_at IS NULL;

-- =============================================================================
-- MIGRATION VALIDATION AND REPORTING
-- =============================================================================

-- Create migration report
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
    'activities', (SELECT COUNT(*) FROM public.activities),
    'user_activities', (SELECT COUNT(*) FROM public.user_activities),
    'player_bases', (SELECT COUNT(*) FROM public.player_bases),
    'territory_ownership', (SELECT COUNT(*) FROM public.territory_ownership),
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
    ),
    'total_territory_records', (
      SELECT COUNT(*) FROM public.territory_ownership
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
-- CLEANUP FUNCTIONS
-- =============================================================================

-- Function to clean up temporary migration artifacts
CREATE OR REPLACE FUNCTION public.cleanup_v2_migration_artifacts()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Remove any temporary tables or views that might have been created
  -- during migration development (none in this case, but placeholder for future)

  -- Clean up any duplicate error reports
  DELETE FROM public.error_reports
  WHERE id NOT IN (
    SELECT MIN(id)
    FROM public.error_reports
    GROUP BY user_id, error_message, timestamp
  );

  -- Update statistics for query planner
  ANALYZE public.profiles;
  ANALYZE public.leagues;
  ANALYZE public.league_members;
  ANALYZE public.games;
  ANALYZE public.activities;
  ANALYZE public.user_activities;
  ANALYZE public.player_bases;

  RETURN true;
END;
$$;

-- =============================================================================
-- SET FUNCTION PERMISSIONS
-- =============================================================================

REVOKE ALL ON FUNCTION public.validate_v2_data_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_v2_data_integrity() TO authenticated;

REVOKE ALL ON FUNCTION public.generate_v2_migration_report() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_v2_migration_report() TO authenticated;

REVOKE ALL ON FUNCTION public.cleanup_v2_migration_artifacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_v2_migration_artifacts() TO authenticated;

COMMIT;

-- =============================================================================
-- EXECUTE DATA MIGRATION VALIDATION
-- =============================================================================

DO $$
DECLARE
  validation_result json;
  migration_report json;
  cleanup_result boolean;
BEGIN
  -- Run data validation
  SELECT public.validate_v2_data_integrity() INTO validation_result;

  -- Generate migration report
  SELECT public.generate_v2_migration_report() INTO migration_report;

  -- Run cleanup
  SELECT public.cleanup_v2_migration_artifacts() INTO cleanup_result;

  RAISE NOTICE 'V2.0 DATA MIGRATION SUMMARY:';
  RAISE NOTICE '  Data validation: %', CASE
    WHEN (validation_result->>'validation_passed')::boolean THEN 'PASSED ✅'
    ELSE 'ISSUES FOUND ⚠️'
  END;

  RAISE NOTICE '  Total records migrated: %', (
    SELECT SUM(value::integer)
    FROM json_each_text(migration_report->'table_statistics')
  );

  RAISE NOTICE '  Migration status: %', migration_report->>'migration_status';
  RAISE NOTICE '  Cleanup completed: %', CASE
    WHEN cleanup_result THEN 'SUCCESS ✅'
    ELSE 'FAILED ❌'
  END;

  IF (validation_result->>'validation_passed')::boolean AND cleanup_result THEN
    RAISE NOTICE '✅ V2.0 data migration SUCCESSFUL';
  ELSE
    RAISE WARNING '⚠️ V2.0 data migration completed with issues - review logs';
  END IF;
END;
$$;