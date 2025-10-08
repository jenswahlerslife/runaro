-- Verify and fix RPC function access
-- Check if the function exists and has proper permissions

-- List all functions named create_league_with_owner
SELECT 
  proname as function_name,
  proargnames as parameter_names,
  prosrc as function_source
FROM pg_proc 
WHERE proname = 'create_league_with_owner';

-- Grant permissions explicitly to all relevant roles
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text) TO service_role;

-- Also grant USAGE on the schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

SELECT 'Verified RPC function access and permissions' as status;