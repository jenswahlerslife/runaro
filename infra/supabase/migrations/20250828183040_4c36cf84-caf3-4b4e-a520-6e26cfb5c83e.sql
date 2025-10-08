-- Protect Strava tokens from being readable by clients
-- Keep existing RLS (owner-only), but additionally revoke column-level SELECT
-- so even the owning user cannot read the token values from the client.

-- Revoke for anonymous and authenticated roles
REVOKE SELECT (strava_access_token, strava_refresh_token)
ON public.profiles
FROM anon;

REVOKE SELECT (strava_access_token, strava_refresh_token)
ON public.profiles
FROM authenticated;

-- Optionally, ensure service_role retains full access (no action needed if not previously revoked)
-- GRANT SELECT (strava_access_token, strava_refresh_token) ON public.profiles TO service_role;