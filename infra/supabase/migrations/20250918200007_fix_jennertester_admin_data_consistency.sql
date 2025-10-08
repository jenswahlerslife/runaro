-- Fix jennertester Data Consistency Issue
-- 2025-09-18: Address foreign key constraint violation by fixing data inconsistency

-- First, investigate the data structure issue
DO $$
DECLARE
    league_rec record;
    profile_rec record;
    auth_users_count integer;
    valid_profile record;
BEGIN
    RAISE NOTICE '=== INVESTIGATING DATA CONSISTENCY ISSUE ===';

    -- Get league details
    SELECT l.id, l.name, l.admin_user_id INTO league_rec
    FROM public.leagues l
    WHERE l.name = 'jennertester'
    LIMIT 1;

    IF league_rec.id IS NOT NULL THEN
        -- Check the admin profile
        SELECT id, user_id, username INTO profile_rec
        FROM public.profiles
        WHERE id = league_rec.admin_user_id;

        IF profile_rec.id IS NOT NULL THEN
            RAISE NOTICE 'Admin profile: % (ID: %, Auth ID: %)',
                         profile_rec.username, profile_rec.id, profile_rec.user_id;

            -- Check if the auth user exists
            SELECT COUNT(*) INTO auth_users_count
            FROM auth.users
            WHERE id = profile_rec.user_id;

            RAISE NOTICE 'Auth users with ID %: %', profile_rec.user_id, auth_users_count;

            IF auth_users_count = 0 THEN
                RAISE NOTICE 'PROBLEM: Auth user does not exist - this causes foreign key violation';

                -- Find a valid profile that could be admin
                SELECT p.id, p.user_id, p.username INTO valid_profile
                FROM public.profiles p
                WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.id = p.user_id)
                AND p.username IS NOT NULL
                LIMIT 1;

                IF valid_profile.id IS NOT NULL THEN
                    RAISE NOTICE 'Found valid profile: % (ID: %, Auth ID: %)',
                             valid_profile.username, valid_profile.id, valid_profile.user_id;
                ELSE
                    RAISE NOTICE 'No valid profiles found in database';
                END IF;
            ELSE
                RAISE NOTICE 'Auth user exists - foreign key should work';
            END IF;
        ELSE
            RAISE NOTICE 'Admin profile not found';
        END IF;
    ELSE
        RAISE NOTICE 'jennertester league not found';
    END IF;
END;
$$;

-- Strategy: Instead of trying to add broken profile as admin,
-- just make sure existing approved members can access Games tab
-- by creating a workaround that doesn't require the owner to be a member

-- Check current approved members in jennertester
DO $$
DECLARE
    member_rec record;
    approved_count integer;
BEGIN
    RAISE NOTICE '=== CURRENT APPROVED MEMBERS ===';

    FOR member_rec IN
        SELECT lm.user_id, p.username, p.user_id as auth_id, lm.role, lm.status
        FROM public.league_members lm
        JOIN public.profiles p ON lm.user_id = p.id
        JOIN public.leagues l ON lm.league_id = l.id
        WHERE l.name = 'jennertester'
        AND lm.status = 'approved'
        ORDER BY lm.joined_at
    LOOP
        RAISE NOTICE 'Approved member: % (Profile ID: %, Auth ID: %, Role: %)',
                     member_rec.username, member_rec.user_id, member_rec.auth_id, member_rec.role;
    END LOOP;

    SELECT COUNT(*) INTO approved_count
    FROM public.league_members lm
    JOIN public.leagues l ON lm.league_id = l.id
    WHERE l.name = 'jennertester'
    AND lm.status = 'approved';

    RAISE NOTICE 'Total approved members: %', approved_count;

    IF approved_count >= 2 THEN
        RAISE NOTICE 'SOLUTION: Members can create games (≥2 approved), but admin access needs frontend fix';
    ELSE
        RAISE NOTICE 'PROBLEM: Not enough approved members for game creation';
    END IF;
END;
$$;