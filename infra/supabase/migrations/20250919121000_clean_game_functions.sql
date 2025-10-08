-- Clean up game function overloads and fix auth context
-- Step 1: Drop existing function overloads to prevent conflicts

BEGIN;

-- Drop all existing create_game function overloads
DROP FUNCTION IF EXISTS public.create_game(uuid, text, integer, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.create_game(uuid, text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.create_game(uuid, text) CASCADE;

-- Drop all existing get_game_overview function overloads
DROP FUNCTION IF EXISTS public.get_game_overview(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_game_overview(uuid) CASCADE;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS ensure_admin_membership_trigger ON public.leagues CASCADE;
DROP FUNCTION IF EXISTS public.ensure_admin_league_membership() CASCADE;

COMMIT;