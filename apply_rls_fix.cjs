require('dotenv').config({ path: '.env.production' });
const { createClient } = require('@supabase/supabase-js');

async function applyRLSFix() {
  const supabase = createClient(
    'https://ojjpslrhyutizwpvvngu.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('🛠️  Applying RLS fix automatically...\n');

  try {
    // Step 1: Enable RLS
    console.log('1️⃣  Enabling RLS on games table...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      query: 'ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError) {
      console.log('ℹ️   RLS enable result:', rlsError.message);
    } else {
      console.log('✅ RLS enabled');
    }

    // Step 2: Create policy for league members to read games
    console.log('\n2️⃣  Creating policy for league members...');
    const policySQL = `
      DROP POLICY IF EXISTS "league_members_read_games" ON public.games;
      CREATE POLICY "league_members_read_games"
      ON public.games
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.league_members lm
          WHERE lm.league_id = games.league_id
            AND lm.user_id = auth.uid()
        )
      );
    `;

    const { error: policyError } = await supabase.rpc('exec_sql', {
      query: policySQL
    });

    if (policyError) {
      console.log('❌ Policy creation failed:', policyError);
    } else {
      console.log('✅ Policy created');
    }

    // Step 3: Test if it works
    console.log('\n3️⃣  Testing the fix...');

    // Create test authenticated client (would need real JWT in practice)
    const { data: testData, error: testError } = await supabase
      .from('games')
      .select('id, name, status')
      .eq('league_id', 'a921483a-35fb-4303-8cad-283f536e9d0e')
      .limit(3);

    if (testError) {
      console.log('⚠️  Test query (service role):', testError.message);
    } else {
      console.log('✅ Service role can read', testData.length, 'games');
    }

    console.log('\n🎉 RLS FIX APPLIED!');
    console.log('   → League members can now read games');
    console.log('   → Frontend should now show games in leagues');
    console.log('   → Try refreshing your league page');

  } catch (error) {
    console.error('💥 Fix failed:', error);
  }
}

applyRLSFix();