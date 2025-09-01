-- RUN THIS IN SUPABASE SQL EDITOR

-- 1) Simple user totals RPC for dashboard stats
create or replace function public.user_totals()
returns table (
  total_distance_km numeric,
  activities_count bigint
)
language sql
security definer
as $$
  select
    coalesce(sum(distance), 0)::numeric as total_distance_km,
    count(*)::bigint as activities_count
  from public.user_activities
  where user_id = auth.uid();
$$;

-- Grant permissions
revoke all on function public.user_totals() from public;
grant execute on function public.user_totals() to anon, authenticated;

-- 2) Enable PostGIS for territory calculations
create extension if not exists postgis;
create extension if not exists postgis_topology;

-- 3) Create user territories table
create table if not exists public.user_territories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null, -- id from user_activities
  geom geometry(Polygon, 4326) not null,
  area_m2 numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, activity_id)
);

-- RLS policies for user territories
alter table public.user_territories enable row level security;

drop policy if exists "Users can view their territories" on public.user_territories;
drop policy if exists "Users can insert their territories" on public.user_territories;

create policy "Users can view their territories"
  on public.user_territories
  for select
  using (user_id = auth.uid());

create policy "Users can insert their territories"
  on public.user_territories
  for insert
  with check (user_id = auth.uid());

-- 4) Helper functions for territory creation
create or replace function public.jsonb_points_to_linestring(coords jsonb)
returns geometry(LineString, 4326)
language plpgsql
as $$
declare
  pts text;
begin
  -- Convert JSONB array to WKT LineString format (lon lat order)
  select string_agg(format('%s %s',
                           (elem->>'lng')::text,
                           (elem->>'lat')::text),
                    ',')
    into pts
  from jsonb_array_elements(coords) as elem
  where (elem ? 'lat') and (elem ? 'lng');

  if pts is null then
    return null;
  end if;

  return ST_GeomFromText('LINESTRING(' || pts || ')', 4326);
end;
$$;

create or replace function public.close_linestring(ls geometry(LineString, 4326))
returns geometry(LineString, 4326)
language sql
as $$
  select case
    when ST_IsClosed(ls) then ls
    else ST_AddPoint(ls, ST_StartPoint(ls))
  end
$$;

create or replace function public.route_to_polygon(ls geometry(LineString, 4326))
returns geometry(Polygon, 4326)
language plpgsql
as $$
declare
  closed geometry(LineString, 4326);
  poly   geometry(Polygon, 4326);
begin
  if ls is null then
    return null;
  end if;

  closed := public.close_linestring(ls);

  -- Try to create polygon from the route
  begin
    poly := ST_MakeValid( ST_MakePolygon( ST_LineMerge(closed) ) );
  exception
    when others then
      poly := null;
  end;

  -- Fallback: use 15m buffer if polygon creation fails
  if poly is null then
    poly := ST_Transform(
              ST_Buffer( ST_Transform(closed, 3857), 15.0 ), -- 15m buffer in Web Mercator
            4326)::geometry(Polygon, 4326);
  end if;

  -- Standardize and validate
  poly := ST_ForceRHR( ST_MakeValid(poly) );

  return poly;
end;
$$;

create or replace function public.poly_area_m2(poly geometry(Polygon, 4326))
returns numeric
language sql
as $$
  select ST_Area(poly::geography)
$$;

-- 5) Trigger function to auto-create territories
create or replace function public.make_territory_on_activity()
returns trigger
language plpgsql
security definer
as $$
declare
  ls   geometry(LineString, 4326);
  poly geometry(Polygon, 4326);
  a_m2 numeric;
begin
  -- Only process if route_coordinates exists
  if new.route_coordinates is null then
    return new;
  end if;

  ls := public.jsonb_points_to_linestring(new.route_coordinates);
  if ls is null then
    return new;
  end if;

  poly := public.route_to_polygon(ls);
  if poly is null then
    return new;
  end if;

  a_m2 := public.poly_area_m2(poly);

  insert into public.user_territories (user_id, activity_id, geom, area_m2)
  values (new.user_id, new.id, poly, a_m2)
  on conflict (user_id, activity_id) do update set
    geom = excluded.geom,
    area_m2 = excluded.area_m2;

  return new;
end;
$$;

-- 6) Create the trigger
drop trigger if exists trg_make_territory_on_activity on public.user_activities;
create trigger trg_make_territory_on_activity
after insert or update of route_coordinates
on public.user_activities
for each row
execute function public.make_territory_on_activity();

-- 7) Territory totals RPC
create or replace function public.user_territory_totals()
returns table (
  total_area_km2 numeric,
  territories_count bigint
)
language sql
security definer
as $$
  select
    coalesce( sum(area_m2), 0 ) / 1e6 as total_area_km2,
    count(*)::bigint as territories_count
  from public.user_territories
  where user_id = auth.uid();
$$;

revoke all on function public.user_territory_totals() from public;
grant execute on function public.user_territory_totals() to anon, authenticated;

-- 8) GeoJSON export for map visualization
create or replace function public.user_territories_geojson()
returns table (feature json)
language sql
security definer
as $$
  select json_build_object(
    'type', 'Feature',
    'geometry', ST_AsGeoJSON(geom)::json,
    'properties', json_build_object(
      'activity_id', activity_id,
      'area_m2', area_m2,
      'created_at', created_at
    )
  ) as feature
  from public.user_territories
  where user_id = auth.uid();
$$;

grant execute on function public.user_territories_geojson() to anon, authenticated;