-- V2.0 Performance Indexes
-- Generated: 2025-09-17T08:41:51.585Z
-- Essential indexes for optimal query performance

-- Approved member queries (Critical priority)
CREATE INDEX IF NOT EXISTS idx_league_members_user_status
ON league_members (user_id, status);

-- Active/setup game queries (High priority)
CREATE INDEX IF NOT EXISTS idx_games_league_status
ON games (league_id, status);

-- Activity timeline queries (Medium priority)
CREATE INDEX IF NOT EXISTS idx_activities_user_created
ON activities (user_id, created_at);

-- Game setup queries (High priority)
CREATE INDEX IF NOT EXISTS idx_player_bases_game_user
ON player_bases (game_id, user_id);

