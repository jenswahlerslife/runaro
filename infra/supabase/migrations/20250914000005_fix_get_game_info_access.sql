-- Fix get_game_info access logic to work with actual user profile structure
create or replace function public.get_game_info(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_profile_id uuid;
  g record;
begin
  -- Get current authenticated user ID
  select auth.uid() into v_user_id;

  if v_user_id is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- Get user profile ID (profiles table uses user_id as FK to auth.users)
  select id into v_profile_id
  from public.profiles
  where user_id = v_user_id;

  if v_profile_id is null then
    return jsonb_build_object('error', 'User profile not found');
  end if;

  -- Join games to leagues and league_members to enforce access
  -- Use profile ID for league membership check
  select
    g1.id,
    g1.name,
    g1.status,
    g1.created_at,
    g1.start_date,
    g1.league_id
  into g
  from public.games g1
  join public.leagues l on l.id = g1.league_id
  join public.league_members lm
    on lm.league_id = l.id
   and lm.user_id = v_profile_id  -- Use profile ID here
   and lm.status = 'approved'     -- Fixed: use 'approved' not 'active'
  where g1.id = p_game_id;

  if not found then
    return jsonb_build_object('error', 'Game not found or access denied');
  end if;

  return jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'status', g.status,
    'created_at', g.created_at,
    'start_date', g.start_date,
    'league_id', g.league_id
  );
end;
$$;

-- Maintain proper permissions
revoke all on function public.get_game_info(uuid) from public;
grant execute on function public.get_game_info(uuid) to authenticated;