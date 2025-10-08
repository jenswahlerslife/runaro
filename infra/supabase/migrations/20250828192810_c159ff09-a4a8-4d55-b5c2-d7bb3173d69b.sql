-- Fix league_memberships RLS policies to work with profiles mapping

-- 1) Update INSERT policy to allow inserting with profile.id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'league_memberships'
      AND policyname = 'Users can join leagues (by profile)'
  ) THEN
    DROP POLICY "Users can join leagues (by profile)" ON public.league_memberships;
  END IF;
END $$;

CREATE POLICY "Users can join leagues (by profile)"
ON public.league_memberships
FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- 2) Update SELECT policy to work with profiles mapping
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'league_memberships'
      AND policyname = 'Users can view their own memberships (by profile)'
  ) THEN
    DROP POLICY "Users can view their own memberships (by profile)" ON public.league_memberships;
  END IF;
END $$;

CREATE POLICY "Users can view their own memberships (by profile)"
ON public.league_memberships
FOR SELECT
USING (
  user_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- 3) Update league membership check function to work with profiles
CREATE OR REPLACE FUNCTION public.is_member_of_league(_user_id uuid, _league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_memberships lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE p.user_id = _user_id
      AND lm.league_id = _league_id
  );
$$;