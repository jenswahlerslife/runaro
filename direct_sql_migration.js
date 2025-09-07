import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

console.log('🔧 DIRECT SQL MIGRATION - Adding columns to profiles table\n');

async function runDirectSQL() {
  try {
    // Method 1: Try using direct HTTP POST to PostgreSQL via Supabase
    console.log('1️⃣ Attempting direct SQL execution...');
    
    const sqlStatements = [
      'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;',
      'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;',
      'ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS profiles_age_range CHECK (age IS NULL OR (age >= 5 AND age <= 120));',
      'ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS profiles_display_name_length CHECK (display_name IS NULL OR (LENGTH(display_name) >= 2 AND LENGTH(display_name) <= 50));'
    ];

    for (const sql of sqlStatements) {
      console.log(`📡 Executing: ${sql.substring(0, 50)}...`);
      
      try {
        // Try the edge function approach
        const response = await fetch(`${SUPABASE_URL}/functions/v1/sql-execute`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: sql })
        });

        if (response.ok) {
          console.log('   ✅ Success via edge function');
        } else {
          // Try REST API rpc method
          const rpcResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
              'apikey': SUPABASE_SERVICE_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sql: sql })
          });

          if (rpcResponse.ok) {
            console.log('   ✅ Success via RPC');
          } else {
            console.log('   ⚠️ RPC method also failed, trying Supabase client...');
            
            // Try with Supabase client
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            
            // Use the rpc method with different function names
            try {
              const { data, error } = await supabase.rpc('execute_sql', { query: sql });
              if (!error) {
                console.log('   ✅ Success via Supabase RPC');
              } else {
                console.log('   ⚠️ Supabase RPC failed:', error.message);
              }
            } catch (rpcError) {
              console.log('   ⚠️ Exception in Supabase RPC:', rpcError.message);
            }
          }
        }
      } catch (sqlError) {
        console.log('   ⚠️ SQL execution error:', sqlError.message);
      }
    }

    console.log('\n2️⃣ Testing if columns were created...');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    // Test column access
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('id, username, display_name, age')
      .limit(1);

    if (testError) {
      console.log('❌ Columns still not accessible:', testError.message);
      
      console.log('\n🔧 Alternative approach: Direct database connection simulation...');
      
      // Try a more creative approach - use the existing profiles table and expand it
      try {
        console.log('3️⃣ Attempting creative column addition...');
        
        // First, let's see what columns exist
        const { data: existingData, error: existingError } = await supabase
          .from('profiles')
          .select('*')
          .limit(1);

        if (!existingError && existingData.length > 0) {
          console.log('📋 Current profile structure:', Object.keys(existingData[0]));
          
          // If display_name and age are missing, we need another approach
          if (!Object.keys(existingData[0]).includes('display_name')) {
            console.log('⚠️ display_name column missing');
            
            console.log('\n🚀 FINAL APPROACH: Creating migration script for manual execution');
            
            // Write a simple SQL file that can be copy-pasted
            const simpleMigration = `
-- SIMPLE MIGRATION - Copy and paste this into Supabase SQL Editor
-- Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql

-- Add the columns
ALTER TABLE public.profiles ADD COLUMN display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN age INTEGER;

-- Add constraints
ALTER TABLE public.profiles ADD CONSTRAINT profiles_age_range CHECK (age IS NULL OR (age >= 5 AND age <= 120));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_length CHECK (display_name IS NULL OR (LENGTH(display_name) >= 2 AND LENGTH(display_name) <= 50));

-- Test the migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('display_name', 'age');
            `;
            
            console.log('\n📄 COPY THIS SQL TO SUPABASE DASHBOARD:');
            console.log('=' .repeat(50));
            console.log(simpleMigration);
            console.log('=' .repeat(50));
            
            console.log('\n📝 STEPS:');
            console.log('1. Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql');
            console.log('2. Paste the SQL above');
            console.log('3. Click "Run"');
            console.log('4. Test signup at: https://runaro.dk/auth');
            
          } else {
            console.log('✅ display_name column exists!');
          }
        }
        
      } catch (creativeError) {
        console.error('❌ Creative approach failed:', creativeError.message);
      }
      
    } else {
      console.log('✅ SUCCESS! Columns are now accessible');
      console.log('📄 Sample data with new columns:', testData);
      
      console.log('\n🎉 MIGRATION COMPLETED!');
      console.log('🌐 Test signup now at: https://runaro.dk/auth');
    }

  } catch (error) {
    console.error('❌ Direct SQL migration failed:', error);
  }
}

runDirectSQL();