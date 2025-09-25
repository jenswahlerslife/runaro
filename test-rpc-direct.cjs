// Direct test of RPC without auth check
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env.local'});

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testDirectRPC() {
  console.log('🎯 Testing RPC directly with jennertester league...\n');

  try {
    // Test with jennertester league ID
    const { data, error } = await supabase
      .rpc('get_active_game_for_league', {
        p_league_id: 'a921483a-35fb-4303-8cad-283f536e9d0e'
      });

    console.log('RPC Result:', { data, error });

    // Also test by creating a temporary version without auth check
    const { data: rawData, error: rawError } = await supabase
      .from('games')
      .select('id, name, status, league_id')
      .eq('league_id', 'a921483a-35fb-4303-8cad-283f536e9d0e')
      .in('status', ['active', 'setup'])
      .order('created_at', { ascending: false })
      .limit(1);

    console.log('Direct games query:', { rawData, rawError });

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

testDirectRPC();