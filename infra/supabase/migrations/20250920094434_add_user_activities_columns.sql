-- Add missing columns to user_activities table for territory game functionality
-- These columns are essential for game setup and territory calculation

-- Ensure PostGIS extension is enabled for geometry support
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add route column for storing activity geometry (LineString)
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);

-- Add is_base column if it doesn't exist
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

-- Add included_in_game column if it doesn't exist (often used together with is_base)
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT false;

-- Create unique index to ensure only one base per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
  ON public.user_activities (user_id)
  WHERE is_base = true;

-- Create spatial index on route column for performance
CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
  ON public.user_activities
  USING GIST (route);

-- Add comments for clarity
COMMENT ON COLUMN public.user_activities.route
  IS 'LineString geometry of the activity route in EPSG:4326 for territory calculation.';

COMMENT ON COLUMN public.user_activities.is_base
  IS 'Marks which activity serves as the user''s base in territory games. Only one base per user allowed.';

COMMENT ON COLUMN public.user_activities.included_in_game
  IS 'Marks whether this activity is included in an active game for territory calculation.';