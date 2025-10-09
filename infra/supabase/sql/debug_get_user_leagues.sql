-- Debug get_user_leagues function for jennertester admin
-- Check if the function correctly identifies admin status

-- Test the get_user_leagues function directly
-- This should show the jennertester league with is_admin = true
SELECT
    id,
    name,
    admin_user_id,
    is_admin,
    role,
    membership_status,
    member_count
FROM public.get_user_leagues()
WHERE name = 'jennertester';

-- Compare with direct database query
-- Check what the raw data shows
SELECT
    l.id,
    l.name,
    l.admin_user_id,
    p.username as admin_username,
    p.user_id as admin_auth_id,
    CASE
        WHEN l.admin_user_id = p.id THEN 'true (owner)'
        ELSE 'false'
    END as should_be_admin,
    lm.role as membership_role,
    lm.status as membership_status
FROM public.leagues l
LEFT JOIN public.profiles p ON l.admin_user_id = p.id
LEFT JOIN public.league_members lm ON l.id = lm.league_id AND lm.user_id = l.admin_user_id
WHERE l.name = 'jennertester';

-- Check all memberships in jennertester
SELECT
    lm.id,
    lm.user_id,
    lm.role,
    lm.status,
    p.username,
    p.user_id as auth_id,
    CASE
        WHEN l.admin_user_id = lm.user_id THEN 'OWNER'
        ELSE 'MEMBER'
    END as computed_role
FROM public.league_members lm
JOIN public.profiles p ON lm.user_id = p.id
JOIN public.leagues l ON lm.league_id = l.id
WHERE l.name = 'jennertester';