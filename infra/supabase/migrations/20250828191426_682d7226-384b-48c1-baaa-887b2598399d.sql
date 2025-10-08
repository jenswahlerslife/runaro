-- Break recursive RLS by using a SECURITY DEFINER helper and tighten visibility

-- 1) Helper to check league membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_member_of_league(_user_id uuid, _league_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.league_memberships
    WHERE user_id = _user_id
      AND league_id = _league_id
  );
$$;

-- 2) league_memberships: replace recursive SELECT policy with minimal, non-recursive one
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'league_memberships'
      AND policyname = 'Users can view memberships for their leagues'
  ) THEN
    DROP POLICY "Users can view memberships for their leagues" ON public.league_memberships;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'league_memberships'
      AND policyname = 'Users can view their own memberships'
  ) THEN
    CREATE POLICY "Users can view their own memberships"
    ON public.league_memberships
    FOR SELECT
    USING (user_id = auth.uid());
  END IF;
END $$;

-- 3) leagues: avoid subquery recursion by using helper
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leagues'
      AND policyname = 'Users can view leagues they are members of'
  ) THEN
    DROP POLICY "Users can view leagues they are members of" ON public.leagues;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leagues'
      AND policyname = 'Users can view leagues they are members of (safe)'
  ) THEN
    CREATE POLICY "Users can view leagues they are members of (safe)"
    ON public.leagues
    FOR SELECT
    USING (public.is_member_of_league(auth.uid(), id));
  END IF;
END $$;

-- 4) activities: swap to helper-based visibility
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activities'
      AND policyname = 'Users can view activities in their leagues'
  ) THEN
    DROP POLICY "Users can view activities in their leagues" ON public.activities;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activities'
      AND policyname = 'Users can view activities in their leagues (safe)'
  ) THEN
    CREATE POLICY "Users can view activities in their leagues (safe)"
    ON public.activities
    FOR SELECT
    USING (public.is_member_of_league(auth.uid(), league_id));
  END IF;
END $$;

-- 5) territory_ownership: swap to helper-based visibility
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'territory_ownership'
      AND policyname = 'Users can view territory in their leagues'
  ) THEN
    DROP POLICY "Users can view territory in their leagues" ON public.territory_ownership;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'territory_ownership'
      AND policyname = 'Users can view territory in their leagues (safe)'
  ) THEN
    CREATE POLICY "Users can view territory in their leagues (safe)"
    ON public.territory_ownership
    FOR SELECT
    USING (public.is_member_of_league(auth.uid(), league_id));
  END IF;
END $$;