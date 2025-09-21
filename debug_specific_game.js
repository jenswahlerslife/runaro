// Debug the specific game that's failing to load
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugSpecificGame() {
  console.log('🔍 Debugging specific game that fails to load');
  console.log('============================================');

  const gameId = 'c0e85b37-1407-4118-9a01-68ee1114ba09';
  const jennerUserId = 'd589d744-d797-4323-82f6-9b7afbe2e161';

  console.log('Game ID:', gameId);
  console.log('User ID:', jennerUserId);

  try {
    // Test the exact RPC call that GameSetup is making
    console.log('\n📋 Testing get_game_overview RPC call...');
    const { data, error } = await supabase
      .rpc('get_game_overview', {
        p_game_id: gameId,
        p_user_id: jennerUserId
      });

    if (error) {
      console.error('❌ RPC call failed:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return;
    }

    console.log('✅ RPC call succeeded');
    console.log('Response data:', JSON.stringify(data, null, 2));

    // Check if the response has the expected format
    if (data && data.error) {
      console.log('❌ Response contains error:', data.error);
    } else if (data && data.meta) {
      console.log('✅ Response has correct format');
      console.log('Game status:', data.meta.status);
      console.log('Member count:', data.counts?.member_count);
      console.log('Base count:', data.counts?.base_count);
    } else {
      console.log('❌ Response format is unexpected');
    }

    // Also test without explicit user_id to see if auth context works
    console.log('\n📋 Testing RPC call without explicit user_id...');
    const { data: data2, error: error2 } = await supabase
      .rpc('get_game_overview', {
        p_game_id: gameId
      });

    if (error2) {
      console.error('❌ RPC call without user_id failed:', error2);
    } else {
      console.log('✅ RPC call without user_id succeeded');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }

  // Also check if the game actually exists
  console.log('\n💾 Verifying game exists in database...');
  try {
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError) {
      console.error('❌ Game not found:', gameError);
    } else {
      console.log('✅ Game exists:', {
        id: gameData.id,
        name: gameData.name,
        status: gameData.status,
        league_id: gameData.league_id
      });
    }
  } catch (err) {
    console.error('❌ Error checking game:', err);
  }

  // Check league membership
  console.log('\n👥 Checking league membership...');
  try {
    const { data: memberData, error: memberError } = await supabase
      .from('league_members')
      .select('*')
      .eq('user_id', jennerUserId);

    if (memberError) {
      console.error('❌ Error checking membership:', memberError);
    } else {
      console.log('✅ User memberships:', memberData);
    }
  } catch (err) {
    console.error('❌ Error checking membership:', err);
  }
}

debugSpecificGame().catch(console.error);