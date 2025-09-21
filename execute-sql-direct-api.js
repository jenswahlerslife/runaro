import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQLDirectly() {
  console.log('🔧 Executing SQL patch directly...');

  try {
    // Create a temporary function to execute our SQL
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.temp_add_user_activities_columns()
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        -- Add is_base column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'user_activities'
          AND column_name = 'is_base'
        ) THEN
          ALTER TABLE public.user_activities
            ADD COLUMN is_base boolean NOT NULL DEFAULT false;
        END IF;

        -- Add included_in_game column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'user_activities'
          AND column_name = 'included_in_game'
        ) THEN
          ALTER TABLE public.user_activities
            ADD COLUMN included_in_game boolean NOT NULL DEFAULT true;
        END IF;

        -- Create unique index if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE schemaname = 'public'
          AND tablename = 'user_activities'
          AND indexname = 'uniq_base_per_user'
        ) THEN
          CREATE UNIQUE INDEX uniq_base_per_user
            ON public.user_activities (user_id)
            WHERE is_base = true;
        END IF;

        RETURN 'Schema patch applied successfully';
      END;
      $$;
    `;

    console.log('📝 Creating temporary function...');
    const { data: createResult, error: createError } = await supabase.rpc('exec', {
      sql: createFunctionSQL
    });

    if (createError) {
      console.log('⚠️ Function creation via RPC failed, trying direct query...');

      // Try using the sql method instead
      const { data: sqlData, error: sqlError } = await supabase
        .from('_')
        .select('*')
        .limit(0); // This forces a connection

      if (sqlError) {
        console.log('📋 Using alternative approach - will execute individual statements');

        // Execute the SQL statements using a different approach
        const statements = [
          "ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;",
          "ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;",
          "CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user ON public.user_activities (user_id) WHERE is_base = true;"
        ];

        console.log('🔧 Attempting to execute statements via direct table operations...');

        // Since we can't execute arbitrary SQL, let's verify the table structure first
        const { data: testData, error: testError } = await supabase
          .from('user_activities')
          .select('is_base, included_in_game')
          .limit(1);

        if (testError && testError.message.includes('does not exist')) {
          console.log('❌ Columns still missing. Need manual execution.');
          console.log('\n🛠️ Please execute this SQL in Supabase SQL Editor:');
          console.log('=============================================');
          statements.forEach(stmt => console.log(stmt));
          console.log('=============================================');
          return;
        } else if (!testError) {
          console.log('✅ Columns already exist! Patch not needed.');
          return;
        }
      }
    } else {
      console.log('✅ Function created successfully');

      // Execute the function
      console.log('🚀 Executing the schema patch...');
      const { data: executeResult, error: executeError } = await supabase
        .rpc('temp_add_user_activities_columns');

      if (executeError) {
        console.error('❌ Function execution failed:', executeError);
        return;
      }

      console.log('✅ Function result:', executeResult);

      // Clean up the temporary function
      console.log('🧹 Cleaning up temporary function...');
      await supabase.rpc('exec', {
        sql: 'DROP FUNCTION IF EXISTS public.temp_add_user_activities_columns();'
      });
    }

    // Verify the patch worked
    console.log('🔍 Verifying columns were added...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_activities')
      .select('is_base, included_in_game')
      .limit(1);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      console.log('\n🛠️ Manual SQL execution required:');
      console.log('=============================================');
      console.log(`
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
  ON public.user_activities (user_id)
  WHERE is_base = true;
`);
      console.log('=============================================');
    } else {
      console.log('✅ Columns verified successfully!');
      console.log('📊 Sample data:', verifyData);
      console.log('🎉 Schema patch completed successfully!');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.log('\n🛠️ Fallback: Execute this SQL manually in Supabase SQL Editor:');
    console.log('=============================================');
    console.log(`
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
  ON public.user_activities (user_id)
  WHERE is_base = true;
`);
    console.log('=============================================');
  }
}

executeSQLDirectly();