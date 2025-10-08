-- Script 2: Create league_members table
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

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_status ON public.league_members(status);

-- Auto-approve existing league creators as members
INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
SELECT id, admin_user_id, 'approved', now(), admin_user_id
FROM public.leagues 
WHERE admin_user_id IS NOT NULL
ON CONFLICT (league_id, user_id) DO NOTHING;

SELECT 'Script 2 Complete: league_members table created' as status;