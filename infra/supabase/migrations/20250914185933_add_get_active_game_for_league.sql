-- public.get_active_game_for_league(league_id) -> jsonb
CREATE OR REPLACE FUNCTION public.get_active_game_for_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  g record;
  v_end_at timestamptz;
  v_now timestamptz := now();
  v_time_left_seconds bigint := null;
BEGIN
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('error','Not authenticated');
  end if;

  -- tjek at bruger er aktivt medlem af ligaen
  if not exists (
    select 1 from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = v_uid
      and lm.status = 'active'
  ) then
    return jsonb_build_object('error','Access denied to league');
  end if;

  -- hent nyeste spil i status 'active' eller 'setup'
  select g1.*
  into g
  from public.games g1
  where g1.league_id = p_league_id
    and g1.status in ('active','setup')
  order by coalesce(g1.start_date, g1.created_at) desc
  limit 1;

  if not found then
    return jsonb_build_object('game', null);
  end if;

  -- beregn slut og tid tilbage hvis du bruger duration_days
  if g.duration_days is not null and (g.start_date is not null) then
    v_end_at := g.start_date + (g.duration_days || ' days')::interval;
    v_time_left_seconds := greatest(0, floor(extract(epoch from (v_end_at - v_now)))::bigint);
  end if;

  return jsonb_build_object(
    'id', g.id,
    'name', g.name,
    'status', g.status,
    'start_date', g.start_date,
    'duration_days', g.duration_days,
    'end_at', v_end_at,
    'time_left_seconds', v_time_left_seconds
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_game_for_league(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_game_for_league(uuid) TO authenticated;