-- Comprehensive fix for league join requests system
-- This addresses the 400 errors and ensures UI consistency

-- 1) Create bulletproof approve_join_request function
CREATE OR REPLACE FUNCTION public.approve_join_request(request_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_league_id   uuid;
  v_user_id     uuid;
  v_actor       uuid := auth.uid();
begin
  -- Look up request
  select league_id, user_id
  into v_league_id, v_user_id
  from public.league_join_requests
  where id = request_id and status = 'pending';

  if v_league_id is null then
    raise exception 'Request not found or not pending' using hint = 'Invalid request_id or request already processed';
  end if;

  -- Ensure caller is owner/admin of that league
  if not exists (
    select 1 from public.league_members
    where league_id = v_league_id
      and user_id   = v_actor
      and role in ('owner','admin')
  ) then
    raise exception 'Forbidden: Only owner/admin can approve requests' using hint = 'You must be an owner or admin of this league';
  end if;

  -- Add to league_members (idempotent)
  insert into public.league_members (league_id, user_id, role, joined_at)
  values (v_league_id, v_user_id, 'member', now())
  on conflict (league_id, user_id) do nothing;

  -- Delete the request so it disappears from the list
  delete from public.league_join_requests
  where id = request_id;

  return json_build_object(
    'success', true, 
    'message', 'Member added to league',
    'league_id', v_league_id, 
    'user_id', v_user_id
  );
end;
$$;

-- 2) Create bulletproof decline_join_request function
CREATE OR REPLACE FUNCTION public.decline_join_request(request_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_league_id   uuid;
  v_user_id     uuid;
  v_actor       uuid := auth.uid();
begin
  -- Look up request
  select league_id, user_id
  into v_league_id, v_user_id
  from public.league_join_requests
  where id = request_id and status = 'pending';

  if v_league_id is null then
    raise exception 'Request not found or not pending' using hint = 'Invalid request_id or request already processed';
  end if;

  -- Ensure caller is owner/admin of that league
  if not exists (
    select 1 from public.league_members
    where league_id = v_league_id
      and user_id   = v_actor
      and role in ('owner','admin')
  ) then
    raise exception 'Forbidden: Only owner/admin can decline requests' using hint = 'You must be an owner or admin of this league';
  end if;

  -- Delete the request so it disappears from the list
  delete from public.league_join_requests
  where id = request_id;

  return json_build_object(
    'success', true, 
    'message', 'Request declined',
    'league_id', v_league_id, 
    'user_id', v_user_id
  );
end;
$$;

-- 3) Grant execute permissions with proper security
REVOKE ALL ON FUNCTION public.approve_join_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.decline_join_request(uuid) FROM PUBLIC, anon;  
GRANT EXECUTE ON FUNCTION public.decline_join_request(uuid) TO authenticated;