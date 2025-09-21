-- Idempotent hardening of user_activities defaults and indexes

CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure defaults
ALTER TABLE public.user_activities
  ALTER COLUMN is_base SET DEFAULT false;

ALTER TABLE public.user_activities
  ALTER COLUMN included_in_game SET DEFAULT false;

-- Partial unique index: one base per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
  ON public.user_activities (user_id)
  WHERE is_base = true;

-- Spatial index on route
CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
  ON public.user_activities
  USING GIST (route);

-- Helpful comments
COMMENT ON COLUMN public.user_activities.is_base IS 'Marks base activity for user. Only one per user (partial unique index).';
COMMENT ON COLUMN public.user_activities.included_in_game IS 'If true, include in active game calculations.';
COMMENT ON COLUMN public.user_activities.route IS 'LineString geometry (EPSG:4326) for the activity route.';

