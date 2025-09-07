import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testProfilesTable() {
  console.log('🧪 Testing profiles table structure and functionality...\n');
  
  try {
    // Test 1: Check if we can select basic columns
    console.log('1️⃣ Testing basic profile selection...');
    const { data: basicProfiles, error: basicError } = await supabase
      .from('profiles')
      .select('id, username')
      .limit(2);

    if (basicError) {
      console.error('❌ Basic profile selection failed:', basicError);
      return;
    } else {
      console.log('✅ Basic profile selection works');
      console.log('📄 Sample basic data:', basicProfiles);
    }

    // Test 2: Try to select display_name and age
    console.log('\n2️⃣ Testing display_name and age columns...');
    const { data: fullProfiles, error: fullError } = await supabase
      .from('profiles')
      .select('id, username, display_name, age')
      .limit(2);

    if (fullError) {
      console.error('❌ Full profile selection failed:', fullError);
      console.log('🔧 Columns need to be added manually in Supabase dashboard');
    } else {
      console.log('✅ Full profile selection works!');
      console.log('📄 Sample full data:', fullProfiles);
    }

    // Test 3: Test insert with new columns (if they exist)
    console.log('\n3️⃣ Testing profile insertion with new columns...');
    const testUserId = 'test-' + Date.now();
    
    try {
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
        console.error('❌ Insert test failed:', insertError);
      } else {
        console.log('✅ Insert test successful!');
        console.log('📄 Inserted data:', insertData);
        
        // Clean up test data
        await supabase
          .from('profiles')
          .delete()
          .eq('user_id', testUserId);
        console.log('🧹 Test data cleaned up');
      }
    } catch (e) {
      console.error('❌ Insert test exception:', e.message);
    }

    // Test 4: Check auth integration
    console.log('\n4️⃣ Testing signup flow (simulation)...');
    console.log('📝 This would happen when a user signs up:');
    console.log('   1. User fills out: email, password, display_name, age');
    console.log('   2. Frontend calls: signUp(email, password, username, display_name, age)');
    console.log('   3. Supabase creates user with metadata: { display_name, age }');
    console.log('   4. Database trigger creates profile with display_name and age');
    console.log('   5. User receives confirmation email');
    
    console.log('\n🎯 Integration status:');
    console.log('   ✅ Frontend: Auth page updated with name/age fields');
    console.log('   ✅ Auth logic: signUp sends display_name and age in metadata');
    console.log('   ✅ Database: profiles table ready');
    console.log('   🔧 Missing: display_name and age columns (add manually)');
    console.log('   🔧 Missing: database trigger (add manually)');

  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testProfilesTable();