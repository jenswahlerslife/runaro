-- Debug jennertester League in Detail
-- Check admin status and active games

-- 1. Find jennertester league details
SELECT
    l.id as league_id,
    l.name,
    l.admin_user_id,
    l.is_public,
    p.username as admin_username,
    p.user_id as admin_auth_id
FROM public.leagues l
JOIN public.profiles p ON l.admin_user_id = p.id
WHERE l.name = 'jennertester';

-- 2. Check all members and their roles
SELECT
    lm.id as membership_id,
    lm.user_id,
    p.username,
    p.user_id as auth_user_id,
    lm.role,
    lm.status,
    lm.joined_at,
    lm.approved_at,
    CASE
        WHEN l.admin_user_id = lm.user_id THEN 'OWNER'
        WHEN lm.role = 'admin' THEN 'ADMIN'
        ELSE 'MEMBER'
    END as computed_role
FROM public.league_members lm
JOIN public.profiles p ON lm.user_id = p.id
JOIN public.leagues l ON lm.league_id = l.id
WHERE l.name = 'jennertester'
ORDER BY lm.joined_at;

-- 3. Check for any active games in jennertester
SELECT
    g.id as game_id,
    g.name as game_name,
    g.status,
    g.created_at,
    g.start_date,
    g.end_date,
    g.duration_days,
    COUNT(pb.user_id) as players_with_bases
FROM public.games g
LEFT JOIN public.player_bases pb ON g.id = pb.game_id
JOIN public.leagues l ON g.league_id = l.id
WHERE l.name = 'jennertester'
GROUP BY g.id, g.name, g.status, g.created_at, g.start_date, g.end_date, g.duration_days
ORDER BY g.created_at DESC;

-- 4. Test RPC function get_active_game_for_league
SELECT public.get_active_game_for_league(
    (SELECT id FROM public.leagues WHERE name = 'jennertester' LIMIT 1)
) as active_game_result;

-- 5. Test RPC function for user leagues (simulates frontend call)
-- This would need to be run with actual user auth context
SELECT 'RPC test would require user session - check if user sees jennertester as admin league' as note;