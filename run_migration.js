const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.D4KSBQ-nxGnmwzUIExYAjJBkFqeVGbNrMo7NLt4rGNw';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Starting Territory Game Migration...');

  try {
    // 1. Enable PostGIS extension
    console.log('1. Enabling PostGIS extension...');
    await supabase.rpc('sql', { query: 'CREATE EXTENSION IF NOT EXISTS postgis;' });
    
    // 2. Add route and is_base columns to user_activities
    console.log('2. Adding route and is_base columns...');
    await supabase.rpc('sql', { 
      query: `
        ALTER TABLE public.user_activities
          ADD COLUMN IF NOT EXISTS route geometry(LineString, 4326);
        
        ALTER TABLE public.user_activities
          ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;
      `
    });

    // 3. Create unique constraint and spatial index
    console.log('3. Creating indexes...');
    await supabase.rpc('sql', { 
      query: `
        CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
        ON public.user_activities (user_id)
        WHERE is_base = true;

        CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
          ON public.user_activities
          USING GIST (route);
      `
    });

    // 4. Create leagues table
    console.log('4. Creating leagues table...');
    await supabase.rpc('sql', { 
      query: `
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
      `
    });

    // 5. Create league members table
    console.log('5. Creating league members table...');
    await supabase.rpc('sql', { 
      query: `
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
      `
    });

    // 6. Create games table
    console.log('6. Creating games table...');
    await supabase.rpc('sql', { 
      query: `
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
      `
    });

    // 7. Create player bases table
    console.log('7. Creating player bases table...');
    await supabase.rpc('sql', { 
      query: `
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
      `
    });

    // 8. Create territory takeovers table
    console.log('8. Creating territory takeovers table...');
    await supabase.rpc('sql', { 
      query: `
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
      `
    });

    console.log('✅ Territory Game Migration Complete!');
    console.log('🎮 Your multiplayer territory game is now ready!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration();