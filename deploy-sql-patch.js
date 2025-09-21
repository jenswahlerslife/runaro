import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from multiple files
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function deployPatch() {
  console.log('🔧 Deploying SQL patch to production database...');

  try {
    // First, check if columns already exist by trying to select them
    console.log('🔍 Checking current table structure...');
    const { error: selectError } = await supabase
      .from('user_activities')
      .select('is_base, included_in_game')
      .limit(1);

    if (!selectError) {
      console.log('✅ Columns already exist! No patch needed.');
      return;
    }

    console.log('📋 Columns missing, need to apply patch...');
    console.log('Error details:', selectError.message);

    // Since we can't execute raw SQL via client, we need to use Supabase's migration approach
    // For now, let's verify what's missing and provide instructions
    console.log('\n🛠️  Manual SQL patch required:');
    console.log('Please run the following SQL in your Supabase SQL editor:');
    console.log('----------------------------------------');
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

-- Verification query
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='user_activities'
  AND column_name IN ('is_base','included_in_game')
ORDER BY column_name;
`);
    console.log('----------------------------------------');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

deployPatch();