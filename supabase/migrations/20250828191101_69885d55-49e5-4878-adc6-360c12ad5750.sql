-- Add trigger to auto-generate invite codes on leagues insert
DO $$ BEGIN
  -- Create trigger only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_leagues_invite_code'
  ) THEN
    CREATE TRIGGER set_leagues_invite_code
    BEFORE INSERT ON public.leagues
    FOR EACH ROW
    EXECUTE FUNCTION public.set_invite_code();
  END IF;
END $$;

-- Allow league creators to view their own leagues (fixes insert ... select flow)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leagues'
      AND policyname = 'League creators can view their leagues'
  ) THEN
    CREATE POLICY "League creators can view their leagues"
    ON public.leagues
    FOR SELECT
    USING (auth.uid() = creator_id);
  END IF;
END $$;