// Debug script for testing game flow functions
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGameFlow() {
  console.log('🎮 Testing Game Flow Functions');
  console.log('================================');

  try {
    // 1. Check existing leagues and members
    console.log('\n1. Checking existing leagues...');
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, name, admin_user_id')
      .limit(3);

    if (leaguesError) throw leaguesError;
    console.log('Leagues found:', leagues?.length || 0);

    if (leagues && leagues.length > 0) {
      const testLeague = leagues[0];
      console.log('Test league:', testLeague.name, testLeague.id);

      // 2. Check league members
      console.log('\n2. Checking league members...');
      const { data: members, error: membersError } = await supabase
        .from('league_members')
        .select('user_id, status, role')
        .eq('league_id', testLeague.id);

      if (membersError) throw membersError;
      console.log('Members found:', members?.length || 0);
      console.log('Approved members:', members?.filter(m => m.status === 'approved').length || 0);

      // 3. Test create_game function
      console.log('\n3. Testing create_game function...');

      if (members && members.length >= 2) {
        const adminUser = members.find(m => m.role === 'admin' && m.status === 'approved');

        if (adminUser) {
          console.log('Testing with admin user:', adminUser.user_id);

          // Get admin's auth.uid by looking up profiles
          const { data: profile } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', adminUser.user_id)
            .single();

          if (profile) {
            console.log('Admin auth.uid:', profile.user_id);

            // Test create_game RPC
            const { data: gameResult, error: gameError } = await supabase
              .rpc('create_game', {
                p_league_id: testLeague.id,
                p_name: 'Test Game Flow Debug',
                p_duration_days: 14
              });

            if (gameError) {
              console.error('❌ create_game error:', gameError);
            } else {
              console.log('✅ create_game success:', gameResult);

              if (gameResult && gameResult.game_id) {
                // 4. Test get_game_overview
                console.log('\n4. Testing get_game_overview...');
                const { data: overview, error: overviewError } = await supabase
                  .rpc('get_game_overview', {
                    p_game_id: gameResult.game_id
                  });

                if (overviewError) {
                  console.error('❌ get_game_overview error:', overviewError);
                } else {
                  console.log('✅ get_game_overview success:', overview);
                }

                // 5. Check if game was actually created in database
                console.log('\n5. Verifying game in database...');
                const { data: gameRecord, error: recordError } = await supabase
                  .from('games')
                  .select('*')
                  .eq('id', gameResult.game_id)
                  .single();

                if (recordError) {
                  console.error('❌ Game record not found:', recordError);
                } else {
                  console.log('✅ Game record found:', {
                    id: gameRecord.id,
                    name: gameRecord.name,
                    status: gameRecord.status,
                    duration_days: gameRecord.duration_days,
                    created_at: gameRecord.created_at
                  });
                }
              }
            }
          }
        } else {
          console.log('❌ No admin user found in league members');
        }
      } else {
        console.log('❌ Not enough approved members to test game creation');
      }
    }

    // 6. Check for any existing games in setup status
    console.log('\n6. Checking existing games in setup status...');
    const { data: setupGames, error: setupError } = await supabase
      .from('games')
      .select('id, name, status, league_id, duration_days, created_at')
      .eq('status', 'setup')
      .order('created_at', { ascending: false })
      .limit(5);

    if (setupError) throw setupError;
    console.log('Setup games found:', setupGames?.length || 0);

    if (setupGames && setupGames.length > 0) {
      setupGames.forEach(game => {
        console.log(`  - ${game.name} (${game.id}) - ${game.duration_days} days`);
      });

      // Test get_game_overview on first setup game
      const testGame = setupGames[0];
      console.log(`\n7. Testing get_game_overview on existing game: ${testGame.name}`);

      const { data: testOverview, error: testOverviewError } = await supabase
        .rpc('get_game_overview', {
          p_game_id: testGame.id
        });

      if (testOverviewError) {
        console.error('❌ get_game_overview error on existing game:', testOverviewError);
      } else {
        console.log('✅ get_game_overview on existing game:', testOverview);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testGameFlow().then(() => {
  console.log('\n🏁 Game flow test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});