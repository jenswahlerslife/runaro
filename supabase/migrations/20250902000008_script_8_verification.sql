-- Script 8: Final verification

-- Check all tables exist
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('leagues', 'league_members', 'games', 'player_bases', 'territory_takeovers', 'user_activities', 'profiles')
ORDER BY tablename;

-- Check functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN ('create_league', 'join_league', 'refresh_user_territory')
  AND routine_schema = 'public';

-- Check PostGIS is enabled
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name = 'postgis';

SELECT 'TERRITORY GAME MIGRATION COMPLETE! 🎮🏆' as final_status;