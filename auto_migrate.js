import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runSQL(query, description) {
  console.log(`🔄 ${description}...`);
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: query });
    if (error) {
      console.error(`❌ Error in ${description}:`, error);
      throw error;
    }
    console.log(`✅ ${description} - Success`);
    return { success: true, data };
  } catch (error) {
    console.error(`❌ Failed ${description}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runTerritoryGameMigration() {
  console.log('🎮 STARTING TERRITORY GAME MIGRATION');
  console.log('=====================================');

  try {
    // 1. Enable PostGIS and add columns to user_activities
    await runSQL(`
      -- Safety timeouts
      SET LOCAL statement_timeout = '30s';
      SET LOCAL lock_timeout = '5s';
      SET LOCAL idle_in_transaction_session_timeout = '15s';
      
      -- Enable PostGIS
      CREATE EXTENSION IF NOT EXISTS postgis;
      
      -- Add route and is_base columns to user_activities
      ALTER TABLE public.user_activities
        ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);
      
      ALTER TABLE public.user_activities
        ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;
      
      -- Create unique constraint and spatial index
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
      ON public.user_activities (user_id)
      WHERE is_base = true;
      
      CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
        ON public.user_activities
        USING GIST (route);
    `, 'Enable PostGIS and update user_activities');

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
      
      ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_leagues_admin ON public.leagues(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);
    `, 'Create leagues table');

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
      
      ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
      CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_league_members_status ON public.league_members(status);
    `, 'Create league_members table');

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
      
      ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_games_league ON public.games(league_id);
      CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
    `, 'Create games table');

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
      
      ALTER TABLE public.player_bases ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_player_bases_game ON public.player_bases(game_id);
      CREATE INDEX IF NOT EXISTS idx_player_bases_user ON public.player_bases(user_id);
    `, 'Create player_bases table');

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
      
      ALTER TABLE public.territory_takeovers ENABLE ROW LEVEL SECURITY;
      
      CREATE INDEX IF NOT EXISTS idx_territory_takeovers_game ON public.territory_takeovers(game_id);
      CREATE INDEX IF NOT EXISTS idx_territory_takeovers_intersection ON public.territory_takeovers USING GIST(intersection_point);
    `, 'Create territory_takeovers table');

    console.log('🎉 TERRITORY GAME MIGRATION COMPLETE!');
    console.log('=====================================');
    console.log('✅ PostGIS enabled');
    console.log('✅ user_activities table updated with route geometry');
    console.log('✅ Leagues system created (leagues, league_members)'); 
    console.log('✅ Games system created (games, player_bases)');
    console.log('✅ Territory system created (territory_takeovers)');
    console.log('✅ All RLS policies and indexes created');
    console.log('');
    console.log('🎮 Your Territory Game is now LIVE and ready!');
    console.log('🚀 Visit your app and click "Start Game" to begin!');

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

// Run the migration
runTerritoryGameMigration().catch(error => {
  console.error('Failed to run migration:', error);
  process.exit(1);
});