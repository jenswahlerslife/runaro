import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addColumnsDirect() {
  console.log('🔧 Adding columns directly to profiles table...\n');
  
  try {
    // First check current table structure
    console.log('🔍 Checking current table structure...');
    const { data: currentColumns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'profiles')
      .eq('table_schema', 'public');

    if (columnError) {
      console.error('❌ Error checking columns:', columnError);
      return;
    }

    console.log('📋 Current columns:', currentColumns.map(c => `${c.column_name}: ${c.data_type}`));
    
    const hasDisplayName = currentColumns.some(c => c.column_name === 'display_name');
    const hasAge = currentColumns.some(c => c.column_name === 'age');
    
    console.log(`\n📊 Column status:`);
    console.log(`   display_name: ${hasDisplayName ? '✅ exists' : '❌ missing'}`);
    console.log(`   age: ${hasAge ? '✅ exists' : '❌ missing'}\n`);

    // Add missing columns one by one using direct SQL
    if (!hasDisplayName) {
      console.log('➕ Adding display_name column...');
      try {
        const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY
          },
          body: JSON.stringify({
            sql: 'ALTER TABLE public.profiles ADD COLUMN display_name TEXT;'
          })
        });
        
        if (result.ok) {
          console.log('✅ display_name column added');
        } else {
          const error = await result.text();
          console.log('⚠️ display_name column might already exist:', error);
        }
      } catch (e) {
        console.log('⚠️ Error adding display_name:', e.message);
      }
    }

    if (!hasAge) {
      console.log('➕ Adding age column...');
      try {
        const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY
          },
          body: JSON.stringify({
            sql: 'ALTER TABLE public.profiles ADD COLUMN age INTEGER;'
          })
        });
        
        if (result.ok) {
          console.log('✅ age column added');
        } else {
          const error = await result.text();
          console.log('⚠️ age column might already exist:', error);
        }
      } catch (e) {
        console.log('⚠️ Error adding age:', e.message);
      }
    }

    // Verify columns were added
    console.log('\n🔍 Verifying columns after addition...');
    const { data: newColumns, error: newColumnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'profiles')
      .eq('table_schema', 'public');

    if (!newColumnError) {
      console.log('📋 Updated columns:', newColumns.map(c => `${c.column_name}: ${c.data_type}`));
      
      const nowHasDisplayName = newColumns.some(c => c.column_name === 'display_name');
      const nowHasAge = newColumns.some(c => c.column_name === 'age');
      
      console.log(`\n📊 Final column status:`);
      console.log(`   display_name: ${nowHasDisplayName ? '✅ exists' : '❌ missing'}`);
      console.log(`   age: ${nowHasAge ? '✅ exists' : '❌ missing'}`);
      
      if (nowHasDisplayName && nowHasAge) {
        console.log('\n🎉 All columns successfully added!');
        
        // Test with actual data
        console.log('\n🧪 Testing profile access...');
        const { data: testProfiles, error: testError } = await supabase
          .from('profiles')
          .select('id, username, display_name, age')
          .limit(1);

        if (testError) {
          console.error('❌ Profile access test failed:', testError);
        } else {
          console.log('✅ Profile access test successful!');
          console.log('📄 Sample data:', testProfiles);
        }
      }
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

addColumnsDirect();