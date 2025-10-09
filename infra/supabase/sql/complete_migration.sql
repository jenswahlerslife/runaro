-- COMPLETE TERRITORY GAME MIGRATION
-- Run this entire script in Supabase SQL Editor

-- Safety timeouts
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '15s';

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add PostGIS columns to user_activities (if not exists)
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

-- Function to create a new league
CREATE OR REPLACE FUNCTION public.create_league(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT false,
  p_max_members integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  league_record record;
  user_profile_id uuid;
BEGIN
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
  VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members)
  RETURNING * INTO league_record;

  INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
  VALUES (league_record.id, user_profile_id, 'approved', now(), user_profile_id);

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'invite_code', league_record.invite_code
  );
END;
$$;

-- Function to join a league
CREATE OR REPLACE FUNCTION public.join_league(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  league_record record;
  user_profile_id uuid;
  member_count integer;
BEGIN
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  SELECT * INTO league_record FROM public.leagues WHERE invite_code = p_invite_code;

  IF league_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'League not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = league_record.id AND user_id = user_profile_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already a member of this league');
  END IF;

  SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = league_record.id AND status = 'approved';

  IF member_count >= league_record.max_members THEN
    RETURN json_build_object('success', false, 'error', 'League is full');
  END IF;

  INSERT INTO public.league_members (league_id, user_id, status)
  VALUES (
    league_record.id, 
    user_profile_id, 
    CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END
  );

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'league_name', league_record.name,
    'status', CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END
  );
END;
$$;

-- Grant permissions to functions
GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;

-- Territory calculation function
CREATE OR REPLACE FUNCTION public.refresh_user_territory(p_user uuid, p_tolerance_m integer DEFAULT 50)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  territory_count integer := 0;
  total_count integer := 0;
  base_count integer := 0;
BEGIN
  SELECT COUNT(*) INTO total_count FROM public.user_activities WHERE user_id = p_user;
  
  IF total_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No activities found for user', 'territory_count', 0, 'total_count', 0, 'base_count', 0);
  END IF;

  SELECT COUNT(*) INTO base_count FROM public.user_activities WHERE user_id = p_user AND is_base = true;
  
  IF base_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No base activity set for user', 'territory_count', 0, 'total_count', total_count, 'base_count', 0);
  END IF;

  BEGIN
    UPDATE public.user_activities SET included_in_game = false WHERE user_id = p_user;

    WITH RECURSIVE territory AS (
      SELECT ua.id, ua.route, 1 as depth
      FROM public.user_activities ua
      WHERE ua.user_id = p_user 
        AND ua.is_base = true 
        AND ua.route IS NOT NULL

      UNION

      SELECT ua2.id, ua2.route, t.depth + 1 as depth
      FROM public.user_activities ua2
      JOIN territory t ON (
        ua2.user_id = p_user 
        AND ua2.route IS NOT NULL
        AND ua2.id != t.id
        AND ST_DWithin(ua2.route::geography, t.route::geography, p_tolerance_m)
      )
      WHERE t.depth < 100
    )
    UPDATE public.user_activities ua
    SET included_in_game = true
    FROM territory t
    WHERE ua.id = t.id;

    SELECT COUNT(*) INTO territory_count
    FROM public.user_activities
    WHERE user_id = p_user AND included_in_game = true;

    RETURN json_build_object(
      'success', true,
      'territory_count', territory_count,
      'total_count', total_count,
      'base_count', base_count,
      'tolerance_meters', p_tolerance_m
    );

  EXCEPTION WHEN OTHERS THEN
    RAISE;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_user_territory(uuid, integer) TO authenticated;

SELECT 'COMPLETE MIGRATION FINISHED - Territory Game Ready!' as status;