-- Essential Performance Indexes
-- 2025-09-16: Add critical indexes for better performance using correct table names

-- Add indexes for the league_members table (which has the status column)
CREATE INDEX IF NOT EXISTS idx_league_members_user_status
ON public.league_members (user_id, status)
WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_league_members_league_status
ON public.league_members (league_id, status)
WHERE status = 'approved';

-- Add indexes for games table
CREATE INDEX IF NOT EXISTS idx_games_league_status
ON public.games (league_id, status)
WHERE status IN ('active', 'setup');

CREATE INDEX IF NOT EXISTS idx_games_status_start
ON public.games (status, start_date)
WHERE status = 'setup';

-- Add indexes for activities table (when it gets data)
CREATE INDEX IF NOT EXISTS idx_activities_user_created
ON public.activities (user_id, created_at DESC);

-- Add indexes for player_bases table (for game setup queries)
CREATE INDEX IF NOT EXISTS idx_player_bases_game_user
ON public.player_bases (game_id, user_id);

CREATE INDEX IF NOT EXISTS idx_player_bases_user_game
ON public.player_bases (user_id, game_id);

-- Add helpful comments
COMMENT ON INDEX idx_league_members_user_status IS 'Optimize user league membership queries with approved status';
COMMENT ON INDEX idx_games_league_status IS 'Optimize active/setup game queries by league';
COMMENT ON INDEX idx_activities_user_created IS 'Optimize user activity timeline queries';

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'SUCCESS: Essential performance indexes created with correct table names';
END;
$$;