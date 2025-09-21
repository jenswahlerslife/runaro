import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkAndFixUserActivities() {
  console.log('🔍 Checking user_activities table...');

  try {
    // First, try to query the table to see if it exists and what columns it has
    const { data: tableData, error: tableError } = await supabase
      .from('user_activities')
      .select('*')
      .limit(1);

    if (tableError) {
      if (tableError.message.includes('does not exist')) {
        console.log('❌ user_activities table does not exist!');
        console.log('🛠️  The table needs to be created first. This might be the "activities" table instead.');

        // Check if activities table exists
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('activities')
          .select('*')
          .limit(1);

        if (activitiesError) {
          console.log('❌ activities table also does not exist:', activitiesError.message);
        } else {
          console.log('✅ Found activities table');
          console.log('🔧 The frontend code expects user_activities but we have activities');
          console.log('📋 Table structure check needed - this might be a naming mismatch');
        }
        return;
      }

      if (tableError.message.includes('column') && tableError.message.includes('does not exist')) {
        console.log('✅ Table exists but missing columns:', tableError.message);

        // Check what columns do exist
        const { data: existingData, error: existingError } = await supabase
          .from('user_activities')
          .select('id, user_id, created_at')
          .limit(1);

        if (!existingError) {
          console.log('✅ Basic columns exist (id, user_id, created_at)');
          console.log('🔧 Need to add is_base and included_in_game columns');

          // The table exists but missing our target columns
          console.log('\n🛠️  Required SQL to run in Supabase SQL Editor:');
          console.log('========================================');
          console.log(`
-- Add missing columns to user_activities table
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

-- Create unique index to enforce one base per user
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
          console.log('========================================');
        }
      }
    } else {
      console.log('✅ user_activities table exists and is accessible');
      console.log('📊 Sample data:', tableData);

      // Check if our columns exist by trying to select them specifically
      const { data: columnData, error: columnError } = await supabase
        .from('user_activities')
        .select('is_base, included_in_game')
        .limit(1);

      if (columnError) {
        console.log('❌ Missing target columns:', columnError.message);
        console.log('\n🛠️  Required SQL to run in Supabase SQL Editor:');
        console.log('========================================');
        console.log(`
-- Add missing columns to user_activities table
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

-- Create unique index to enforce one base per user
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
        console.log('========================================');
      } else {
        console.log('✅ All required columns exist!');
        console.log('📊 Column data sample:', columnData);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkAndFixUserActivities();