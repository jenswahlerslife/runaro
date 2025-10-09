-- Migration 1: Create Multiplayer League System
-- Safety timeouts
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add PostGIS columns to user_activities (from earlier migration)
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

-- Create unique constraint: only one base per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
ON public.user_activities (user_id)
WHERE is_base = true;

-- Create spatial index on route column for performance
CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
  ON public.user_activities
  USING GIST (route);

-- Create leagues table
CREATE TABLE IF NOT EXISTS public.leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  admin_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
  is_public boolean NOT NULL DEFAULT false,
  max_members integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create league members table (M:N relationship)
CREATE TABLE IF NOT EXISTS public.league_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'left')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  UNIQUE(league_id, user_id)
);

-- Create games table (30-day territorial competitions)
CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'finished', 'cancelled')),
  start_date timestamptz,
  end_date timestamptz,
  winner_user_id uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create player bases table (one base per player per game)
CREATE TABLE IF NOT EXISTS public.player_bases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES public.user_activities(id) ON DELETE CASCADE,
  base_date timestamptz NOT NULL,
  territory_size_km2 numeric DEFAULT 0,
  last_calculated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id)
);

-- Create territory takeovers table (log of territory changes)
CREATE TABLE IF NOT EXISTS public.territory_takeovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  taken_from_user_id uuid NOT NULL REFERENCES public.profiles(id),
  taken_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  activity_id uuid NOT NULL REFERENCES public.user_activities(id),
  intersection_point geometry(Point, 4326),
  territory_lost_km2 numeric DEFAULT 0,
  territory_gained_km2 numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leagues_admin ON public.leagues(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);
CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_status ON public.league_members(status);
CREATE INDEX IF NOT EXISTS idx_games_league ON public.games(league_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
CREATE INDEX IF NOT EXISTS idx_player_bases_game ON public.player_bases(game_id);
CREATE INDEX IF NOT EXISTS idx_player_bases_user ON public.player_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_territory_takeovers_game ON public.territory_takeovers(game_id);
CREATE INDEX IF NOT EXISTS idx_territory_takeovers_intersection ON public.territory_takeovers USING GIST(intersection_point);

-- Enable RLS on all tables
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_takeovers ENABLE ROW LEVEL SECURITY;

-- Add RLS policy for leagues
CREATE POLICY "Users can view leagues they are members of or public leagues"
ON public.leagues FOR SELECT
USING (
  is_public = true OR
  admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  id IN (
    SELECT league_id FROM public.league_members lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE p.user_id = auth.uid() AND lm.status = 'approved'
  )
);

CREATE POLICY "Only authenticated users can create leagues"
ON public.leagues FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND admin_user_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Only league admins can update leagues"
ON public.leagues FOR UPDATE
USING (admin_user_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
));

SELECT 'Migration 1 completed: League system tables created' as status;