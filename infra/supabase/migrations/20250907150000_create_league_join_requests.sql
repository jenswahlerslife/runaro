-- Create league join requests system
-- Enables users to request to join leagues and admins to approve/decline

-- 1. Create league_join_requests table
create table if not exists public.league_join_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text check (status in ('pending', 'approved', 'declined')) default 'pending',
  message text,
  created_at timestamptz default now(),
  decided_at timestamptz,
  unique(league_id, user_id, status) -- Only one pending request per user per league
);

-- 2. Enable RLS
alter table public.league_join_requests enable row level security;

-- 3. RLS Policies for league_join_requests
create policy "Users can insert own join requests"
on public.league_join_requests for insert
with check (auth.uid() = user_id);

create policy "Users can view own join requests"
on public.league_join_requests for select
using (auth.uid() = user_id);

create policy "League admins can view requests for their leagues"
on public.league_join_requests for select
using (
  league_id in (
    select league_id 
    from public.league_memberships 
    where user_id = auth.uid() and role = 'admin'
  )
);

-- 4. Update leagues table to ensure it has description column
alter table public.leagues 
add column if not exists description text;

-- 5. Ensure league_memberships has proper structure
-- (Assuming this exists, but adding safety checks)
create table if not exists public.league_memberships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text check (role in ('admin', 'member')) default 'member',
  joined_at timestamptz default now(),
  unique(league_id, user_id)
);

-- Enable RLS on league_memberships if not already enabled
alter table public.league_memberships enable row level security;

-- RLS policies for league_memberships
drop policy if exists "Users can view league memberships" on public.league_memberships;
create policy "Users can view league memberships"
on public.league_memberships for select
using (
  league_id in (
    select league_id 
    from public.league_memberships 
    where user_id = auth.uid()
  )
);

-- 6. RPC function: approve_join_request
create or replace function public.approve_join_request(request_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  request_record record;
  league_record record;
begin
  -- Get the request details
  select * into request_record
  from public.league_join_requests
  where id = request_id and status = 'pending';
  
  if not found then
    return json_build_object('success', false, 'error', 'Request not found or not pending');
  end if;
  
  -- Check if current user is admin of the league
  select * into league_record
  from public.league_memberships
  where league_id = request_record.league_id 
    and user_id = auth.uid() 
    and role = 'admin';
    
  if not found then
    return json_build_object('success', false, 'error', 'Not authorized - admin access required');
  end if;
  
  -- Add user to league_memberships
  insert into public.league_memberships (league_id, user_id, role)
  values (request_record.league_id, request_record.user_id, 'member')
  on conflict (league_id, user_id) do nothing;
  
  -- Update request status
  update public.league_join_requests
  set status = 'approved', decided_at = now()
  where id = request_id;
  
  return json_build_object('success', true, 'message', 'Member added to league');
end;
$$;

-- 7. RPC function: decline_join_request
create or replace function public.decline_join_request(request_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  request_record record;
  league_record record;
begin
  -- Get the request details
  select * into request_record
  from public.league_join_requests
  where id = request_id and status = 'pending';
  
  if not found then
    return json_build_object('success', false, 'error', 'Request not found or not pending');
  end if;
  
  -- Check if current user is admin of the league
  select * into league_record
  from public.league_memberships
  where league_id = request_record.league_id 
    and user_id = auth.uid() 
    and role = 'admin';
    
  if not found then
    return json_build_object('success', false, 'error', 'Not authorized - admin access required');
  end if;
  
  -- Update request status
  update public.league_join_requests
  set status = 'declined', decided_at = now()
  where id = request_id;
  
  return json_build_object('success', true, 'message', 'Request declined');
end;
$$;

-- 8. Helper function to get pending request count for admin
create or replace function public.get_admin_pending_requests_count()
returns bigint
language plpgsql
security definer
as $$
begin
  return (
    select count(*)
    from public.league_join_requests ljr
    where ljr.status = 'pending'
      and ljr.league_id in (
        select league_id 
        from public.league_memberships 
        where user_id = auth.uid() and role = 'admin'
      )
  );
end;
$$;

-- 9. Create indexes for better performance
create index if not exists idx_league_join_requests_league_id on public.league_join_requests(league_id);
create index if not exists idx_league_join_requests_user_id on public.league_join_requests(user_id);
create index if not exists idx_league_join_requests_status on public.league_join_requests(status);
create index if not exists idx_league_memberships_league_user on public.league_memberships(league_id, user_id);

-- 10. Ensure leagues table has proper RLS for public viewing
drop policy if exists "Anyone can view leagues" on public.leagues;
create policy "Anyone can view leagues"
on public.leagues for select
using (true); -- All leagues are publicly viewable for directory

-- Grant execute permissions on RPC functions
grant execute on function public.approve_join_request(uuid) to authenticated;
grant execute on function public.decline_join_request(uuid) to authenticated;
grant execute on function public.get_admin_pending_requests_count() to authenticated;