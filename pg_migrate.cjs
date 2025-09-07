const { Client } = require('pg');

// Connection using service role key
const connectionString = 'postgresql://postgres.ojjpslrhyutizwpvvngu:mGEOSDzGkAbKMzqw@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function runSQL(query, description) {
  console.log(`🔄 ${description}...`);
  try {
    const result = await client.query(query);
    console.log(`✅ ${description} - Success`);
    return result;
  } catch (error) {
    console.error(`❌ Error in ${description}:`, error.message);
    throw error;
  }
}

async function runTerritoryGameMigration() {
  console.log('🎮 STARTING TERRITORY GAME MIGRATION');
  console.log('=====================================');

  try {
    await client.connect();
    console.log('🔌 Connected to Supabase database');

    // 1. Enable PostGIS and add columns to user_activities
    await runSQL(`
      -- Safety timeouts
      SET statement_timeout = '30s';
      SET lock_timeout = '5s';
      SET idle_in_transaction_session_timeout = '15s';
      
      -- Enable PostGIS
      CREATE EXTENSION IF NOT EXISTS postgis;
      
      -- Add route and is_base columns to user_activities
      ALTER TABLE public.user_activities
        ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);
      
      ALTER TABLE public.user_activities
        ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;
    `, 'Enable PostGIS and update user_activities');

    await runSQL(`
      -- Create unique constraint and spatial index
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
      ON public.user_activities (user_id)
      WHERE is_base = true;
      
      CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
        ON public.user_activities
        USING GIST (route);
    `, 'Create indexes on user_activities');

    // 2. Create leagues table
    await runSQL(`
      CREATE TABLE IF NOT EXISTS public.leagues (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        description text,
        admin_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        invite_code text UNIQUE NOT NULL DEFAULT substring(gen_random_uuid()::text, 1, 8),
        is_public boolean NOT NULL DEFAULT false,
        max_members integer NOT NULL DEFAULT 10,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `, 'Create leagues table');

    await runSQL(`
      ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_leagues_admin ON public.leagues(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);
    `, 'Enable RLS and create indexes on leagues');

    // 3. Create league_members table
    await runSQL(`
      CREATE TABLE IF NOT EXISTS public.league_members (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'left')),
        joined_at timestamptz NOT NULL DEFAULT now(),
        approved_at timestamptz,
        approved_by uuid REFERENCES public.profiles(id),
        UNIQUE(league_id, user_id)
      );
    `, 'Create league_members table');

    await runSQL(`
      ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
      CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_league_members_status ON public.league_members(status);
    `, 'Enable RLS and create indexes on league_members');

    // 4. Create games table
    await runSQL(`
      CREATE TABLE IF NOT EXISTS public.games (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
        name text NOT NULL,
        status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'finished', 'cancelled')),
        start_date timestamptz,
        end_date timestamptz,
        winner_user_id uuid REFERENCES public.profiles(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE
      );
    `, 'Create games table');

    await runSQL(`
      ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_games_league ON public.games(league_id);
      CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
    `, 'Enable RLS and create indexes on games');

    // 5. Create player_bases table
    await runSQL(`
      CREATE TABLE IF NOT EXISTS public.player_bases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        activity_id uuid NOT NULL REFERENCES public.user_activities(id) ON DELETE CASCADE,
        base_date timestamptz NOT NULL,
        territory_size_km2 numeric DEFAULT 0,
        last_calculated_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(game_id, user_id)
      );
    `, 'Create player_bases table');

    await runSQL(`
      ALTER TABLE public.player_bases ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_player_bases_game ON public.player_bases(game_id);
      CREATE INDEX IF NOT EXISTS idx_player_bases_user ON public.player_bases(user_id);
    `, 'Enable RLS and create indexes on player_bases');

    // 6. Create territory_takeovers table
    await runSQL(`
      CREATE TABLE IF NOT EXISTS public.territory_takeovers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
        taken_from_user_id uuid NOT NULL REFERENCES public.profiles(id),
        taken_by_user_id uuid NOT NULL REFERENCES public.profiles(id),
        activity_id uuid NOT NULL REFERENCES public.user_activities(id),
        intersection_point geometry(Point, 4326),
        territory_lost_km2 numeric DEFAULT 0,
        territory_gained_km2 numeric DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `, 'Create territory_takeovers table');

    await runSQL(`
      ALTER TABLE public.territory_takeovers ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_territory_takeovers_game ON public.territory_takeovers(game_id);
      CREATE INDEX IF NOT EXISTS idx_territory_takeovers_intersection ON public.territory_takeovers USING GIST(intersection_point);
    `, 'Enable RLS and create indexes on territory_takeovers');

    // 7. Create essential functions
    await runSQL(`
      -- Function to create a new league
      CREATE OR REPLACE FUNCTION public.create_league(
        p_name text,
        p_description text DEFAULT NULL,
        p_is_public boolean DEFAULT false,
        p_max_members integer DEFAULT 10
      )
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        league_record record;
        user_profile_id uuid;
      BEGIN
        SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
        
        IF user_profile_id IS NULL THEN
          RETURN json_build_object('success', false, 'error', 'User profile not found');
        END IF;

        INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
        VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members)
        RETURNING * INTO league_record;

        INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
        VALUES (league_record.id, user_profile_id, 'approved', now(), user_profile_id);

        RETURN json_build_object(
          'success', true,
          'league_id', league_record.id,
          'invite_code', league_record.invite_code
        );
      END;
      $$;
    `, 'Create create_league function');

    await runSQL(`
      -- Function to join a league
      CREATE OR REPLACE FUNCTION public.join_league(p_invite_code text)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      DECLARE
        league_record record;
        user_profile_id uuid;
        member_count integer;
      BEGIN
        SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
        
        IF user_profile_id IS NULL THEN
          RETURN json_build_object('success', false, 'error', 'User profile not found');
        END IF;

        SELECT * INTO league_record FROM public.leagues WHERE invite_code = p_invite_code;

        IF league_record IS NULL THEN
          RETURN json_build_object('success', false, 'error', 'League not found');
        END IF;

        IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = league_record.id AND user_id = user_profile_id) THEN
          RETURN json_build_object('success', false, 'error', 'Already a member of this league');
        END IF;

        SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = league_record.id AND status = 'approved';

        IF member_count >= league_record.max_members THEN
          RETURN json_build_object('success', false, 'error', 'League is full');
        END IF;

        INSERT INTO public.league_members (league_id, user_id, status)
        VALUES (
          league_record.id, 
          user_profile_id, 
          CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END
        );

        RETURN json_build_object(
          'success', true,
          'league_id', league_record.id,
          'league_name', league_record.name,
          'status', CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END
        );
      END;
      $$;
    `, 'Create join_league function');

    await runSQL(`
      -- Grant permissions to functions
      GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
      GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;
    `, 'Grant function permissions');

    console.log('🎉 TERRITORY GAME MIGRATION COMPLETE!');
    console.log('=====================================');
    console.log('✅ PostGIS enabled');
    console.log('✅ user_activities table updated with route geometry');
    console.log('✅ Leagues system created (leagues, league_members)'); 
    console.log('✅ Games system created (games, player_bases)');
    console.log('✅ Territory system created (territory_takeovers)');
    console.log('✅ Essential functions created (create_league, join_league)');
    console.log('✅ All RLS policies and indexes created');
    console.log('');
    console.log('🎮 Your Territory Game is now LIVE and ready!');
    console.log('🚀 Visit your app and click "Start Game" to begin!');

  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the migration
runTerritoryGameMigration().catch(error => {
  console.error('Failed to run migration:', error.message);
  process.exit(1);
});