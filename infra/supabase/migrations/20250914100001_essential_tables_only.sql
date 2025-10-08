-- Essential tables and minimal functions needed for game flow

-- 1. Ensure games table has required columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'duration_days') THEN
        ALTER TABLE public.games ADD COLUMN duration_days integer DEFAULT 14;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'activated_at') THEN
        ALTER TABLE public.games ADD COLUMN activated_at timestamptz;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'winner_user_id') THEN
        ALTER TABLE public.games ADD COLUMN winner_user_id uuid REFERENCES public.profiles(id);
    END IF;
END $$;

-- 2. Create player_bases table if it doesn't exist
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

ALTER TABLE public.player_bases ENABLE ROW LEVEL SECURITY;

-- 3. Ensure user_territories has game_id and area_km2
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_territories') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_territories' AND column_name = 'game_id') THEN
            ALTER TABLE public.user_territories ADD COLUMN game_id uuid REFERENCES public.games(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_territories' AND column_name = 'area_km2') THEN
            ALTER TABLE public.user_territories ADD COLUMN area_km2 numeric(15,6) DEFAULT 0;
        END IF;
    END IF;
END $$;

-- 4. Create essential indexes
CREATE INDEX IF NOT EXISTS idx_player_bases_game ON public.player_bases(game_id);
CREATE INDEX IF NOT EXISTS idx_player_bases_user ON public.player_bases(user_id);
CREATE INDEX IF NOT EXISTS idx_player_bases_game_user ON public.player_bases(game_id, user_id);

-- 5. Basic RLS policies
DROP POLICY IF EXISTS "player_bases_policy" ON public.player_bases;
CREATE POLICY "player_bases_policy" ON public.player_bases
  FOR ALL USING (
    user_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR
    game_id IN (
      SELECT g.id FROM public.games g
      JOIN public.league_members lm ON lm.league_id = g.league_id
      JOIN public.profiles p ON p.id = lm.user_id
      WHERE p.user_id = auth.uid() AND lm.status = 'approved'
    )
  );

-- 6. Essential RPC function for setting player base
CREATE OR REPLACE FUNCTION public.set_player_base_simple(
  p_game_id uuid,
  p_activity_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_profile_id uuid;
  activity_record record;
  game_record record;
BEGIN
  -- Get user profile
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Get game and verify it's in setup
  SELECT * INTO game_record FROM public.games WHERE id = p_game_id AND status = 'setup';
  IF game_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Game not found or not in setup');
  END IF;

  -- Get activity
  SELECT * INTO activity_record
  FROM public.user_activities
  WHERE id = p_activity_id AND user_id = user_profile_id;

  IF activity_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Activity not found');
  END IF;

  -- Insert or update player base
  INSERT INTO public.player_bases (game_id, user_id, activity_id, base_date)
  VALUES (p_game_id, user_profile_id, p_activity_id, activity_record.start_date::timestamptz)
  ON CONFLICT (game_id, user_id) DO UPDATE SET
    activity_id = p_activity_id,
    base_date = activity_record.start_date::timestamptz,
    created_at = now();

  RETURN json_build_object('success', true, 'activity_name', activity_record.name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_player_base_simple(uuid, uuid) TO authenticated;