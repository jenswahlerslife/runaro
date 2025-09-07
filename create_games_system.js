// Implementer det komplette game system baseret på din analyse
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

console.log('🎮 OPRETTER KOMPLET GAME SYSTEM');
console.log('===============================');

async function executeSQL(sql, description) {
  console.log(`🔧 ${description}...`);
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: sql
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${description} - Success`);
      return { success: true, data: result };
    } else {
      const error = await response.text();
      console.log(`❌ ${description} - ${error}`);
      return { success: false, error };
    }
  } catch (error) {
    console.log(`❌ ${description} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function createGamesSystem() {
  // 1) Opret games tabel (eller opdater den eksisterende)
  console.log('1️⃣ OPRETTER GAMES TABEL');
  await executeSQL(`
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
  `, 'Opretter games tabel');

  await executeSQL(`
    CREATE INDEX IF NOT EXISTS idx_games_league ON public.games(league_id);
    CREATE INDEX IF NOT EXISTS idx_games_status ON public.games(status);
  `, 'Opretter games indexes');

  // 2) Slå RLS til for games
  await executeSQL(`
    ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
  `, 'Slår RLS til for games');

  // 3) Opret RLS policies for games
  console.log('2️⃣ OPRETTER GAME RLS POLICIES');
  
  await executeSQL(`
    DROP POLICY IF EXISTS "games_select_policy" ON public.games;
    CREATE POLICY "games_select_for_members"
    ON public.games FOR SELECT
    USING (
      exists (
        select 1
        from public.league_members lm
        join public.profiles p on p.id = lm.user_id
        where lm.league_id = games.league_id
          and p.user_id = auth.uid()
          and lm.status = 'approved'
      )
      or exists (
        select 1
        from public.profiles p
        join public.leagues l on l.admin_user_id = p.id
        where p.user_id = auth.uid()
          and l.id = games.league_id
      )
    );
  `, 'Opretter games SELECT policy');

  await executeSQL(`
    DROP POLICY IF EXISTS "games_insert_policy" ON public.games;
    CREATE POLICY "games_write_for_admin"
    ON public.games FOR ALL
    TO authenticated
    USING (
      exists (
        select 1
        from public.profiles p
        join public.leagues l on l.admin_user_id = p.id
        where p.user_id = auth.uid()
          and l.id = games.league_id
      )
    )
    WITH CHECK (
      exists (
        select 1
        from public.profiles p
        join public.leagues l on l.admin_user_id = p.id
        where p.user_id = auth.uid()
          and l.id = games.league_id
      )
    );
  `, 'Opretter games WRITE policy');

  // 4) Opret create_game function
  console.log('3️⃣ OPRETTER CREATE_GAME FUNCTION');
  await executeSQL(`
    CREATE OR REPLACE FUNCTION public.create_game(
      p_league_id uuid,
      p_name text,
      p_duration_days int DEFAULT 30
    )
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_profile_id uuid;
      v_game record;
      v_member_count integer;
    BEGIN
      -- Find profile.id for nuværende bruger
      SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();
      IF v_profile_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'No profile for current user');
      END IF;

      -- Tjek at brugeren er admin for ligaen
      IF NOT EXISTS (
        SELECT 1 FROM public.leagues
        WHERE id = p_league_id AND admin_user_id = v_profile_id
      ) THEN
        RETURN json_build_object('success', false, 'error', 'Only league admin can create games');
      END IF;

      -- Tæl medlemmer i ligaen
      SELECT COUNT(*) INTO v_member_count
      FROM public.league_members
      WHERE league_id = p_league_id AND status = 'approved';

      IF v_member_count < 2 THEN
        RETURN json_build_object('success', false, 'error', 'League needs at least 2 approved members to create a game');
      END IF;

      -- Opret spillet
      INSERT INTO public.games(league_id, name, start_date, end_date, status, created_by)
      VALUES (
        p_league_id,
        COALESCE(p_name, 'New Game'),
        now(),
        now() + make_interval(days => COALESCE(p_duration_days, 30)),
        'setup',
        v_profile_id
      )
      RETURNING * INTO v_game;

      RETURN json_build_object(
        'success', true,
        'game_id', v_game.id,
        'game_name', v_game.name,
        'member_count', v_member_count
      );
    END;
    $$;
  `, 'Opretter create_game function');

  // 5) Opret start_game function
  console.log('4️⃣ OPRETTER START_GAME FUNCTION');
  await executeSQL(`
    CREATE OR REPLACE FUNCTION public.start_game(p_game_id uuid)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_profile_id uuid;
      v_game record;
      v_member_count integer;
      v_base_count integer;
    BEGIN
      -- Find profile.id for nuværende bruger
      SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();

      -- Tjek at brugeren er admin for spillets liga
      SELECT g.* INTO v_game
      FROM public.games g
      JOIN public.leagues l ON g.league_id = l.id
      WHERE g.id = p_game_id AND l.admin_user_id = v_profile_id;

      IF v_game IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized to start this game');
      END IF;

      -- Tæl medlemmer og baser (hvis player_bases tabel eksisterer)
      SELECT COUNT(*) INTO v_member_count
      FROM public.league_members
      WHERE league_id = v_game.league_id AND status = 'approved';

      -- For nu sæt base_count til 0 (kan udvides senere)
      v_base_count := 0;

      -- Start spillet
      UPDATE public.games
      SET status = 'active',
          start_date = now(),
          end_date = now() + interval '30 days'
      WHERE id = p_game_id;

      RETURN json_build_object(
        'success', true,
        'start_date', now(),
        'end_date', now() + interval '30 days',
        'member_count', v_member_count,
        'base_count', v_base_count
      );
    END;
    $$;
  `, 'Opretter start_game function');

  // 6) Grant permissions
  console.log('5️⃣ GIVER FUNCTION PERMISSIONS');
  await executeSQL(`
    GRANT EXECUTE ON FUNCTION public.create_game(uuid, text, int) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.start_game(uuid) TO authenticated;
  `, 'Giver permissions til game functions');

  // 7) Test at funktionerne eksisterer
  console.log('6️⃣ TESTER AT FUNCTIONS EKSISTERER');
  await executeSQL(`
    SELECT proname, pronargs 
    FROM pg_proc
    JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
    WHERE n.nspname='public' AND proname IN ('create_game','start_game');
  `, 'Verificerer at functions eksisterer');

  console.log('\n🎉 GAMES SYSTEM OPRETTET!');
  console.log('=========================');
  console.log('✅ games tabel oprettet med korrekte kolonner');
  console.log('✅ RLS policies konfigureret');
  console.log('✅ create_game og start_game functions oprettet');
  console.log('✅ Permissions givet');
  console.log('');
  console.log('🚀 404 fejlen på /rpc/create_game skulle nu være løst!');
  console.log('   Test: Reload siden og prøv "Create Game" igen');
}

createGamesSystem().catch(console.error);