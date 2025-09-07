# 🚀 MANUAL MIGRATION STEPS - Kør dette i Supabase Dashboard

Åbn **Supabase Dashboard** → **SQL Editor** og kør følgende scripts **en ad gangen**:

## 1. Enable PostGIS og grundlæggende kolonner
```sql
-- Safety timeouts
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL idle_in_transaction_session_timeout = '15s';

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add route and is_base columns to user_activities
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

-- Create unique constraint and spatial index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
ON public.user_activities (user_id)
WHERE is_base = true;

CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
  ON public.user_activities
  USING GIST (route);

SELECT 'Step 1 Complete: PostGIS and user_activities updated' as status;
```

## 2. Create leagues table
```sql
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

-- Enable RLS
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- RLS Policy
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_leagues_admin ON public.leagues(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);

SELECT 'Step 2 Complete: Leagues table created' as status;
```

## 3. Create league members table
```sql
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

-- Enable RLS
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_status ON public.league_members(status);

SELECT 'Step 3 Complete: League members table created' as status;
```

## 4. Create games table
```sql
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

-- Enable RLS
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_games_league ON public.games(league_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);

SELECT 'Step 4 Complete: Games table created' as status;
```

## 5. Create player bases table
```sql
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

-- Enable RLS
ALTER TABLE public.player_bases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_player_bases_game ON public.player_bases(game_id);
CREATE INDEX IF NOT EXISTS idx_player_bases_user ON public.player_bases(user_id);

SELECT 'Step 5 Complete: Player bases table created' as status;
```

## 6. Create territory takeovers table
```sql
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

-- Enable RLS
ALTER TABLE public.territory_takeovers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_territory_takeovers_game ON public.territory_takeovers(game_id);
CREATE INDEX IF NOT EXISTS idx_territory_takeovers_intersection ON public.territory_takeovers USING GIST(intersection_point);

SELECT 'Step 6 Complete: Territory takeovers table created' as status;
```

## 7. Create essential functions
```sql
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
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;

SELECT 'Step 7 Complete: Essential functions created' as status;
```

## 8. Final verification
```sql
-- Verify all tables exist
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('leagues', 'league_members', 'games', 'player_bases', 'territory_takeovers')
ORDER BY tablename;

-- Verify functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name IN ('create_league', 'join_league')
  AND routine_schema = 'public';

SELECT 'TERRITORY GAME MIGRATION COMPLETE! 🎮🏆' as final_status;
```

---

## ✅ Efter migration er færdig:

**Dit Territory Game System er nu live og klar! 🚀**

- Åbn forsiden → "Start Game" knap virker
- Liga-systemet er funktionelt  
- Database tabeller og funktioner er oprettet
- RLS sikkerhed er aktiveret
- Spatial PostGIS features er tilgængelige

**Test det ved at:**
1. Gå til `/leagues`
2. Opret en liga  
3. Note invite code
4. Test join-funktionen
5. Spillet er klar! 🎮