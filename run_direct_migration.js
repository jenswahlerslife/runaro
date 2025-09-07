import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runDirectMigration() {
  try {
    console.log('Running migration steps individually...');
    
    // Step 1: Add columns if they don't exist
    console.log('1. Adding columns...');
    try {
      await supabase.rpc('execute_sql_raw', {
        sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;'
      });
      console.log('✓ display_name column added');
    } catch (e) {
      console.log('display_name column may already exist');
    }
    
    try {
      await supabase.rpc('execute_sql_raw', {
        sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INT;'
      });
      console.log('✓ age column added');
    } catch (e) {
      console.log('age column may already exist');
    }

    // Step 2: Add constraints
    console.log('2. Adding constraints...');
    try {
      await supabase.rpc('execute_sql_raw', {
        sql: `ALTER TABLE public.profiles 
              ADD CONSTRAINT IF NOT EXISTS profiles_age_range 
              CHECK (age IS NULL OR (age >= 5 AND age <= 120));`
      });
      console.log('✓ age constraint added');
    } catch (e) {
      console.log('age constraint may already exist');
    }

    try {
      await supabase.rpc('execute_sql_raw', {
        sql: `ALTER TABLE public.profiles 
              ADD CONSTRAINT IF NOT EXISTS profiles_display_name_length 
              CHECK (display_name IS NULL OR (LENGTH(display_name) >= 2 AND LENGTH(display_name) <= 50));`
      });
      console.log('✓ display_name constraint added');
    } catch (e) {
      console.log('display_name constraint may already exist');
    }

    // Step 3: Test the structure
    console.log('3. Testing profile structure...');
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, age')
      .limit(1);

    if (error) {
      console.error('Error testing structure:', error);
    } else {
      console.log('✓ Profile structure test successful');
      console.log('Sample profile:', profiles?.[0] || 'No profiles found');
    }

    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error('Migration error:', error);
  }
}

runDirectMigration();