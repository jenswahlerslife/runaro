-- Quick DB sanity check for Activities page issue
-- Run this in Supabase SQL Editor

-- A) Do you actually have rows for your user?
select count(*) as activity_count
from public.user_activities 
where user_id = auth.uid();

-- B) Peek at a few rows to see the data structure
select 
  id, 
  strava_activity_id, 
  name, 
  distance, 
  moving_time, 
  activity_type, 
  start_date,
  included_in_game
from public.user_activities 
where user_id = auth.uid()
order by start_date desc
limit 10;

-- C) Check if RLS policies are working correctly
select 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
from pg_policies 
where tablename = 'user_activities';

-- D) Check current user info
select auth.uid() as current_user_id;

-- E) Check if there are ANY rows in the table (regardless of user)
select count(*) as total_rows_in_table
from public.user_activities;