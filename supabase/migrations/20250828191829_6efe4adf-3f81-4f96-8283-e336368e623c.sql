-- Align leagues RLS with profiles mapping to fix FK errors

-- 1) Replace INSERT policy to check creator_id matches current user's profile.id
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leagues'
      AND policyname = 'Users can create leagues'
  ) THEN
    DROP POLICY "Users can create leagues" ON public.leagues;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leagues'
      AND policyname = 'Users can create leagues (by profile)'
  ) THEN
    DROP POLICY "Users can create leagues (by profile)" ON public.leagues;
  END IF;
END $$;

CREATE POLICY "Users can create leagues (by profile)"
ON public.leagues
FOR INSERT
WITH CHECK (
  creator_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);

-- 2) Replace SELECT policy for creators to use profiles mapping
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leagues'
      AND policyname = 'League creators can view their leagues'
  ) THEN
    DROP POLICY "League creators can view their leagues" ON public.leagues;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leagues'
      AND policyname = 'League creators can view their leagues (by profile)'
  ) THEN
    DROP POLICY "League creators can view their leagues (by profile)" ON public.leagues;
  END IF;
END $$;

CREATE POLICY "League creators can view their leagues (by profile)"
ON public.leagues
FOR SELECT
USING (
  creator_id IN (
    SELECT id FROM public.profiles WHERE user_id = auth.uid()
  )
);
