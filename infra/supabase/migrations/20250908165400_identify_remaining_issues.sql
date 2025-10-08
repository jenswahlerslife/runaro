-- Identify remaining auth.uid() policies that need optimization
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    RAISE NOTICE 'REMAINING POLICIES WITH auth.uid() ISSUES:';
    RAISE NOTICE '================================================';
    
    FOR policy_rec IN
        SELECT schemaname, tablename, policyname, cmd, qual, with_check
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND (qual LIKE '%auth.uid()%' OR with_check LIKE '%auth.uid()%')
        ORDER BY tablename, policyname
    LOOP
        RAISE NOTICE 'Table: %.% | Policy: % | Command: %', 
                     policy_rec.schemaname, policy_rec.tablename, policy_rec.policyname, policy_rec.cmd;
        
        IF policy_rec.qual IS NOT NULL AND policy_rec.qual LIKE '%auth.uid()%' THEN
            RAISE NOTICE '  USING: %', LEFT(policy_rec.qual, 200);
        END IF;
        
        IF policy_rec.with_check IS NOT NULL AND policy_rec.with_check LIKE '%auth.uid()%' THEN
            RAISE NOTICE '  WITH CHECK: %', LEFT(policy_rec.with_check, 200);
        END IF;
        
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE 'These policies need to be optimized to use (SELECT auth.uid()) instead of direct auth.uid()';
END $$;

SELECT 'Identification complete' AS status;