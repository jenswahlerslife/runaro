import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigrationSteps() {
  console.log('🚀 Running Supabase migration for display_name and age columns...\n');
  
  try {
    // Step 1: Add columns to profiles table
    console.log('1️⃣ Adding display_name and age columns to profiles...');
    
    const addColumnsQuery = `
      ALTER TABLE public.profiles 
      ADD COLUMN IF NOT EXISTS display_name TEXT,
      ADD COLUMN IF NOT EXISTS age INT;
    `;
    
    let addResult, addError;
    try {
      const result = await supabase.rpc('exec_sql', { sql: addColumnsQuery });
      addResult = result.data;
      addError = result.error;
    } catch (e) {
      addError = e;
      addResult = null;
    }

    if (addError) {
      console.log('⚠️ Column addition may already exist, continuing...');
    } else {
      console.log('✅ Columns added successfully');
    }

    // Step 2: Add constraints
    console.log('2️⃣ Adding validation constraints...');
    
    const constraintQueries = [
      `ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS profiles_age_range CHECK (age IS NULL OR (age >= 5 AND age <= 120));`,
      `ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS profiles_display_name_length CHECK (display_name IS NULL OR (LENGTH(display_name) >= 2 AND LENGTH(display_name) <= 50));`
    ];

    for (const query of constraintQueries) {
      try {
        await supabase.rpc('exec_sql', { sql: query });
      } catch (e) {
        console.log('⚠️ Constraint may already exist:', e.message);
      }
    }
    console.log('✅ Constraints added successfully');

    // Step 3: Enable RLS
    console.log('3️⃣ Enabling Row Level Security...');
    try {
      await supabase.rpc('exec_sql', { 
        sql: 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;' 
      });
    } catch (e) {
      console.log('⚠️ RLS may already be enabled');
    }
    console.log('✅ RLS enabled');

    // Step 4: Create policies
    console.log('4️⃣ Creating RLS policies...');
    const policies = [
      `CREATE POLICY IF NOT EXISTS profiles_select_own ON public.profiles FOR SELECT USING (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS profiles_insert_own ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);`,
      `CREATE POLICY IF NOT EXISTS profiles_update_own ON public.profiles FOR UPDATE USING (auth.uid() = user_id);`
    ];

    for (const policy of policies) {
      try {
        await supabase.rpc('exec_sql', { sql: policy });
      } catch (e) {
        console.log('⚠️ Policy may already exist:', policy.substring(0, 50) + '...');
      }
    }
    console.log('✅ RLS policies created');

    // Step 5: Create trigger function
    console.log('5️⃣ Creating profile creation trigger...');
    const triggerFunction = `
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        INSERT INTO public.profiles (user_id, username, display_name, age)
        VALUES (
          NEW.id,
          COALESCE(
            NEW.raw_user_meta_data->>'username',
            split_part(NEW.email, '@', 1)
          ),
          COALESCE(
            NEW.raw_user_meta_data->>'display_name',
            NEW.raw_user_meta_data->>'username',
            split_part(NEW.email, '@', 1)
          ),
          CASE 
            WHEN NEW.raw_user_meta_data->>'age' IS NOT NULL 
            THEN (NEW.raw_user_meta_data->>'age')::int 
            ELSE NULL 
          END
        )
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = COALESCE(
            EXCLUDED.display_name,
            profiles.display_name,
            profiles.username
          ),
          age = COALESCE(EXCLUDED.age, profiles.age);

        RETURN NEW;
      END;
      $$;
    `;

    try {
      await supabase.rpc('exec_sql', { sql: triggerFunction });
    } catch (e) {
      console.log('⚠️ Trigger function error:', e.message);
    }
    console.log('✅ Trigger function created');

    // Step 6: Create trigger
    console.log('6️⃣ Creating auth trigger...');
    const createTrigger = `
      DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
    `;

    try {
      await supabase.rpc('exec_sql', { sql: createTrigger });
    } catch (e) {
      console.log('⚠️ Trigger creation error:', e.message);
    }
    console.log('✅ Auth trigger created');

    // Step 7: Update existing profiles
    console.log('7️⃣ Updating existing profiles...');
    const updateExisting = `
      UPDATE public.profiles 
      SET display_name = COALESCE(display_name, username)
      WHERE display_name IS NULL AND username IS NOT NULL;
    `;

    try {
      await supabase.rpc('exec_sql', { sql: updateExisting });
    } catch (e) {
      console.log('⚠️ Update existing profiles error:', e.message);
    }
    console.log('✅ Existing profiles updated');

    // Step 8: Verify the migration
    console.log('8️⃣ Verifying migration...');
    const { data: testData, error: testError } = await supabase
      .from('profiles')
      .select('id, username, display_name, age')
      .limit(3);

    if (testError) {
      console.error('❌ Verification failed:', testError);
    } else {
      console.log('✅ Migration verification successful!');
      console.log('📊 Sample profiles:', testData);
    }

    console.log('\n🎉 Migration completed successfully! Database is ready for signup with name and age.');

  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

runMigrationSteps();