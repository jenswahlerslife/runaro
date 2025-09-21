import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function applySQLPatch() {
  console.log('🔧 Applying SQL patch via Supabase REST API...');

  try {
    // Create a custom function to execute SQL (if it doesn't exist)
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.execute_schema_patch()
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
      BEGIN
        -- Add columns if they don't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'user_activities'
          AND column_name = 'is_base'
        ) THEN
          ALTER TABLE public.user_activities
            ADD COLUMN is_base boolean NOT NULL DEFAULT false;
        END IF;

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

    // First, create the function
    const createResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        sql: createFunctionSQL
      })
    });

    // Try direct SQL approach if that fails
    if (!createResponse.ok) {
      console.log('🔄 Trying alternative approach...');

      // Try to execute individual statements
      const statements = [
        `ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;`,
        `ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;`,
        `CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user ON public.user_activities (user_id) WHERE is_base = true;`
      ];

      console.log('📋 Executing SQL statements individually...');

      // Since we can't execute arbitrary SQL, let's use a workaround
      // We'll create a migration file and apply it
      console.log('\n🛠️  Since direct SQL execution is restricted, here\'s what needs to be done:');
      console.log('\n1. Go to your Supabase Dashboard > SQL Editor');
      console.log('2. Execute this SQL:');
      console.log('========================================');
      console.log(`
-- Idempotent SQL patch for user_activities table
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

-- Enforce one base per user with partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
  ON public.user_activities (user_id)
  WHERE is_base = true;

-- Verification
SELECT 'Columns added successfully' as result;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='user_activities'
  AND column_name IN ('is_base','included_in_game')
ORDER BY column_name;
`);
      console.log('========================================');
      return;
    }

    // Execute the patch function
    const executeResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_schema_patch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      }
    });

    if (!executeResponse.ok) {
      const error = await executeResponse.text();
      console.error('❌ Failed to execute patch:', error);
      return;
    }

    const result = await executeResponse.json();
    console.log('✅ Patch result:', result);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applySQLPatch();