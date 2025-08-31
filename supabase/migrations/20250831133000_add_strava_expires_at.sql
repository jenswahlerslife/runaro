-- Add missing strava_expires_at column to profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS strava_expires_at TIMESTAMP WITH TIME ZONE;