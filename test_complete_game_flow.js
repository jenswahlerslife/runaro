// Complete end-to-end test of the game creation flow
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testCompleteGameFlow() {
  console.log('🎯 Testing Complete Game Creation Flow');
  console.log('=====================================');

  try {
    // Test data
    const testLeagueId = 'b66ff73f-655e-4d8f-8a52-b194f5b31169'; // Jenner Test League
    const jennerUserId = 'd589d744-d797-4323-82f6-9b7afbe2e161'; // Jenner's user_id

    console.log('Test League ID:', testLeagueId);
    console.log('Jenner User ID:', jennerUserId);

    // Step 1: Create a game (simulating GameManagement.tsx createGame)
    console.log('\n📋 Step 1: Create Game (GameManagement.tsx flow)');
    console.log('=================================================');

    const gameCreationResult = await supabase
      .rpc('create_game', {
        p_league_id: testLeagueId,
        p_name: `E2E Test Game ${Date.now()}`,
        p_duration_days: 14,
        p_user_id: jennerUserId
      });

    if (gameCreationResult.error) {
      console.error('❌ Game creation failed:', gameCreationResult.error);
      return;
    }

    const gameResult = gameCreationResult.data;
    console.log('✅ Game creation RPC result:', gameResult);

    if (!gameResult.success) {
      console.error('❌ Game creation unsuccessful:', gameResult.error);
      return;
    }

    const gameId = gameResult.game_id;
    console.log('🎮 Created game ID:', gameId);

    // Step 2: Load game overview (simulating GameSetup.tsx initial load)
    console.log('\n🎯 Step 2: Load Game Overview (GameSetup.tsx flow)');
    console.log('===================================================');

    const overviewResult = await supabase
      .rpc('get_game_overview', {
        p_game_id: gameId,
        p_user_id: jennerUserId
      });

    if (overviewResult.error) {
      console.error('❌ Game overview failed:', overviewResult.error);
      return;
    }

    const overview = overviewResult.data;
    console.log('✅ Game overview result:', overview);

    if (overview.error) {
      console.error('❌ Game overview error:', overview.error);
      return;
    }

    // Validate the overview format matches frontend expectations
    const expectedFormat = {
      hasMetadata: overview.meta && typeof overview.meta === 'object',
      hasId: overview.meta.id === gameId,
      hasStatus: overview.meta.status === 'setup',
      hasDurationDays: typeof overview.meta.duration_days === 'number',
      hasCounts: overview.counts && typeof overview.counts === 'object',
      hasMemberCount: typeof overview.counts.member_count === 'number',
      hasBaseCount: typeof overview.counts.base_count === 'number',
      hasLeaderboard: Array.isArray(overview.leaderboard)
    };

    console.log('📋 Format validation:', expectedFormat);

    const allFormatValid = Object.values(expectedFormat).every(Boolean);
    if (allFormatValid) {
      console.log('✅ Game overview format is valid for frontend');
    } else {
      console.log('❌ Game overview format has issues');
    }

    // Step 3: Check game state in database
    console.log('\n💾 Step 3: Verify Game in Database');
    console.log('==================================');

    const { data: gameRecord, error: gameRecordError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameRecordError) {
      console.error('❌ Database query failed:', gameRecordError);
      return;
    }

    console.log('✅ Game record in database:', {
      id: gameRecord.id,
      name: gameRecord.name,
      status: gameRecord.status,
      duration_days: gameRecord.duration_days,
      league_id: gameRecord.league_id,
      created_by: gameRecord.created_by,
      start_date: gameRecord.start_date
    });

    // Step 4: Test navigation scenarios
    console.log('\n🧭 Step 4: Test Navigation Logic');
    console.log('=================================');

    // Simulate GameSetup.tsx status checks
    const gameStatus = overview.meta.status;
    console.log('Game status:', gameStatus);

    if (gameStatus === 'setup') {
      console.log('✅ Game is in setup status - GameSetup.tsx should render normally');
    } else if (gameStatus === 'active' || gameStatus === 'finished') {
      console.log('✅ Game is active/finished - should redirect to /games/' + gameId);
    } else {
      console.log('❌ Unexpected game status:', gameStatus);
    }

    // Step 5: Test league membership verification
    console.log('\n👥 Step 5: Test League Membership Access');
    console.log('========================================');

    // Test that the admin can access the game
    console.log('Testing admin access...');
    const adminAccessResult = await supabase
      .rpc('get_game_overview', {
        p_game_id: gameId,
        p_user_id: jennerUserId
      });

    if (adminAccessResult.data && !adminAccessResult.data.error) {
      console.log('✅ Admin can access game');
    } else {
      console.log('❌ Admin access denied:', adminAccessResult.data?.error);
    }

    // Test that a non-member cannot access the game
    console.log('Testing non-member access...');
    const nonMemberUserId = '7103eb48-d8be-4969-a17a-f9d63972e513'; // Sigurd
    const nonMemberAccessResult = await supabase
      .rpc('get_game_overview', {
        p_game_id: gameId,
        p_user_id: nonMemberUserId
      });

    if (nonMemberAccessResult.data && nonMemberAccessResult.data.error) {
      console.log('✅ Non-member access correctly denied:', nonMemberAccessResult.data.error);
    } else {
      console.log('❌ Non-member access should be denied but was allowed');
    }

    // Step 6: Test game creation constraints
    console.log('\n🔒 Step 6: Test Game Creation Constraints');
    console.log('=========================================');

    // Test that non-admin cannot create games
    const nonAdminCreateResult = await supabase
      .rpc('create_game', {
        p_league_id: testLeagueId,
        p_name: 'Unauthorized Game',
        p_duration_days: 14,
        p_user_id: nonMemberUserId
      });

    if (nonAdminCreateResult.data && !nonAdminCreateResult.data.success) {
      console.log('✅ Non-admin game creation correctly denied:', nonAdminCreateResult.data.error);
    } else {
      console.log('❌ Non-admin should not be able to create games');
    }

    // Step 7: Cleanup
    console.log('\n🧹 Step 7: Cleanup Test Data');
    console.log('=============================');

    const { error: deleteError } = await supabase
      .from('games')
      .delete()
      .eq('id', gameId);

    if (deleteError) {
      console.log('⚠️  Could not delete test game:', deleteError.message);
      console.log('   Manual cleanup required for game ID:', gameId);
    } else {
      console.log('✅ Test game cleaned up successfully');
    }

    // Step 8: Summary
    console.log('\n📊 Step 8: Test Summary');
    console.log('=======================');

    const testResults = {
      gameCreation: gameResult.success,
      gameOverview: !overview.error,
      formatValidation: allFormatValid,
      databaseRecord: !!gameRecord,
      adminAccess: !adminAccessResult.data?.error,
      accessControl: !!nonMemberAccessResult.data?.error,
      authorizationControl: !nonAdminCreateResult.data?.success
    };

    console.log('Test Results:', testResults);

    const allTestsPassed = Object.values(testResults).every(Boolean);
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED - Game flow is working correctly!');
    } else {
      console.log('❌ Some tests failed - see details above');
    }

    return allTestsPassed;

  } catch (error) {
    console.error('❌ Unexpected error during testing:', error);
    return false;
  }
}

// Run the complete test
testCompleteGameFlow().then((success) => {
  if (success) {
    console.log('\n🎉 Complete game flow test SUCCESSFUL');
    process.exit(0);
  } else {
    console.log('\n💥 Complete game flow test FAILED');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Test execution failed:', error);
  process.exit(1);
});