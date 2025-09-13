-- Approve all existing pending members so they can see their leagues
-- This is a one-time fix for the status issue

UPDATE public.league_members
SET status = 'approved'
WHERE status = 'pending';