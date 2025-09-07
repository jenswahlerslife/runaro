-- Territory System Validation Queries
-- Run these in Supabase SQL Editor to test the territory system

-- Safety timeouts
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

-- 1. Check if PostGIS is enabled
SELECT name, default_version, installed_version 
FROM pg_available_extensions 
WHERE name = 'postgis';

-- 2. Verify table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_activities' 
  AND table_schema = 'public'
  AND column_name IN ('route', 'is_base', 'included_in_game')
ORDER BY column_name;

-- 3. Check unique constraint on is_base
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'public.user_activities'::regclass
  AND conname LIKE '%base%';

-- 4. Check spatial index
SELECT 
  schemaname, 
  tablename, 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'user_activities' 
  AND indexname LIKE '%route%';

-- 5. Test territory function exists
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'refresh_user_territory'
  AND routine_schema = 'public';

-- 6. Sample activities with territory info (replace USER_ID with actual profile ID)
-- First, get a user's profile ID:
-- SELECT id, user_id, email FROM public.profiles LIMIT 1;

-- Then use that ID in the query below:
/*
SELECT 
  id,
  name,
  is_base,
  included_in_game,
  route IS NOT NULL as has_route,
  ST_NumPoints(route) as route_points,
  activity_type,
  start_date::date
FROM public.user_activities 
WHERE user_id = 'YOUR_PROFILE_ID_HERE'  -- Replace with actual profile ID
ORDER BY start_date DESC
LIMIT 10;
*/

-- 7. Count activities by territory status for a user
/*
SELECT 
  is_base,
  included_in_game,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE route IS NOT NULL) as with_routes
FROM public.user_activities 
WHERE user_id = 'YOUR_PROFILE_ID_HERE'  -- Replace with actual profile ID
GROUP BY is_base, included_in_game
ORDER BY is_base DESC, included_in_game DESC;
*/

-- 8. Test territory calculation (replace with actual profile ID and adjust tolerance)
-- SELECT public.refresh_user_territory('YOUR_PROFILE_ID_HERE', 50);

-- 9. Check for activities with missing routes that should have them
SELECT 
  COUNT(*) as activities_without_routes,
  COUNT(*) FILTER (WHERE polyline IS NOT NULL) as have_polyline_but_no_route
FROM public.user_activities
WHERE route IS NULL;

-- 10. Validate route geometries (check for invalid geometries)
SELECT 
  id, 
  name,
  ST_IsValid(route) as is_valid_geometry,
  ST_GeometryType(route) as geometry_type,
  ST_SRID(route) as srid
FROM public.user_activities
WHERE route IS NOT NULL
  AND NOT ST_IsValid(route)
LIMIT 5;

-- Expected Results:
-- 1. PostGIS should show as installed
-- 2. Should see route (geometry), is_base (boolean), included_in_game (boolean) columns  
-- 3. Should see unique constraint on (user_id) WHERE is_base = true
-- 4. Should see GiST index on route column
-- 5. Should see refresh_user_territory function
-- 6-8. Should show user's activities with territory status
-- 9. Shows activities that need route generation
-- 10. Should return no invalid geometries (empty result set is good)