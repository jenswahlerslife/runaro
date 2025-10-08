-- Fix jennertester League Members
-- 2025-09-18: Approve all members in jennertester league to enable game creation

-- Approve all members in the jennertester league
WITH jennertester_league AS (
    SELECT id, admin_user_id
    FROM public.leagues
    WHERE name = 'jennertester'
    LIMIT 1
)
UPDATE public.league_members lm
SET
    status = 'approved',
    approved_at = COALESCE(lm.approved_at, NOW()),
    approved_by = COALESCE(lm.approved_by, (SELECT admin_user_id FROM jennertester_league))
FROM jennertester_league jl
WHERE lm.league_id = jl.id
    AND lm.status != 'approved';

-- Verify the fix
DO $$
DECLARE
    league_rec record;
    approved_count integer;
BEGIN
    -- Get jennertester league info
    SELECT l.id, l.name, l.admin_user_id INTO league_rec
    FROM public.leagues l
    WHERE l.name = 'jennertester'
    LIMIT 1;

    IF league_rec.id IS NOT NULL THEN
        -- Count approved members
        SELECT COUNT(*) INTO approved_count
        FROM public.league_members lm
        WHERE lm.league_id = league_rec.id
            AND lm.status = 'approved';

        RAISE NOTICE 'SUCCESS: jennertester league (%) now has % approved members - Games can be created!',
                     league_rec.id, approved_count;
    ELSE
        RAISE NOTICE 'WARNING: jennertester league not found';
    END IF;
END;
$$;