-- Create user_activities table for storing transferred Strava activities
CREATE TABLE IF NOT EXISTS public.user_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  strava_activity_id bigint NOT NULL,
  name text NOT NULL,
  distance real,
  moving_time integer,
  activity_type text NOT NULL,
  start_date timestamptz NOT NULL,
  average_speed real,
  max_speed real,
  total_elevation_gain real,
  points_earned integer NOT NULL DEFAULT 0,
  polyline text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, strava_activity_id)
);

-- Enable RLS
ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own activities"
ON public.user_activities
FOR SELECT
USING (user_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert their own activities"
ON public.user_activities
FOR INSERT
WITH CHECK (user_id IN (
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_strava_id ON public.user_activities(strava_activity_id);
CREATE INDEX IF NOT EXISTS idx_user_activities_start_date ON public.user_activities(start_date);

-- Create function to increment user points
CREATE OR REPLACE FUNCTION public.increment_user_points(user_uuid uuid, points_to_add integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update user points in profiles table
  UPDATE public.profiles 
  SET total_points = COALESCE(total_points, 0) + points_to_add,
      updated_at = now()
  WHERE user_id = user_uuid;
END;
$$;

-- Add total_points column to profiles if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' 
    AND column_name = 'total_points'
    AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN total_points integer NOT NULL DEFAULT 0;
  END IF;
END $$;