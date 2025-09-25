// Test setup game visibility in RPC function
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testSetupGameVisibility() {
  console.log('🎯 Testing setup game visibility...\n');

  try {
    // First get leagues to test with, including jennertester
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, name')
      .or('name.eq.jennertester,name.eq.Jens,name.eq.Runner');

    if (leaguesError) {
      console.error('❌ Error fetching leagues:', leaguesError);
      return;
    }

    console.log(`📋 Found ${leagues.length} leagues to test:`);
    leagues.forEach(league => console.log(`  - ${league.name} (${league.id})`));
    console.log();

    // Test RPC for each league
    for (const league of leagues) {
      console.log(`🔍 Testing league: ${league.name}`);

      const { data: activeGame, error } = await supabase
        .rpc('get_active_game_for_league', { p_league_id: league.id });

      if (error) {
        console.error(`❌ RPC Error for league ${league.name}:`, error);
        continue;
      }

      if (activeGame && activeGame.length > 0) {
        const game = activeGame[0];
        console.log(`✅ Found active/setup game in ${league.name}:`);
        console.log(`   - Name: ${game.name}`);
        console.log(`   - Status: ${game.status}`);
        console.log(`   - ID: ${game.id}`);

        if (game.status === 'setup') {
          console.log(`🎯 PERFECT! Setup game found - UI should show "Start Game" button!`);
        } else if (game.status === 'active') {
          console.log(`⚡ Active game found - UI should show "Gå til spillet" button`);
        }
      } else {
        console.log(`📭 No active/setup games in ${league.name}`);
      }
      console.log();
    }

    // Also check if there are any setup games in the database
    const { data: setupGames, error: setupError } = await supabase
      .from('games')
      .select('id, name, status, league_id, leagues(name)')
      .eq('status', 'setup');

    if (setupError) {
      console.error('❌ Error fetching setup games:', setupError);
      return;
    }

    console.log(`🎮 Setup games in database: ${setupGames.length}`);
    setupGames.forEach(game => {
      console.log(`  - ${game.name} in ${game.leagues?.name} (${game.status})`);
    });

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

testSetupGameVisibility();