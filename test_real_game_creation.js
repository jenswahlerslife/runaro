// Test game creation on league with actual members
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRealGameCreation() {
  console.log('🎮 Testing Game Creation on Real League');
  console.log('======================================');

  try {
    // Use the Jenner Test League which has members
    const testLeagueId = 'b66ff73f-655e-4d8f-8a52-b194f5b31169';
    const jennerUserId = 'd589d744-d797-4323-82f6-9b7afbe2e161'; // Jenner's user_id from profiles

    console.log('Target League ID:', testLeagueId);
    console.log('Jenner User ID:', jennerUserId);

    // 1. Verify league and members
    console.log('\n1. Verifying league details...');
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', testLeagueId)
      .single();

    if (leagueError) throw leagueError;
    console.log('League:', league.name);
    console.log('Admin User ID:', league.admin_user_id);

    // 2. Check members in this league
    console.log('\n2. Checking members in this league...');
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select('*')
      .eq('league_id', testLeagueId);

    if (membersError) throw membersError;
    console.log('Members found:', members?.length || 0);

    if (members && members.length > 0) {
      members.forEach(member => {
        console.log(`  - User: ${member.user_id}, Status: ${member.status}, Role: ${member.role}`);
      });

      const approvedMembers = members.filter(m => m.status === 'approved');
      console.log('Approved members:', approvedMembers.length);

      // 3. Test create_game with admin privileges
      if (approvedMembers.length >= 2) {
        console.log('\n3. Testing create_game as admin...');

        // Create game using RPC
        const { data: gameResult, error: gameError } = await supabase
          .rpc('create_game', {
            p_league_id: testLeagueId,
            p_name: `Real Test Game ${Date.now()}`,
            p_duration_days: 14
          });

        if (gameError) {
          console.error('❌ create_game error:', gameError);
        } else {
          console.log('✅ create_game success:', gameResult);

          if (gameResult && gameResult.game_id) {
            const gameId = gameResult.game_id;

            // 4. Verify game was created in database
            console.log('\n4. Verifying game in database...');
            const { data: gameRecord, error: recordError } = await supabase
              .from('games')
              .select('*')
              .eq('id', gameId)
              .single();

            if (recordError) {
              console.error('❌ Game record error:', recordError);
            } else {
              console.log('✅ Game record verified:', {
                id: gameRecord.id,
                name: gameRecord.name,
                status: gameRecord.status,
                duration_days: gameRecord.duration_days,
                league_id: gameRecord.league_id,
                created_by: gameRecord.created_by,
                start_date: gameRecord.start_date
              });

              // 5. Test get_game_overview with proper authentication
              console.log('\n5. Testing get_game_overview with auth...');

              // First test without auth (should fail)
              const { data: noAuthOverview, error: noAuthError } = await supabase
                .rpc('get_game_overview', {
                  p_game_id: gameId
                });

              console.log('Without auth - Error:', noAuthError?.message || 'No error');
              console.log('Without auth - Data:', noAuthOverview);

              // Now test with proper auth simulation
              // We need to simulate being authenticated as one of the league members
              console.log('\n6. Testing with simulated user context...');

              // Check if there's a way to test this - we might need frontend for proper auth
              console.log('Note: get_game_overview requires proper Supabase auth context');
              console.log('This would need to be tested through the frontend or with auth.uid() set');

              // 7. Clean up - delete the test game
              console.log('\n7. Cleaning up test game...');
              const { error: deleteError } = await supabase
                .from('games')
                .delete()
                .eq('id', gameId);

              if (deleteError) {
                console.log('Warning: Could not delete test game:', deleteError.message);
              } else {
                console.log('✅ Test game cleaned up');
              }
            }
          }
        }
      } else {
        console.log('❌ Not enough approved members for game creation');
      }
    } else {
      console.log('❌ No members found in this league');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testRealGameCreation().then(() => {
  console.log('\n🏁 Real game creation test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});