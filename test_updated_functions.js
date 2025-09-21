// Test the updated create_game and get_game_overview functions
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpdatedFunctions() {
  console.log('🧪 Testing Updated Game Functions');
  console.log('=================================');

  try {
    // Test data from our previous analysis
    const testLeagueId = 'b66ff73f-655e-4d8f-8a52-b194f5b31169'; // Jenner Test League
    const jennerUserId = 'd589d744-d797-4323-82f6-9b7afbe2e161'; // Jenner's user_id
    const jennerProfileId = 'f44e88c1-0a70-4d40-89e8-51462e42f958'; // Jenner's profile_id

    console.log('Test League ID:', testLeagueId);
    console.log('Jenner User ID:', jennerUserId);
    console.log('Jenner Profile ID:', jennerProfileId);

    // 1. Test new create_game function with explicit user_id
    console.log('\n1. Testing create_game with explicit user_id...');

    const { data: gameResult, error: gameError } = await supabase
      .rpc('create_game', {
        p_league_id: testLeagueId,
        p_name: `Function Test Game ${Date.now()}`,
        p_duration_days: 14,
        p_user_id: jennerUserId  // Explicit user ID
      });

    if (gameError) {
      console.error('❌ create_game error:', gameError);
    } else {
      console.log('✅ create_game success:', gameResult);

      if (gameResult && gameResult.success && gameResult.game_id) {
        const gameId = gameResult.game_id;

        // 2. Test new get_game_overview function with explicit user_id
        console.log('\n2. Testing get_game_overview with explicit user_id...');

        const { data: overviewResult, error: overviewError } = await supabase
          .rpc('get_game_overview', {
            p_game_id: gameId,
            p_user_id: jennerUserId  // Explicit user ID
          });

        if (overviewError) {
          console.error('❌ get_game_overview error:', overviewError);
        } else {
          console.log('✅ get_game_overview success:', overviewResult);

          // Verify the response format matches frontend expectations
          if (overviewResult && !overviewResult.error) {
            console.log('\n3. Verifying response format...');
            console.log('Meta:', overviewResult.meta);
            console.log('Counts:', overviewResult.counts);
            console.log('Leaderboard:', overviewResult.leaderboard);

            // Check if format matches gamesApi.ts expectations
            const hasCorrectFormat =
              overviewResult.meta &&
              overviewResult.counts &&
              overviewResult.leaderboard &&
              overviewResult.meta.id === gameId &&
              overviewResult.meta.status === 'setup' &&
              typeof overviewResult.counts.member_count === 'number' &&
              typeof overviewResult.counts.base_count === 'number' &&
              Array.isArray(overviewResult.leaderboard);

            if (hasCorrectFormat) {
              console.log('✅ Response format matches frontend expectations');
            } else {
              console.log('❌ Response format does not match frontend expectations');
            }
          }
        }

        // 3. Test game without explicit user_id (should use auth.uid())
        console.log('\n4. Testing get_game_overview without explicit user_id...');

        const { data: noUserOverview, error: noUserError } = await supabase
          .rpc('get_game_overview', {
            p_game_id: gameId
            // No p_user_id parameter - should use auth.uid()
          });

        if (noUserError) {
          console.log('Expected: get_game_overview without auth context failed:', noUserError.message);
        } else {
          console.log('Unexpected: get_game_overview worked without auth context:', noUserOverview);
        }

        // 4. Verify game was created in database
        console.log('\n5. Verifying game in database...');
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
            created_by: gameRecord.created_by
          });
        }

        // 5. Test that non-member cannot access game
        console.log('\n6. Testing access control with non-member...');

        // Use a different user ID that's not a member of the league
        const nonMemberUserId = '7103eb48-d8be-4969-a17a-f9d63972e513'; // Sigurd's user_id

        const { data: unauthorizedOverview, error: unauthorizedError } = await supabase
          .rpc('get_game_overview', {
            p_game_id: gameId,
            p_user_id: nonMemberUserId
          });

        if (unauthorizedError || (unauthorizedOverview && unauthorizedOverview.error)) {
          console.log('✅ Access control working - non-member denied:',
            unauthorizedError?.message || unauthorizedOverview?.error);
        } else {
          console.log('❌ Access control failed - non-member got access:', unauthorizedOverview);
        }

        // 6. Clean up - delete the test game
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

      } else {
        console.log('❌ create_game did not return game_id');
      }
    }

    // 7. Test admin auto-membership trigger for new leagues
    console.log('\n8. Testing admin auto-membership trigger...');

    // This would need to create a new league to test the trigger
    // For now, just verify existing admin memberships
    const { data: adminMemberships, error: membershipError } = await supabase
      .from('league_members')
      .select('*')
      .eq('league_id', testLeagueId)
      .eq('user_id', jennerProfileId);

    if (membershipError) {
      console.error('❌ Membership check error:', membershipError);
    } else {
      console.log('Admin memberships found:', adminMemberships?.length || 0);
      if (adminMemberships && adminMemberships.length > 0) {
        console.log('✅ Admin is member of their league');
      } else {
        console.log('❌ Admin is not a member of their league - trigger may need fixing');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the test
testUpdatedFunctions().then(() => {
  console.log('\n🏁 Function testing completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});