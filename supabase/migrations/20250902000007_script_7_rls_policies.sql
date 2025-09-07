-- Script 7: Add RLS policies (Important!)

-- RLS Policies for leagues (update existing)
DROP POLICY IF EXISTS "Users can view leagues they are members of or public leagues" ON public.leagues;
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

-- RLS Policies for league_members
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

-- RLS Policies for player_bases
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
  user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- RLS Policies for territory_takeovers
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

SELECT 'Script 7 Complete: All RLS policies created' as status;