-- RPC to insert a user activity with optional WKT route geometry
-- Keeps Edge Functions free of raw SQL and PostGIS dependencies

CREATE EXTENSION IF NOT EXISTS postgis;

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
  );
END;
$$;

REVOKE ALL ON FUNCTION public.insert_user_activity_with_route(
  uuid, bigint, text, real, integer, text, timestamptz, real, real, real, integer, text, boolean, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_user_activity_with_route(
  uuid, bigint, text, real, integer, text, timestamptz, real, real, real, integer, text, boolean, boolean, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.insert_user_activity_with_route(
  uuid, bigint, text, real, integer, text, timestamptz, real, real, real, integer, text, boolean, boolean, text
) IS 'Inserts a user activity row with optional WKT route geometry. Used by Edge Functions.';

