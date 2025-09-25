-- Fix get_active_game_for_league to include both 'active' and 'setup' games
-- This enables UI to show "Start Game" button for newly created games in setup phase

-- Drop the existing function first to avoid return type conflict
DROP FUNCTION IF EXISTS public.get_active_game_for_league(uuid);

CREATE OR REPLACE FUNCTION public.get_active_game_for_league(p_league_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    status text,
    start_date timestamptz,
    duration_days integer,
    end_at timestamptz,
    time_left_seconds integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
WITH g AS (
    SELECT *
    FROM public.games
    WHERE league_id = p_league_id
      AND status IN ('active', 'setup')
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    g.id,
    g.name,
    g.status,
    g.start_date,
    g.duration_days,
    CASE
        WHEN g.status = 'active' THEN g.start_date + make_interval(days => COALESCE(g.duration_days, 14))
        ELSE NULL
    END AS end_at,
    CASE
        WHEN g.status = 'active' THEN GREATEST(
            0,
            EXTRACT(EPOCH FROM ((g.start_date + make_interval(days => COALESCE(g.duration_days, 14))) - now()))
        )::int
        ELSE NULL
    END AS time_left_seconds
FROM g
WHERE EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.league_id = p_league_id
      AND lm.user_id = auth.uid()
      AND lm.status = 'approved'
);
$$;

-- Security: Revoke public access and grant to authenticated users only
REVOKE ALL ON FUNCTION public.get_active_game_for_league(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_game_for_league(uuid) TO authenticated;