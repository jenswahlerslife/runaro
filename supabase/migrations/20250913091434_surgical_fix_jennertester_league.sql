-- Surgical fix for jennertester league member approval
-- Diagnose and fix the specific league that should work

-- First, let's see what's in the jennertester league
DO $$
DECLARE
    league_info record;
    member_info record;
    approved_count integer;
BEGIN
    -- Find the league
    SELECT id, name, admin_user_id INTO league_info 
    FROM public.leagues 
    WHERE name = 'jennertester' 
    LIMIT 1;
    
    IF league_info.id IS NOT NULL THEN
        RAISE NOTICE 'Found league: % (id: %)', league_info.name, league_info.id;
        
        -- Check members
        FOR member_info IN 
            SELECT user_id, role, status, joined_at, approved_at
            FROM public.league_members
            WHERE league_id = league_info.id
            ORDER BY joined_at
        LOOP
            RAISE NOTICE 'Member: user_id=%, role=%, status=%, joined=%, approved=%', 
                member_info.user_id, member_info.role, member_info.status, 
                member_info.joined_at, member_info.approved_at;
        END LOOP;
        
        -- Count approved members
        SELECT COUNT(*) INTO approved_count
        FROM public.league_members
        WHERE league_id = league_info.id AND status = 'approved';
        
        RAISE NOTICE 'Approved member count: %', approved_count;
        
    ELSE
        RAISE NOTICE 'League jennertester not found';
    END IF;
END $$;

-- Now approve all members in jennertester league
WITH target AS (
  SELECT id, admin_user_id FROM public.leagues WHERE name = 'jennertester' LIMIT 1
)
UPDATE public.league_members lm
SET status = 'approved',
    approved_at = COALESCE(approved_at, now()),
    approved_by = (SELECT admin_user_id FROM target)
FROM target
WHERE lm.league_id = target.id
  AND lm.status != 'approved';

-- Verify the fix
DO $$
DECLARE
    approved_count integer;
    league_id_val uuid;
BEGIN
    SELECT id INTO league_id_val FROM public.leagues WHERE name = 'jennertester' LIMIT 1;
    
    SELECT COUNT(*) INTO approved_count
    FROM public.league_members
    WHERE league_id = league_id_val AND status = 'approved';
    
    RAISE NOTICE 'After fix - Approved members in jennertester: %', approved_count;
    
    IF approved_count >= 2 THEN
        RAISE NOTICE 'SUCCESS: jennertester league is ready for game creation!';
    ELSE
        RAISE NOTICE 'ISSUE: Still only % approved members', approved_count;
    END IF;
END $$;

-- Also ensure we have proper constraints and function checks
-- Verify create_game function exists with correct signature
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_game' 
        AND proargtypes::regtype[] = ARRAY['uuid','text']::regtype[]
    ) THEN
        RAISE NOTICE 'create_game function exists with correct signature';
    ELSE
        RAISE NOTICE 'WARNING: create_game function missing or wrong signature';
    END IF;
END $$;

SELECT 'Surgical fix for jennertester league completed' as status;