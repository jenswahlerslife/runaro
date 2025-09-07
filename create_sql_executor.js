// First create a SQL executor function in Supabase

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

async function createSQLExecutor() {
  console.log('🔧 Creating SQL executor function...');
  
  // Since we can't execute arbitrary SQL via REST API, let's use a different approach
  // We'll create the tables one by one using INSERT operations where possible
  
  try {
    // Test if leagues table already exists
    const testResponse = await fetch(`${supabaseUrl}/rest/v1/leagues?select=id&limit=1`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Leagues table test:', testResponse.status);
    
    if (testResponse.status === 200) {
      console.log('✅ Leagues table already exists!');
      const data = await testResponse.json();
      console.log('Sample data:', data);
    } else if (testResponse.status === 400) {
      console.log('❌ Leagues table does not exist - need to create via SQL Dashboard');
      const error = await testResponse.json();
      console.log('Error:', error);
    }
    
    // Check user_activities for new columns
    const activitiesResponse = await fetch(`${supabaseUrl}/rest/v1/user_activities?select=id,route,is_base&limit=1`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('User activities columns test:', activitiesResponse.status);
    
    if (activitiesResponse.status === 200) {
      const data = await activitiesResponse.json();
      console.log('✅ user_activities has new columns!', data);
    } else {
      const error = await activitiesResponse.json();
      console.log('❌ New columns missing from user_activities:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

createSQLExecutor();