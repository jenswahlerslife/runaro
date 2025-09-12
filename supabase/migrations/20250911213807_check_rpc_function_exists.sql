-- Check if the RPC function exists
SELECT routine_name, specific_schema
FROM information_schema.routines
WHERE routine_name ILIKE '%league%';

-- Also check what functions exist in public schema
SELECT proname as function_name, proargnames as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND proname ILIKE '%league%';

SELECT 'Function existence check completed' as status;