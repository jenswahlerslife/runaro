-- Extended overview for a single game
create or replace function public.get_game_overview(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  g record;
  members_total int;
  bases_ready   int;
  v_start timestamptz;
  v_end   timestamptz;
  v_now   timestamptz := now();
  players jsonb;
begin
  -- 1) Load game
  select *
  into g
  from public.games
  where id = p_game_id;

  if not found then
    raise exception 'Game % not found', p_game_id;
  end if;

  -- 2) Compute dates
  -- start_date is set when game becomes active (per your flow)
  v_start := g.start_date;
  v_end   := coalesce(g.end_date, case when g.start_date is not null then g.start_date + (g.duration_days || ' days')::interval end);

  -- 3) Readiness counts
  select count(*) into members_total
  from public.league_members lm
  where lm.league_id = g.league_id
    and lm.approved is true;

  select count(*) into bases_ready
  from public.player_bases pb
  where pb.game_id = g.id;

  -- 4) Per-player stats
  players := (
    select jsonb_agg(
      jsonb_build_object(
        'user_id', u.user_id,
        'name', p.display_name,
        'avatar_url', p.avatar_url,
        'has_base', (pb.user_id is not null),
        'base', case when pb.user_id is not null then jsonb_build_object(
                    'activity_id', pb.activity_id,
                    'base_date', pb.base_date
                  ) else null end,
        'stats', jsonb_build_object(
          'distance_m', coalesce(a.sum_distance_m, 0),
          'moving_time_s', coalesce(a.sum_moving_time_s, 0),
          'territory_area_km2', coalesce(t.sum_area_km2, 0)
        )
      )
      order by p.display_name nulls last
    )
    from (
      -- All approved members of the league
      select lm.user_id
      from public.league_members lm
      where lm.league_id = g.league_id
        and lm.approved is true
    ) u
    left join public.profiles p on p.id = u.user_id
    left join public.player_bases pb
      on pb.game_id = g.id and pb.user_id = u.user_id

    -- (A) Activities in the game window
    -- Window starts at the user's base timestamp (pb.base_date) if present;
    -- otherwise at game start_date; only counts while game is active.
    left join lateral (
      select
        sum(coalesce(ua.distance * 1000, 0))::bigint        as sum_distance_m,
        sum(coalesce(ua.moving_time, 0))::bigint            as sum_moving_time_s
      from public.user_activities ua
      where ua.user_id = u.user_id
        and v_start is not null             -- only count after activation
        and ua.start_date >= greatest(
              coalesce(pb.base_date, v_start),  -- baseline
              v_start
            )
        and (v_end is null or ua.start_date < v_end)
    ) a on true

    -- (B) Territory captured in the game window
    left join lateral (
      select
        coalesce(sum(to_.area_km2), 0)::numeric as sum_area_km2
      from public.territory_ownership to_
      where to_.user_id = u.user_id
        and v_start is not null
        and to_.claimed_at >= greatest(coalesce(pb.base_date, v_start), v_start)
        and (v_end is null or to_.claimed_at < v_end)
        and to_.league_id = g.league_id  -- only count territory for this league
    ) t on true
  );

  return jsonb_build_object(
    'meta', jsonb_build_object(
      'id', g.id,
      'league_id', g.league_id,
      'status', g.status,
      'duration_days', g.duration_days,
      'start_date', g.start_date,
      'end_date', v_end,
      'activated_at', g.start_date,
      'winner_user_id', null, -- TODO: implement winner calculation
      'time_left_seconds',
        case
          when g.status = 'active' and v_end is not null and v_now < v_end
            then floor(extract(epoch from (v_end - v_now)))::bigint
          when g.status = 'active' and v_end is not null and v_now >= v_end
            then 0
          else null
        end
    ),
    'counts', jsonb_build_object(
      'base_count', coalesce(bases_ready,0),
      'member_count', coalesce(members_total,0)
    ),
    'leaderboard', (
      select jsonb_agg(
        jsonb_build_object(
          'user_id', player->>'user_id',
          'area_km2', (player->'stats'->>'territory_area_km2')::numeric
        )
        order by (player->'stats'->>'territory_area_km2')::numeric desc
      )
      from jsonb_array_elements(coalesce(players, '[]'::jsonb)) as player
      where (player->'stats'->>'territory_area_km2')::numeric > 0
    )
  );
end;
$$;

-- Grant access to authenticated users
REVOKE ALL ON FUNCTION public.get_game_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_overview(uuid) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.get_game_overview(uuid) IS 'Returns comprehensive game overview including player stats, readiness, and game details';