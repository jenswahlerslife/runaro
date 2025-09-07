import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTables() {
  try {
    // Check if leagues table exists
    console.log('🔍 Checking for leagues table...');
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('count', { count: 'exact', head: true });
    
    if (leaguesError) {
      console.log('❌ Leagues table error:', leaguesError.message);
    } else {
      console.log('✅ Leagues table exists');
    }

    // Check if league_members table exists
    console.log('🔍 Checking for league_members table...');
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select('count', { count: 'exact', head: true });
    
    if (membersError) {
      console.log('❌ League_members table error:', membersError.message);
    } else {
      console.log('✅ League_members table exists');
    }

    // Check if functions exist
    console.log('🔍 Checking for create_league function...');
    const { data: funcResult, error: funcError } = await supabase.rpc('create_league', {
      p_name: 'test'
    });
    
    if (funcError) {
      console.log('❌ create_league function error:', funcError.message);
    } else {
      console.log('✅ create_league function exists (test call made)');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkTables().catch(console.error);