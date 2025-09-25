-- Fix: Show recent games in leagues, not just active ones
-- This fixes the issue where games disappear from leagues when they are finished

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

  -- hent nyeste spil i status 'active', 'setup' eller 'finished' (sidste 7 dage)
  select g1.*
  into g
  from public.games g1
  where g1.league_id = p_league_id
    and (
      g1.status in ('active','setup')
      OR (g1.status = 'finished' AND g1.finished_at > now() - interval '7 days')
    )
  order by
    case when g1.status in ('active', 'setup') then 1 else 2 end,
    coalesce(g1.start_date, g1.created_at) desc
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
    'time_left_seconds', v_time_left_seconds,
    'finished_at', g.finished_at,
    'winner_user_id', g.winner_user_id
  );
END;
$$;

COMMENT ON FUNCTION public.get_active_game_for_league(uuid) IS 'Get the most recent game for a league - active/setup games first, then finished games from last 7 days';