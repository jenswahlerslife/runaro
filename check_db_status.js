// Direct SQL execution using Supabase client with service role key
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

console.log('🎮 CHECKING LEAGUES SYSTEM STATUS');
console.log('==================================');

async function checkDatabaseStatus() {
  // Check if leagues table exists by trying to read from it
  console.log('🔍 Checking if leagues table exists...');
  
  const { data: existingLeagues, error: leaguesError } = await supabase
    .from('leagues')
    .select('id')
    .limit(1);
    
  if (leaguesError && leaguesError.code === 'PGRST116') {
    console.log('❌ Leagues table does not exist');
    console.log('');
    console.log('🎯 MANUAL SETUP REQUIRED:');
    console.log('================================');
    console.log('1. Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql/new');
    console.log('2. Copy and paste the SQL from: MANUAL_FIX_SQL.sql');
    console.log('3. Click "Run" to execute the SQL');
    console.log('4. Your leagues page should then work!');
    console.log('');
    console.log('🔥 CRITICAL: The database schema is missing - this needs to be fixed in Supabase SQL Editor');
    console.log('📄 The SQL file "MANUAL_FIX_SQL.sql" contains everything needed');
    
    return false;
  } else if (leaguesError) {
    console.log('⚠️  Error checking leagues table:', leaguesError.message);
    return false;
  } else {
    console.log('✅ Leagues table exists!');
    
    // Check if functions exist by trying to use them
    console.log('🔍 Testing create_league function...');
    const { data: functionTest, error: functionError } = await supabase
      .rpc('create_league', { p_name: 'test_league' });
      
    if (functionError && functionError.message.includes('Could not find the function')) {
      console.log('❌ League functions do not exist');
      console.log('');
      console.log('🎯 PARTIAL SETUP REQUIRED:');
      console.log('================================');
      console.log('1. Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql/new');
      console.log('2. Copy and paste ONLY the function creation SQL from: MANUAL_FIX_SQL.sql');
      console.log('3. Look for the CREATE OR REPLACE FUNCTION sections');
      console.log('4. Run those functions to complete the setup');
      
      return false;
    } else if (functionError && functionError.message.includes('User profile not found')) {
      console.log('✅ League functions exist! (Expected "User profile not found" error)');
      console.log('🎉 DATABASE SETUP IS COMPLETE!');
      console.log('');
      console.log('🚀 Your leagues page should now work!');
      console.log('   Try: http://localhost:8081 -> Click "Start"');
      
      return true;
    } else if (functionError) {
      console.log('⚠️  Function test result:', functionError.message);
    } else {
      console.log('✅ League functions working perfectly!');
      return true;
    }
  }
  
  return false;
}

checkDatabaseStatus().then(success => {
  if (success) {
    console.log('');
    console.log('🎊 SUCCESS! Your leagues system is ready!');
  } else {
    console.log('');
    console.log('🔧 Manual setup required - see instructions above');
  }
}).catch(error => {
  console.error('❌ Error:', error.message);
});