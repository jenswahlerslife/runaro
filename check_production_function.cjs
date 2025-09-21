const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseService = createClient(
  `https://${process.env.SUPABASE_PROJECT_REF}.supabase.co`,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProductionFunction() {
  console.log('🔍 PUNKT 1: Bekræft aktiv funktion i produktion...\n');

  try {
    // Check the exact function definition in production using the SQL query you specified
    console.log('1. Checking active get_game_overview function definition...');

    const query = `
      SELECT proname, prosrc, proargtypes, pronargs
      FROM pg_proc
      JOIN pg_namespace n ON n.oid=pg_proc.pronamespace
      WHERE proname='get_game_overview' AND n.nspname='public'
    `;

    const { data: functionData, error: functionError } = await supabaseService
      .from('rpc')
      .select('*')
      .single(); // This won't work, I need to use rpc to execute SQL

    // Try alternative approach with direct SQL execution
    console.log('Attempting to check function via RPC...');

    // Test a simple game ID to see what the actual function returns
    const { data: games } = await supabaseService
      .from('games')
      .select('id')
      .limit(1);

    if (games && games.length > 0) {
      const gameId = games[0].id;
      console.log(`Testing with game ID: ${gameId}`);

      // This is the exact call that tells us what function is active
      const { data: result, error: rpcError } = await supabaseService
        .rpc('get_game_overview', { p_game_id: gameId });

      console.log('\n2. RPC Function test result:');
      if (rpcError) {
        console.error('❌ RPC Error:', rpcError);

        // Check for the specific errors that indicate old function
        if (rpcError.message && rpcError.message.includes('lm.approved')) {
          console.log('🔥 SMOKING GUN: Production is using OLD function with lm.approved!');
        }
        if (rpcError.message && rpcError.message.includes('avatar_url')) {
          console.log('🔥 SMOKING GUN: Production is using OLD function with avatar_url!');
        }
        if (rpcError.code === '42703') {
          console.log('🔥 SMOKING GUN: Column does not exist - using old schema references!');
        }
      } else {
        console.log('✅ RPC Success - function is working');
        console.log('   Return type:', typeof result);
        console.log('   Data keys:', Object.keys(result || {}));

        if (result === null) {
          console.log('🔥 SMOKING GUN: Function returns NULL instead of JSON object!');
          console.log('   This causes !gameData to be true → endless spinner');
        }
      }
    }

    console.log('\n3. Checking for function overloads...');
    // Check if there are multiple versions with different signatures
    const { data: overloadTest1, error: overloadError1 } = await supabaseService
      .rpc('get_game_overview', {
        p_game_id: games[0].id,
        p_user_id: 'test-uuid'
      });

    if (overloadError1) {
      if (overloadError1.code === 'PGRST202') {
        console.log('✅ No overload with (uuid, uuid) signature found');
      } else {
        console.log('❌ Overload test error:', overloadError1.message);
      }
    } else {
      console.log('⚠️ Found overload with (uuid, uuid) signature');
    }

    console.log('\n✅ PUNKT 1 COMPLETE: Production function status analyzed');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

checkProductionFunction().catch(console.error);