-- Add missing route column to user_activities table
-- This column is essential for territory calculation and game setup

-- Ensure PostGIS extension is enabled for geometry support
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add route column for storing activity geometry (LineString)
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);

-- Create spatial index on route column for performance
CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
  ON public.user_activities
  USING GIST (route);

-- Add comment for clarity
COMMENT ON COLUMN public.user_activities.route
  IS 'LineString geometry of the activity route in EPSG:4326 for territory calculation.';