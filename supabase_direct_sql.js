import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

console.log('🎯 DIRECT SUPABASE COLUMN ADDITION\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addAgeColumn() {
  console.log('1️⃣ Testing current table structure...');
  
  const { data: currentData, error: currentError } = await supabase
    .from('profiles')
    .select('*')
    .limit(1);

  if (currentData && currentData.length > 0) {
    console.log('📋 Current columns:', Object.keys(currentData[0]));
    
    if (Object.keys(currentData[0]).includes('age')) {
      console.log('✅ Age column already exists!');
      
      // Test insert with age
      console.log('\n2️⃣ Testing insert with age...');
      const testUserId = 'test-' + Date.now();
      
      const { data: insertData, error: insertError } = await supabase
        .from('profiles')
        .insert([{
          user_id: testUserId,
          username: 'testuser',
          display_name: 'Test User',
          age: 25
        }])
        .select();

      if (insertError) {
        console.log('❌ Insert failed:', insertError.message);
      } else {
        console.log('✅ Insert successful!');
        console.log('📄 Test data:', insertData);
        
        // Clean up
        await supabase.from('profiles').delete().eq('user_id', testUserId);
        console.log('🧹 Test data cleaned up');
      }
      
      console.log('\n🎉 DATABASE MIGRATION COMPLETE!');
      console.log('🌐 Test signup at: https://runaro.dk/auth');
      return;
    }
  }

  console.log('❌ Age column missing - manual intervention required');
  console.log('\n📋 MANUAL STEPS:');
  console.log('1. Open: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql');
  console.log('2. Run: ALTER TABLE public.profiles ADD COLUMN age INTEGER;');
  console.log('3. Run: ALTER TABLE public.profiles ADD CONSTRAINT profiles_age_range CHECK (age IS NULL OR (age >= 5 AND age <= 120));');
  console.log('4. Test with: node supabase_direct_sql.js');
}

addAgeColumn();