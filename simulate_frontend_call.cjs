const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Create client EXACTLY as frontend does
const frontendClient = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',  // VITE_SUPABASE_URL
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA' // VITE_SUPABASE_PUBLISHABLE_KEY
);

async function simulateFrontendCall() {
  console.log('🔍 PUNKT 2: Simulér præcis frontend Network tab kald...\n');

  try {
    // Use a known game ID from testing
    const gameId = 'd7602b70-05e7-472f-b46d-6a4d45c4bb50';

    console.log('1. Simulating frontend RPC call...');
    console.log(`   URL: POST https://ojjpslrhyutizwpvvngu.supabase.co/rest/v1/rpc/get_game_overview`);
    console.log(`   Payload: {"p_game_id":"${gameId}"}`);
    console.log('   Headers: anon key, no authentication');

    // This is EXACTLY what src/lib/gamesApi.ts:13 does
    const { data, error } = await frontendClient.rpc('get_game_overview', {
      p_game_id: gameId
    });

    console.log('\n2. Frontend call result:');

    if (error) {
      console.error('❌ Frontend Error:', error);
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);

      if (error.code === '42501') {
        console.log('🔥 SMOKING GUN: Permission denied for anon/unauthenticated users!');
        console.log('   This means function requires authentication but frontend calls without it');
      }

      if (error.code === '42703') {
        console.log('🔥 SMOKING GUN: Column does not exist - old function is active!');
      }

      if (error.message && error.message.includes('lm.approved')) {
        console.log('🔥 SMOKING GUN: Frontend is hitting old function with lm.approved!');
      }

    } else {
      console.log('✅ Frontend Success');
      console.log('   Data type:', typeof data);
      console.log('   Data keys:', Object.keys(data || {}));

      if (data === null) {
        console.log('🔥 SMOKING GUN: Frontend gets data=null without error!');
        console.log('   This is why !gameData stays true → endless spinner');
      } else {
        console.log('   Meta status:', data?.meta?.status);
        console.log('   Counts:', data?.counts);
      }
    }

    // Test what happens in GameSetup.tsx logic
    console.log('\n3. GameSetup.tsx logic simulation:');

    if (error) {
      console.log('   rpcGetGameOverview throws error → catch block');
      console.log('   GameSetup shows error state');
    } else {
      console.log('   rpcGetGameOverview returns data:', data ? 'object' : 'null');

      if (data) {
        console.log('   setGameData(overview) → gameData is set');
        console.log('   if (loading || !gameData) → FALSE');
        console.log('   ✅ Shows Game Setup interface');
      } else {
        console.log('   setGameData(null) → gameData stays null');
        console.log('   if (loading || !gameData) → TRUE');
        console.log('   🔥 ENDLESS SPINNER!');
      }
    }

    console.log('\n✅ PUNKT 2 COMPLETE: Frontend call simulated');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

simulateFrontendCall().catch(console.error);