-- Script 3: Create games table
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

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_games_league ON public.games(league_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);

SELECT 'Script 3 Complete: games table created' as status;