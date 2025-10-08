-- Fix activity reuse across leagues by making insert upsert-capable
-- This allows users to transfer the same Strava activity to multiple leagues

CREATE EXTENSION IF NOT EXISTS postgis;

-- Replace the insert function with upsert capability
CREATE OR REPLACE FUNCTION public.insert_user_activity_with_route(
  p_user_id uuid,
  p_strava_activity_id bigint,
  p_name text,
  p_distance real,
  p_moving_time integer,
  p_activity_type text,
  p_start_date timestamptz,
  p_average_speed real,
  p_max_speed real,
  p_total_elevation_gain real,
  p_points_earned integer,
  p_polyline text,
  p_is_base boolean,
  p_included_in_game boolean,
  p_wkt_route text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Use upsert to allow reusing activities across leagues
  INSERT INTO public.user_activities (
    user_id, strava_activity_id, name, distance, moving_time,
    activity_type, start_date, average_speed, max_speed,
    total_elevation_gain, points_earned, polyline, is_base,
    included_in_game, route
  ) VALUES (
    p_user_id, p_strava_activity_id, p_name, p_distance, p_moving_time,
    p_activity_type, p_start_date, p_average_speed, p_max_speed,
    p_total_elevation_gain, p_points_earned, p_polyline, p_is_base,
    p_included_in_game,
    CASE WHEN p_wkt_route IS NOT NULL THEN ST_SetSRID(ST_GeomFromText(p_wkt_route), 4326) ELSE NULL END
  )
  ON CONFLICT (user_id, strava_activity_id)
  DO UPDATE SET
    -- Update metadata if needed (but keep original polyline/route)
    name = EXCLUDED.name,
    distance = EXCLUDED.distance,
    moving_time = EXCLUDED.moving_time,
    activity_type = EXCLUDED.activity_type,
    start_date = EXCLUDED.start_date,
    average_speed = EXCLUDED.average_speed,
    max_speed = EXCLUDED.max_speed,
    total_elevation_gain = EXCLUDED.total_elevation_gain,
    -- Keep the higher points earned value
    points_earned = GREATEST(user_activities.points_earned, EXCLUDED.points_earned),
    -- Preserve existing polyline and route if they exist
    polyline = COALESCE(user_activities.polyline, EXCLUDED.polyline),
    route = COALESCE(user_activities.route, EXCLUDED.route),
    -- Don't change base status if already set
    is_base = CASE WHEN user_activities.is_base THEN true ELSE EXCLUDED.is_base END,
    -- Allow included_in_game to be updated
    included_in_game = EXCLUDED.included_in_game;
END;
$$;

-- Ensure there's a unique constraint to make ON CONFLICT work
-- This will be idempotent if it already exists
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_strava_activity
  ON public.user_activities (user_id, strava_activity_id);

COMMENT ON FUNCTION public.insert_user_activity_with_route(
  uuid, bigint, text, real, integer, text, timestamptz, real, real, real, integer, text, boolean, boolean, text
) IS 'Upserts a user activity row allowing reuse across leagues. Preserves existing data on conflict.';