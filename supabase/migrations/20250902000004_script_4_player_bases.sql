-- Script 4: Create player_bases table
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

CREATE INDEX IF NOT EXISTS idx_player_bases_game ON public.player_bases(game_id);
CREATE INDEX IF NOT EXISTS idx_player_bases_user ON public.player_bases(user_id);

SELECT 'Script 4 Complete: player_bases table created' as status;