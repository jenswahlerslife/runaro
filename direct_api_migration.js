// Direct API approach to add age column
const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

console.log('🔧 DIRECT API MIGRATION - Adding age column\n');

async function executeDirectSQL() {
  const sqlCommands = [
    'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;',
    'ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS profiles_age_range CHECK (age IS NULL OR (age >= 5 AND age <= 120));'
  ];

  for (const sql of sqlCommands) {
    console.log(`📡 Executing: ${sql}`);
    
    try {
      // Try direct PostgreSQL REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
          'Content-Type': 'application/json',
          'Content-Profile': 'public'
        },
        body: JSON.stringify({
          query: sql
        })
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response:', responseText.substring(0, 200));

    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }

  // Test the result
  console.log('\n🧪 Testing result...');
  try {
    const testResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,username,display_name,age&limit=1`, {
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      }
    });

    if (testResponse.ok) {
      const data = await testResponse.json();
      console.log('✅ Test successful, columns exist');
      console.log('📄 Sample data:', data);
    } else {
      console.log('❌ Test failed, age column still missing');
    }
  } catch (testError) {
    console.log('❌ Test error:', testError.message);
  }
}

executeDirectSQL();