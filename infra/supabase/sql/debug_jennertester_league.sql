-- Debug and Fix jennertester League
-- Check current state and approve all members

-- 1. Inspect the jennertester league
SELECT
    l.id as league_id,
    l.name,
    l.admin_user_id,
    l.is_public,
    p.username as admin_username
FROM public.leagues l
JOIN public.profiles p ON l.admin_user_id = p.id
WHERE l.name = 'jennertester';

-- 2. Check all members of jennertester league
SELECT
    lm.id as membership_id,
    lm.user_id,
    p.username,
    lm.role,
    lm.status,
    lm.joined_at,
    lm.approved_at,
    lm.approved_by
FROM public.league_members lm
JOIN public.profiles p ON lm.user_id = p.id
JOIN public.leagues l ON lm.league_id = l.id
WHERE l.name = 'jennertester'
ORDER BY lm.joined_at;

-- 3. Count approved vs total members
SELECT
    COUNT(*) as total_members,
    COUNT(CASE WHEN lm.status = 'approved' THEN 1 END) as approved_members,
    COUNT(CASE WHEN lm.status = 'pending' THEN 1 END) as pending_members
FROM public.league_members lm
JOIN public.leagues l ON lm.league_id = l.id
WHERE l.name = 'jennertester';

-- 4. Fix: Approve all members in jennertester league
WITH jennertester_league AS (
    SELECT id, admin_user_id
    FROM public.leagues
    WHERE name = 'jennertester'
)
UPDATE public.league_members lm
SET
    status = 'approved',
    approved_at = COALESCE(lm.approved_at, NOW()),
    approved_by = (SELECT admin_user_id FROM jennertester_league)
FROM jennertester_league jl
WHERE lm.league_id = jl.id
    AND lm.status != 'approved'
RETURNING lm.user_id, lm.status, lm.approved_at;

-- 5. Verify fix - check final state
SELECT
    l.name as league_name,
    COUNT(*) as total_members,
    COUNT(CASE WHEN lm.status = 'approved' THEN 1 END) as approved_members,
    CASE
        WHEN COUNT(CASE WHEN lm.status = 'approved' THEN 1 END) >= 2
        THEN 'CAN CREATE GAMES ✅'
        ELSE 'CANNOT CREATE GAMES ❌'
    END as game_creation_status
FROM public.leagues l
JOIN public.league_members lm ON l.id = lm.league_id
WHERE l.name = 'jennertester'
GROUP BY l.id, l.name;