-- Script 1: Tilføj manglende kolonner til eksisterende tabeller
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add route and is_base to user_activities
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
ON public.user_activities (user_id)
WHERE is_base = true;

CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
  ON public.user_activities
  USING GIST (route);

-- Update leagues table to match our schema
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS admin_user_id uuid REFERENCES public.profiles(id);

-- Copy creator_id to admin_user_id if needed
UPDATE public.leagues 
SET admin_user_id = creator_id 
WHERE admin_user_id IS NULL AND creator_id IS NOT NULL;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 10;

SELECT 'Script 1 Complete: Updated existing tables' as status;