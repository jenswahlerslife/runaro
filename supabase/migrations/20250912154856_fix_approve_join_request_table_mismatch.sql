-- Fix approve_join_request to use league_members table instead of league_memberships
-- This fixes the issue where approved members don't show up in the UI

CREATE OR REPLACE FUNCTION public.approve_join_request(request_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_record record;
  league_admin_check boolean;
begin
  -- Get the request details
  select * into request_record
  from public.league_join_requests
  where id = request_id and status = 'pending';
  
  if not found then
    return json_build_object('success', false, 'error', 'Request not found or not pending');
  end if;
  
  -- Check if current user is admin/owner of the league using helper function
  select public.is_league_admin(request_record.league_id) into league_admin_check;
    
  if not league_admin_check then
    return json_build_object('success', false, 'error', 'Not authorized - admin/owner access required');
  end if;
  
  -- Add user to league_members (the correct table that the view uses)
  insert into public.league_members (league_id, user_id, role, joined_at)
  values (request_record.league_id, request_record.user_id, 'member', now())
  on conflict (league_id, user_id) do nothing;
  
  -- Mark request as approved (keep it for audit trail)
  update public.league_join_requests
  set status = 'approved', decided_at = now(), decided_by = auth.uid()
  where id = request_id;
  
  return json_build_object('success', true, 'message', 'Member added to league');
end;
$$;

-- Also fix decline_join_request for completeness
CREATE OR REPLACE FUNCTION public.decline_join_request(request_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_record record;
  league_admin_check boolean;
begin
  -- Get the request details
  select * into request_record
  from public.league_join_requests
  where id = request_id and status = 'pending';
  
  if not found then
    return json_build_object('success', false, 'error', 'Request not found or not pending');
  end if;
  
  -- Check if current user is admin/owner of the league using helper function
  select public.is_league_admin(request_record.league_id) into league_admin_check;
    
  if not league_admin_check then
    return json_build_object('success', false, 'error', 'Not authorized - admin/owner access required');
  end if;
  
  -- Mark request as declined
  update public.league_join_requests
  set status = 'declined', decided_at = now(), decided_by = auth.uid()
  where id = request_id;
  
  return json_build_object('success', true, 'message', 'Request declined');
end;
$$;

-- Grant execute permissions
REVOKE ALL ON FUNCTION public.approve_join_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_join_request(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.decline_join_request(uuid) FROM PUBLIC, anon;  
GRANT EXECUTE ON FUNCTION public.decline_join_request(uuid) TO authenticated;