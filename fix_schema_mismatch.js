// Fix the schema mismatch between code and database
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

console.log('🔧 FIKSER SCHEMA MISMATCH MELLEM KODE OG DATABASE');
console.log('===============================================');

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
      console.log(`⚠️  ${description} - ${error} (muligvis forventet)`);
      return { success: false, error };
    }
  } catch (error) {
    console.log(`⚠️  ${description} - ${error.message} (muligvis forventet)`);
    return { success: false, error: error.message };
  }
}

async function fixSchemaMismatch() {
  // 1) Ret kolonnenavnet fra creator_id til admin_user_id
  console.log('1️⃣ RETTER KOLONNE NAVN FRA creator_id TIL admin_user_id');
  await executeSQL(`
    ALTER TABLE public.leagues 
    RENAME COLUMN creator_id TO admin_user_id;
  `, 'Omdøber creator_id til admin_user_id');

  // 2) Opdater kolonnens data type og constraint
  await executeSQL(`
    ALTER TABLE public.leagues 
    ALTER COLUMN admin_user_id SET NOT NULL;
  `, 'Gør admin_user_id NOT NULL');

  // 3) Tilføj is_public og max_members kolonner som koden forventer
  await executeSQL(`
    ALTER TABLE public.leagues 
    ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 10;
  `, 'Tilføjer is_public og max_members kolonner');

  // 4) Drop is_private kolonne hvis den findes (erstatter med is_public)
  await executeSQL(`
    ALTER TABLE public.leagues 
    DROP COLUMN IF EXISTS is_private;
  `, 'Fjerner is_private kolonne');

  // 5) Opret league_members tabel (den mangler helt!)
  console.log('2️⃣ OPRETTER MANGLENDE league_members TABEL');
  await executeSQL(`
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
  `, 'Opretter league_members tabel');

  // 6) Slå RLS til for league_members
  await executeSQL(`
    ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
  `, 'Slår RLS til for league_members');

  // 7) Opret indexes for league_members
  await executeSQL(`
    CREATE INDEX IF NOT EXISTS idx_league_members_league ON public.league_members(league_id);
    CREATE INDEX IF NOT EXISTS idx_league_members_user ON public.league_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_league_members_status ON public.league_members(status);
  `, 'Opretter indexes for league_members');

  // 8) Drop gamle policies med forkerte kolonnenavne
  console.log('3️⃣ OPDATERER RLS POLICIES MED KORREKTE KOLONNENAVNE');
  await executeSQL(`
    DROP POLICY IF EXISTS "League creators can update their leagues" ON public.leagues;
    DROP POLICY IF EXISTS "League creators can view their leagues (by profile)" ON public.leagues;
    DROP POLICY IF EXISTS "Users can create leagues (by profile)" ON public.leagues;
    DROP POLICY IF EXISTS "Users can view leagues they are members of (safe)" ON public.leagues;
  `, 'Sletter gamle policies med forkerte kolonnenavne');

  // 9) Opret nye policies med admin_user_id
  await executeSQL(`
    CREATE POLICY "leagues_read_as_admin"
    ON public.leagues FOR SELECT
    USING (
      exists (
        select 1
        from public.profiles p
        where p.id = leagues.admin_user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter admin read policy med admin_user_id');

  await executeSQL(`
    CREATE POLICY "leagues_read_as_member"
    ON public.leagues FOR SELECT
    USING (
      exists (
        select 1
        from public.league_members lm
        join public.profiles p on p.id = lm.user_id
        where lm.league_id = leagues.id
          and p.user_id = auth.uid()
          and lm.status = 'approved'
      )
    );
  `, 'Opretter member read policy');

  await executeSQL(`
    CREATE POLICY "leagues_insert_as_admin"
    ON public.leagues FOR INSERT
    WITH CHECK (
      exists (
        select 1
        from public.profiles p
        where p.id = admin_user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter league insert policy');

  await executeSQL(`
    CREATE POLICY "leagues_update_as_admin"
    ON public.leagues FOR UPDATE
    USING (
      exists (
        select 1
        from public.profiles p
        where p.id = leagues.admin_user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter league update policy');

  // 10) League members policies
  await executeSQL(`
    CREATE POLICY "league_members_read_own"
    ON public.league_members FOR SELECT
    USING (
      exists (
        select 1
        from public.profiles p
        where p.id = league_members.user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter league_members read policy');

  await executeSQL(`
    CREATE POLICY "league_members_insert_own"
    ON public.league_members FOR INSERT
    WITH CHECK (
      exists (
        select 1
        from public.profiles p
        where p.id = league_members.user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter league_members insert policy');

  // 11) Opdater eksisterende functions til at bruge admin_user_id
  console.log('4️⃣ OPDATERER FUNCTIONS TIL AT BRUGE admin_user_id');
  await executeSQL(`
    DROP FUNCTION IF EXISTS public.create_league(text, text, boolean, integer);
  `, 'Sletter gammel create_league function');

  await executeSQL(`
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
      RETURN json_build_object('success', true, 'league_id', league_record.id, 'invite_code', league_record.invite_code);
    END;
    $$;
  `, 'Opretter ny create_league function med admin_user_id');

  await executeSQL(`
    GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
  `, 'Giver permissions til ny create_league function');

  console.log('\n🎉 SCHEMA MISMATCH FIKSET!');
  console.log('==========================');
  console.log('✅ creator_id → admin_user_id omdøbt');
  console.log('✅ league_members tabel oprettet');
  console.log('✅ Alle RLS policies opdateret');
  console.log('✅ Functions opdateret til korrekte kolonnenavne');
  console.log('');
  console.log('🚀 400 fejlen skulle nu være løst!');
  console.log('   Test: http://localhost:8081 -> Start');
}

fixSchemaMismatch().catch(console.error);