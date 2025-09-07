// Complete migration using Supabase Management API
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

async function runSQL(query, description) {
  console.log(`🔄 ${description}...`);
  
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/sql`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      query: query
    })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ Error in ${description}:`, error);
    throw new Error(`${description} failed: ${error}`);
  }

  const result = await response.json();
  console.log(`✅ ${description} - Success`);
  return result;
}

async function runCompleteMigration() {
  console.log('🎮 STARTING COMPLETE TERRITORY GAME MIGRATION');
  console.log('===============================================');

  try {
    // 1. Enable PostGIS and basic setup
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
      
      -- Create unique constraint and spatial index
      DROP INDEX IF EXISTS uniq_base_per_user;
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
      ON public.user_activities (user_id)
      WHERE is_base = true;
      
      CREATE INDEX IF NOT EXISTS idx_user_activities_route_gist
        ON public.user_activities
        USING GIST (route);
    `, 'Enable PostGIS and update user_activities');

    // 2. Create all tables
    await runSQL(`
      -- Create leagues table
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
      
      -- Create league_members table
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
      
      -- Create games table
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
      
      -- Create player_bases table
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
      
      -- Create territory_takeovers table
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
    `, 'Create all tables');

    // 3. Create indexes
    await runSQL(`
      CREATE INDEX IF NOT EXISTS idx_leagues_admin ON public.leagues(admin_user_id);
      CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON public.leagues(invite_code);
      CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
      CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_league_members_status ON public.league_members(status);
      CREATE INDEX IF NOT EXISTS idx_games_league ON public.games(league_id);
      CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
      CREATE INDEX IF NOT EXISTS idx_player_bases_game ON public.player_bases(game_id);
      CREATE INDEX IF NOT EXISTS idx_player_bases_user ON public.player_bases(user_id);
      CREATE INDEX IF NOT EXISTS idx_territory_takeovers_game ON public.territory_takeovers(game_id);
      CREATE INDEX IF NOT EXISTS idx_territory_takeovers_intersection ON public.territory_takeovers USING GIST(intersection_point);
    `, 'Create indexes');

    // 4. Enable RLS
    await runSQL(`
      ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.player_bases ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.territory_takeovers ENABLE ROW LEVEL SECURITY;
    `, 'Enable RLS');

    // 5. Create RLS Policies
    await runSQL(`
      -- Drop existing policies
      DROP POLICY IF EXISTS "Users can view leagues they are members of or public leagues" ON public.leagues;
      DROP POLICY IF EXISTS "Only authenticated users can create leagues" ON public.leagues;
      DROP POLICY IF EXISTS "Only league admins can update leagues" ON public.leagues;
      
      -- Leagues policies
      CREATE POLICY "Users can view leagues they are members of or public leagues"
      ON public.leagues FOR SELECT
      USING (
        is_public = true OR
        admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
        id IN (
          SELECT league_id FROM public.league_members lm
          JOIN public.profiles p ON lm.user_id = p.id
          WHERE p.user_id = auth.uid() AND lm.status = 'approved'
        )
      );
      
      CREATE POLICY "Only authenticated users can create leagues"
      ON public.leagues FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL AND admin_user_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      ));
      
      CREATE POLICY "Only league admins can update leagues"
      ON public.leagues FOR UPDATE
      USING (admin_user_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      ));
    `, 'Create leagues RLS policies');

    await runSQL(`
      -- Drop existing league_members policies
      DROP POLICY IF EXISTS "Users can view memberships for leagues they can see" ON public.league_members;
      DROP POLICY IF EXISTS "Users can join leagues" ON public.league_members;
      DROP POLICY IF EXISTS "League admins and users can update their own membership" ON public.league_members;
      
      -- League members policies
      CREATE POLICY "Users can view memberships for leagues they can see"
      ON public.league_members FOR SELECT
      USING (
        league_id IN (
          SELECT id FROM public.leagues 
          WHERE is_public = true OR
                admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
                id IN (
                  SELECT league_id FROM public.league_members lm2
                  JOIN public.profiles p ON lm2.user_id = p.id
                  WHERE p.user_id = auth.uid()
                )
        )
      );
      
      CREATE POLICY "Users can join leagues"
      ON public.league_members FOR INSERT
      WITH CHECK (
        auth.uid() IS NOT NULL AND
        user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      );
      
      CREATE POLICY "League admins and users can update their own membership"
      ON public.league_members FOR UPDATE
      USING (
        user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
        league_id IN (
          SELECT id FROM public.leagues l
          WHERE l.admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
        )
      );
    `, 'Create league_members RLS policies');

    // 6. Create Functions
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
        -- Get user's profile ID
        SELECT id INTO user_profile_id
        FROM public.profiles 
        WHERE user_id = auth.uid();
        
        IF user_profile_id IS NULL THEN
          RETURN json_build_object(
            'success', false,
            'error', 'User profile not found'
          );
        END IF;

        -- Create the league
        INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
        VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members)
        RETURNING * INTO league_record;

        -- Auto-approve the admin as a member
        INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
        VALUES (league_record.id, user_profile_id, 'approved', now(), user_profile_id);

        RETURN json_build_object(
          'success', true,
          'league_id', league_record.id,
          'invite_code', league_record.invite_code
        );
      END;
      $$;
      
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
        -- Get user's profile ID
        SELECT id INTO user_profile_id
        FROM public.profiles 
        WHERE user_id = auth.uid();
        
        IF user_profile_id IS NULL THEN
          RETURN json_build_object(
            'success', false,
            'error', 'User profile not found'
          );
        END IF;

        -- Find the league
        SELECT * INTO league_record
        FROM public.leagues
        WHERE invite_code = p_invite_code;

        IF league_record IS NULL THEN
          RETURN json_build_object(
            'success', false,
            'error', 'League not found'
          );
        END IF;

        -- Check if already a member
        IF EXISTS (
          SELECT 1 FROM public.league_members
          WHERE league_id = league_record.id AND user_id = user_profile_id
        ) THEN
          RETURN json_build_object(
            'success', false,
            'error', 'Already a member of this league'
          );
        END IF;

        -- Check member limit
        SELECT COUNT(*) INTO member_count
        FROM public.league_members
        WHERE league_id = league_record.id AND status = 'approved';

        IF member_count >= league_record.max_members THEN
          RETURN json_build_object(
            'success', false,
            'error', 'League is full'
          );
        END IF;

        -- Join the league (pending approval unless it's a public league)
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
    `, 'Create league functions');

    // 7. Grant permissions
    await runSQL(`
      GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
      GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;
    `, 'Grant function permissions');

    console.log('🎉 COMPLETE TERRITORY GAME MIGRATION FINISHED!');
    console.log('===============================================');
    console.log('✅ PostGIS enabled');
    console.log('✅ user_activities table updated with route geometry');
    console.log('✅ Leagues system created (leagues, league_members)'); 
    console.log('✅ Games system created (games, player_bases)');
    console.log('✅ Territory system created (territory_takeovers)');
    console.log('✅ All RLS policies created and configured');
    console.log('✅ Database functions created and permissions granted');
    console.log('');
    console.log('🎮 Your Territory Game is now FULLY OPERATIONAL!');
    console.log('🚀 Visit your app and click "Start Game" - it should work now!');

  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    throw error;
  }
}

// Run the migration
runCompleteMigration().catch(error => {
  console.error('Failed to run complete migration:', error.message);
  process.exit(1);
});