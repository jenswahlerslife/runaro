// Test different connection methods to Supabase

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

async function testConnection() {
  console.log('🔌 Testing Supabase connection...');
  
  try {
    // Test 1: Check if we can get user_activities table
    const response = await fetch(`${supabaseUrl}/rest/v1/user_activities?select=id&limit=1`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('✅ REST API connection works:', data);
    
    // Test 2: Try to create a simple table
    const createResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/create_table_test`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sql_query: 'SELECT version();'
      })
    });
    
    console.log('Create response:', createResponse.status, await createResponse.text());
    
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
}

testConnection();