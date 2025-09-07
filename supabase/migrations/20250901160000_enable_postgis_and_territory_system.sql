-- Safety timeouts
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add route column for storing activity geometry (LineString)
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);

-- Add is_base column to mark the user's main base
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

-- Create unique constraint: only one base per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
ON public.user_activities (user_id)
WHERE is_base = true;

-- Create spatial index on route column for performance
CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
  ON public.user_activities
  USING GIST (route);

-- Add comment to route column
COMMENT ON COLUMN public.user_activities.route 
IS 'LineString geometry of the activity route in EPSG:4326';

-- Add comment to is_base column  
COMMENT ON COLUMN public.user_activities.is_base
IS 'Flag to mark this activity as the users main base for territory calculation';

-- Add RLS policy for is_base column (users can only modify their own activities)
CREATE POLICY IF NOT EXISTS "Users can update their own activities base status"
ON public.user_activities
FOR UPDATE
USING (user_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
))
WITH CHECK (user_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
));