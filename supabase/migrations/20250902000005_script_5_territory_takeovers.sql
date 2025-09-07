-- Script 5: Create territory_takeovers table
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

ALTER TABLE public.territory_takeovers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_territory_takeovers_game ON public.territory_takeovers(game_id);
CREATE INDEX IF NOT EXISTS idx_territory_takeovers_intersection ON public.territory_takeovers USING GIST(intersection_point);

SELECT 'Script 5 Complete: territory_takeovers table created' as status;