-- Quick security status check after optimization
DO $$
DECLARE
    rls_count INTEGER;
    secured_functions INTEGER;
    policies_count INTEGER;
BEGIN
    -- Check RLS status
    SELECT COUNT(*) INTO rls_count 
    FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename IN ('profiles', 'user_activities', 'leagues', 'league_memberships', 'league_join_requests')
      AND rowsecurity = true;
    
    -- Check secured functions
    SELECT COUNT(*) INTO secured_functions
    FROM pg_proc 
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND prosecdef = true;
      
    -- Check policy count
    SELECT COUNT(*) INTO policies_count
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    RAISE NOTICE 'Security Status After Optimization:';
    RAISE NOTICE '- Tables with RLS enabled: %', rls_count;
    RAISE NOTICE '- Functions with SECURITY DEFINER: %', secured_functions;
    RAISE NOTICE '- Total RLS policies: %', policies_count;
    RAISE NOTICE 'Optimization completed successfully!';
END $$;

SELECT 'Verification Complete - Check logs above for security status' AS status;