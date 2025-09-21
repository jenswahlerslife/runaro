// Enhanced version of the Claude Supabase toolkit specifically for patching user_activities
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function patchUserActivitiesTable() {
    console.log('🔧 Claude Supabase Toolkit - USER_ACTIVITIES PATCH');
    console.log('==================================================');

    try {
        // First, verify current table structure
        console.log('🔍 Checking current table structure...');
        const { data: currentData, error: currentError } = await supabase
            .from('user_activities')
            .select('is_base, included_in_game')
            .limit(1);

        if (!currentError) {
            console.log('✅ Columns already exist! No patch needed.');
            console.log('📊 Sample data:', currentData);
            return;
        }

        if (currentError.message.includes('column') && currentError.message.includes('does not exist')) {
            console.log('📋 Missing columns detected:', currentError.message);

            // Try using a custom function approach
            const migrationFunction = `
                CREATE OR REPLACE FUNCTION apply_user_activities_patch()
                RETURNS text
                LANGUAGE plpgsql
                SECURITY DEFINER
                AS $$
                DECLARE
                    result text := '';
                BEGIN
                    -- Check and add is_base column
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'user_activities'
                        AND column_name = 'is_base'
                        AND table_schema = 'public'
                    ) THEN
                        EXECUTE 'ALTER TABLE public.user_activities ADD COLUMN is_base boolean NOT NULL DEFAULT false';
                        result := result || 'Added is_base column. ';
                    END IF;

                    -- Check and add included_in_game column
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'user_activities'
                        AND column_name = 'included_in_game'
                        AND table_schema = 'public'
                    ) THEN
                        EXECUTE 'ALTER TABLE public.user_activities ADD COLUMN included_in_game boolean NOT NULL DEFAULT true';
                        result := result || 'Added included_in_game column. ';
                    END IF;

                    -- Check and add unique index
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE tablename = 'user_activities'
                        AND indexname = 'uniq_base_per_user'
                        AND schemaname = 'public'
                    ) THEN
                        EXECUTE 'CREATE UNIQUE INDEX uniq_base_per_user ON public.user_activities (user_id) WHERE is_base = true';
                        result := result || 'Added unique index. ';
                    END IF;

                    IF result = '' THEN
                        result := 'No changes needed - all columns and indexes exist.';
                    END IF;

                    RETURN result;
                END;
                $$;
            `;

            console.log('🛠️ Attempting to create and execute migration function...');

            // Since we can't execute arbitrary SQL via the client library, let's use a different approach
            // Check if we can at least insert/update to trigger any functions
            const { data: basicData, error: basicError } = await supabase
                .from('user_activities')
                .select('id, user_id, created_at')
                .limit(1);

            if (basicError) {
                console.error('❌ Basic table access failed:', basicError);
                throw basicError;
            }

            console.log('✅ Basic table access works');
            console.log('📊 Sample existing data:', basicData);

            // Since the Supabase client doesn't allow arbitrary SQL execution for security,
            // and we need to modify the schema, we need to use the SQL editor
            console.log('\n⚠️ SCHEMA MODIFICATION REQUIRED');
            console.log('=====================================');
            console.log('The missing columns need to be added via Supabase SQL Editor.');
            console.log('Please copy and paste this SQL into your Supabase SQL Editor:');
            console.log('\n```sql');
            console.log('-- Add missing columns to user_activities table');
            console.log('ALTER TABLE public.user_activities');
            console.log('  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;');
            console.log('');
            console.log('ALTER TABLE public.user_activities');
            console.log('  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;');
            console.log('');
            console.log('-- Create unique index to enforce one base per user');
            console.log('CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user');
            console.log('  ON public.user_activities (user_id)');
            console.log('  WHERE is_base = true;');
            console.log('');
            console.log('-- Verification query');
            console.log('SELECT column_name, data_type, is_nullable, column_default');
            console.log('FROM information_schema.columns');
            console.log('WHERE table_schema=\'public\'');
            console.log('  AND table_name=\'user_activities\'');
            console.log('  AND column_name IN (\'is_base\',\'included_in_game\')');
            console.log('ORDER BY column_name;');
            console.log('```');
            console.log('\n📍 Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql/new');
            console.log('=====================================');

        } else {
            console.error('❌ Unexpected error:', currentError);
        }

    } catch (error) {
        console.error('❌ Fatal error:', error);
        console.log('\n🛠️ Manual intervention required. Execute the SQL in Supabase dashboard.');
    }
}

patchUserActivitiesTable();