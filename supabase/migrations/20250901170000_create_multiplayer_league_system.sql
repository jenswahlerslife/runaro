-- Safety timeouts
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

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
  base_date timestamptz NOT NULL, -- Date of base activity (activities before this are invalid)
  territory_size_km2 numeric DEFAULT 0, -- Cached territory size
  last_calculated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, user_id) -- One base per player per game
);

-- Create territory takeovers table (log of territory changes)
CREATE TABLE IF NOT EXISTS public.territory_takeovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  taken_from_user_id uuid NOT NULL REFERENCES public.profiles(id),
  taken_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
  activity_id uuid NOT NULL REFERENCES public.user_activities(id), -- The activity that caused takeover
  intersection_point geometry(Point, 4326), -- Where the routes intersected
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

-- RLS Policies for leagues
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

-- RLS Policies for league members
CREATE POLICY "Users can view memberships for leagues they can see"
ON public.league_members FOR SELECT
USING (
  league_id IN (
    SELECT id FROM public.leagues 
    WHERE is_public = true OR
          admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
          id IN (
            SELECT league_id FROM public.league_members lm2
            JOIN public.profiles p ON lm2.user_id = p.id
            WHERE p.user_id = auth.uid()
          )
  )
);

CREATE POLICY "Users can join leagues"
ON public.league_members FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "League admins and users can update their own membership"
ON public.league_members FOR UPDATE
USING (
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
  league_id IN (
    SELECT id FROM public.leagues l
    WHERE l.admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- RLS Policies for games
CREATE POLICY "Users can view games for leagues they are members of"
ON public.games FOR SELECT
USING (
  league_id IN (
    SELECT league_id FROM public.league_members lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE p.user_id = auth.uid() AND lm.status = 'approved'
  ) OR
  league_id IN (
    SELECT id FROM public.leagues
    WHERE admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "League admins can create games"
ON public.games FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  league_id IN (
    SELECT id FROM public.leagues
    WHERE admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "League admins can update games"
ON public.games FOR UPDATE
USING (
  league_id IN (
    SELECT id FROM public.leagues
    WHERE admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- RLS Policies for player bases
CREATE POLICY "Users can view bases for games they participate in"
ON public.player_bases FOR SELECT
USING (
  game_id IN (
    SELECT g.id FROM public.games g
    JOIN public.league_members lm ON g.league_id = lm.league_id
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE p.user_id = auth.uid() AND lm.status = 'approved'
  )
);

CREATE POLICY "Users can create their own bases"
ON public.player_bases FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL AND
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) AND
  activity_id IN (SELECT id FROM public.user_activities ua
    JOIN public.profiles p ON ua.user_id = p.id
    WHERE p.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own bases"
ON public.player_bases FOR UPDATE
USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- RLS Policies for territory takeovers
CREATE POLICY "Users can view takeovers for games they participate in"
ON public.territory_takeovers FOR SELECT
USING (
  game_id IN (
    SELECT g.id FROM public.games g
    JOIN public.league_members lm ON g.league_id = lm.league_id  
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE p.user_id = auth.uid() AND lm.status = 'approved'
  )
);

CREATE POLICY "System can insert takeovers"
ON public.territory_takeovers FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add comments
COMMENT ON TABLE public.leagues IS 'Player leagues/groups for territorial games';
COMMENT ON TABLE public.league_members IS 'Members of leagues with approval status';
COMMENT ON TABLE public.games IS '30-day territorial competitions within leagues';
COMMENT ON TABLE public.player_bases IS 'Player base activities for each game';
COMMENT ON TABLE public.territory_takeovers IS 'Log of territory changes between players';