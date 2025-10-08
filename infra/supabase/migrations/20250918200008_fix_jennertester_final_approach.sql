-- Final Fix for jennertester Admin Access
-- 2025-09-18: Correct approach using auth user ID instead of profile ID

-- The issue is that league_members.user_id should reference auth.users.id, not profiles.id
-- But our leagues.admin_user_id currently references profiles.id
-- So we need to insert using the auth user ID from the profile

-- Insert owner as admin member using the correct auth user ID
WITH jennertester_owner AS (
    SELECT
        l.id as league_id,
        l.admin_user_id as profile_id,
        p.user_id as auth_user_id,  -- This is what league_members.user_id expects
        p.username
    FROM public.leagues l
    JOIN public.profiles p ON l.admin_user_id = p.id
    WHERE l.name = 'jennertester'
    LIMIT 1
)
INSERT INTO public.league_members (league_id, user_id, role, status, joined_at, approved_at, approved_by)
SELECT
    jo.league_id,
    jo.auth_user_id,  -- Use the auth user ID, not profile ID
    'admin',
    'approved',
    NOW(),
    NOW(),
    jo.profile_id  -- approved_by still uses profile ID
FROM jennertester_owner jo
WHERE NOT EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = jo.league_id
    AND lm.user_id = jo.auth_user_id  -- Check against auth user ID
)
ON CONFLICT (league_id, user_id) DO UPDATE SET
    role = 'admin',
    status = 'approved',
    approved_at = COALESCE(league_members.approved_at, NOW()),
    approved_by = COALESCE(league_members.approved_by, EXCLUDED.approved_by);

-- Final verification
DO $$
DECLARE
    league_rec record;
    owner_membership record;
    total_approved integer;
BEGIN
    RAISE NOTICE '=== FINAL VERIFICATION ===';

    -- Get league and owner details
    SELECT
        l.id, l.name, l.admin_user_id,
        p.username, p.user_id as auth_user_id
    INTO league_rec
    FROM public.leagues l
    JOIN public.profiles p ON l.admin_user_id = p.id
    WHERE l.name = 'jennertester'
    LIMIT 1;

    IF league_rec.id IS NOT NULL THEN
        -- Check if owner now has admin membership (using auth user ID)
        SELECT lm.role, lm.status, p.username
        INTO owner_membership
        FROM public.league_members lm
        JOIN public.profiles p ON lm.user_id = p.user_id  -- Join on auth user ID
        WHERE lm.league_id = league_rec.id
        AND lm.user_id = league_rec.auth_user_id;  -- Match against auth user ID

        -- Count total approved members
        SELECT COUNT(*) INTO total_approved
        FROM public.league_members lm
        WHERE lm.league_id = league_rec.id
        AND lm.status = 'approved';

        RAISE NOTICE 'Owner: % (Auth ID: %)', league_rec.username, league_rec.auth_user_id;

        IF owner_membership.role IS NOT NULL THEN
            RAISE NOTICE 'SUCCESS: Owner has admin membership (role: %, status: %)',
                         owner_membership.role, owner_membership.status;
        ELSE
            RAISE NOTICE 'WARNING: Owner still has no membership';
        END IF;

        RAISE NOTICE 'Total approved members: %', total_approved;

        IF total_approved >= 2 AND owner_membership.status = 'approved' THEN
            RAISE NOTICE '🎉 COMPLETE SUCCESS: Games tab should now be clickable!';
        ELSE
            RAISE NOTICE '⚠️ Issue may persist - check frontend logic';
        END IF;
    ELSE
        RAISE NOTICE 'ERROR: jennertester league not found';
    END IF;
END;
$$;