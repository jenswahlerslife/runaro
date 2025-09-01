// Test Supabase connection and run debug queries
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testConnection() {
  try {
    console.log('🔄 Testing Supabase connection...');
    
    // Test 1: Check if user_activities table exists
    console.log('\n📊 Test 1: Checking user_activities table...');
    const { data: tableData, error: tableError } = await supabase
      .from('user_activities')
      .select('count', { count: 'exact', head: true });
    
    if (tableError) {
      console.error('❌ Table error:', tableError.message);
    } else {
      console.log('✅ user_activities table exists, total rows:', tableData);
    }
    
    // Test 2: Check table structure
    console.log('\n📊 Test 2: Checking table structure...');
    const { data: structureData, error: structureError } = await supabase
      .from('user_activities')
      .select('*')
      .limit(1);
    
    if (structureError) {
      console.error('❌ Structure error:', structureError.message);
    } else {
      console.log('✅ Table structure:', structureData && structureData.length > 0 ? Object.keys(structureData[0]) : 'No data');
    }
    
    // Test 3: Try to get all activities (without user filter)
    console.log('\n📊 Test 3: Getting all activities...');
    const { data: allData, error: allError } = await supabase
      .from('user_activities')
      .select('id, user_id, name, distance, moving_time, strava_activity_id')
      .limit(10);
    
    if (allError) {
      console.error('❌ All activities error:', allError.message);
    } else {
      console.log('✅ Found activities:', allData?.length || 0);
      if (allData && allData.length > 0) {
        console.log('📋 Sample activity:', allData[0]);
      }
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }
}

testConnection()
  .then((success) => {
    console.log(success ? '\n🎉 Connection test completed!' : '\n❌ Connection test failed!');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });