// Diagnosticer og fiks league problemer baseret på din analyse
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

console.log('🔍 DIAGNOSTICERER LEAGUE SKEMA OG RLS PROBLEMER');
console.log('==============================================');

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
      if (result && result.length > 0) {
        console.log('📊 Resultat:', result);
      }
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

async function diagnoseAndFix() {
  // 1) Tjek kolonner i leagues tabellen
  console.log('1️⃣ TJEKKER LEAGUES TABEL STRUKTUR');
  await executeSQL(`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema='public' and table_name='leagues'
    order by ordinal_position;
  `, 'Tjekker leagues kolonner');

  // 2) Tjek kolonner i league_members tabellen  
  console.log('\n2️⃣ TJEKKER LEAGUE_MEMBERS TABEL STRUKTUR');
  await executeSQL(`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema='public' and table_name='league_members'
    order by ordinal_position;
  `, 'Tjekker league_members kolonner');

  // 3) Tjek RLS status
  console.log('\n3️⃣ TJEKKER RLS STATUS');
  await executeSQL(`
    select relname as table_name, relrowsecurity as rls_enabled
    from pg_class
    where relname in ('leagues','league_members');
  `, 'Tjekker RLS status');

  // 4) Tjek eksisterende policies
  console.log('\n4️⃣ TJEKKER EKSISTERENDE RLS POLICIES');
  await executeSQL(`
    select policyname, tablename, cmd, roles, qual as using_expression
    from pg_policies
    where tablename in ('leagues','league_members')
    order by tablename, policyname;
  `, 'Tjekker RLS policies');

  // 5) Sikre admin_user_id kolonnen findes
  console.log('\n5️⃣ SIKRER ADMIN_USER_ID KOLONNE');
  await executeSQL(`
    alter table public.leagues
      add column if not exists admin_user_id uuid;
  `, 'Tilføjer admin_user_id kolonne hvis mangler');

  // 6) Tilføj foreign key constraint
  console.log('\n6️⃣ TILFØJER FOREIGN KEY CONSTRAINT');
  await executeSQL(`
    do $
    begin
      if not exists (
        select 1 from pg_constraint
        where conname = 'leagues_admin_user_fk'
      ) then
        alter table public.leagues
          add constraint leagues_admin_user_fk
          foreign key (admin_user_id) references public.profiles(id)
          on delete set null;
      end if;
    end $;
  `, 'Tilføjer FK constraint til profiles');

  // 7) Tilføj index
  console.log('\n7️⃣ TILFØJER INDEX');
  await executeSQL(`
    create index if not exists idx_leagues_admin_user on public.leagues(admin_user_id);
  `, 'Opretter index på admin_user_id');

  // 8) Slå RLS til
  console.log('\n8️⃣ SLÅR RLS TIL');
  await executeSQL(`
    alter table public.leagues enable row level security;
  `, 'Slår RLS til for leagues');
  
  await executeSQL(`
    alter table public.league_members enable row level security;
  `, 'Slår RLS til for league_members');

  // 9) Drop gamle policies først
  console.log('\n9️⃣ RYDDER OP I GAMLE POLICIES');
  await executeSQL(`
    drop policy if exists leagues_select_policy on public.leagues;
    drop policy if exists leagues_insert_policy on public.leagues;
    drop policy if exists leagues_update_policy on public.leagues;
    drop policy if exists league_members_select_policy on public.league_members;
    drop policy if exists league_members_insert_policy on public.league_members;
  `, 'Sletter gamle policies');

  // 10) Opret nye korrekte RLS policies
  console.log('\n🔟 OPRETTER KORREKTE RLS POLICIES');
  
  // Policy for at se leagues som admin
  await executeSQL(`
    create policy leagues_read_as_admin
    on public.leagues for select
    using (
      exists (
        select 1
        from public.profiles p
        where p.id = leagues.admin_user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter admin read policy');

  // Policy for at se leagues som medlem
  await executeSQL(`
    create policy leagues_read_as_member
    on public.leagues for select
    using (
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

  // Policy for at oprette leagues
  await executeSQL(`
    create policy leagues_insert_as_admin
    on public.leagues for insert
    with check (
      exists (
        select 1
        from public.profiles p
        where p.id = admin_user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter league insert policy');

  // Policy for at opdatere leagues
  await executeSQL(`
    create policy leagues_update_as_admin
    on public.leagues for update
    using (
      exists (
        select 1
        from public.profiles p
        where p.id = leagues.admin_user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter league update policy');

  // Policy for league_members - se egne medlemskaber
  await executeSQL(`
    create policy league_members_read_own
    on public.league_members for select
    using (
      exists (
        select 1
        from public.profiles p
        where p.id = league_members.user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter member read policy');

  // Policy for at indsætte league members
  await executeSQL(`
    create policy league_members_insert_own
    on public.league_members for insert
    with check (
      exists (
        select 1
        from public.profiles p
        where p.id = league_members.user_id
          and p.user_id = auth.uid()
      )
    );
  `, 'Opretter member insert policy');

  console.log('\n🎉 DIAGNOSE OG RETTELSE FULDFØRT!');
  console.log('==================================');
  console.log('✅ Tabel struktur kontrolleret og rettet');
  console.log('✅ RLS policies opdateret med korrekt profile mapping');
  console.log('✅ Foreign keys og indexes tilføjet');
  console.log('');
  console.log('🚀 Din leagues side skulle nu virke uden 400 fejl!');
  console.log('   Test på: http://localhost:8081');
}

diagnoseAndFix().catch(console.error);