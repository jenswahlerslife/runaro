-- Fix league_members status column to have proper defaults and backfill existing data
-- This ensures all members have a proper status so they show up in My Leagues panel

-- 1) Set default status to 'approved' for new rows
ALTER TABLE public.league_members
  ALTER COLUMN status SET DEFAULT 'approved';

-- 2) Backfill existing rows with NULL status to 'approved'
UPDATE public.league_members
SET status = 'approved'
WHERE status IS NULL;

-- 3) Make status NOT NULL (since we now have defaults and backfilled data)
ALTER TABLE public.league_members
  ALTER COLUMN status SET NOT NULL;

-- 4) Add constraint to ensure valid status values
ALTER TABLE public.league_members
  ADD CONSTRAINT league_members_status_chk
  CHECK (status IN ('pending', 'approved', 'removed'));