const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function executeSchemaChanges() {
    console.log('🔧 Attempting direct schema modification...');

    try {
        // Try to create a function that can execute the schema changes
        // This uses a specific Supabase approach that might work with service role
        console.log('📝 Step 1: Checking if we can execute via RPC...');

        // Check if there's a function we can use to execute SQL
        const functions = [
            'execute_sql',
            'exec_sql',
            'run_sql',
            'sql_exec',
            'admin_execute_sql'
        ];

        for (const funcName of functions) {
            console.log(`🔍 Trying function: ${funcName}`);
            try {
                const { data, error } = await supabase.rpc(funcName, {
                    query: "SELECT 'test' as result;"
                });

                if (!error) {
                    console.log(`✅ Found working function: ${funcName}`);

                    // Now execute our schema changes
                    const schemaSQL = `
                        ALTER TABLE public.user_activities
                          ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

                        ALTER TABLE public.user_activities
                          ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

                        CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
                          ON public.user_activities (user_id)
                          WHERE is_base = true;
                    `;

                    console.log('🚀 Executing schema changes...');
                    const { data: schemaData, error: schemaError } = await supabase.rpc(funcName, {
                        query: schemaSQL
                    });

                    if (schemaError) {
                        console.log('❌ Schema execution failed:', schemaError);
                    } else {
                        console.log('✅ Schema changes executed successfully!');
                        console.log('📊 Result:', schemaData);

                        // Verify the changes
                        const { data: verifyData, error: verifyError } = await supabase
                            .from('user_activities')
                            .select('is_base, included_in_game')
                            .limit(1);

                        if (!verifyError) {
                            console.log('🎉 Verification successful! Columns added.');
                            return;
                        }
                    }
                }
            } catch (err) {
                // Function doesn't exist, continue
            }
        }

        console.log('⚠️ No suitable SQL execution function found.');

        // Alternative approach: Try using SQL directly through HTTP API
        console.log('🔄 Trying HTTP API approach...');

        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
                'apikey': serviceRoleKey
            },
            body: JSON.stringify({
                sql: `
                    ALTER TABLE public.user_activities
                      ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

                    ALTER TABLE public.user_activities
                      ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

                    CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
                      ON public.user_activities (user_id)
                      WHERE is_base = true;
                `
            })
        });

        if (response.ok) {
            console.log('✅ HTTP API execution successful!');
            const result = await response.json();
            console.log('📊 Result:', result);
        } else {
            console.log('❌ HTTP API failed:', response.status, response.statusText);
        }

        // Final verification attempt
        console.log('🔍 Final verification...');
        const { data: finalData, error: finalError } = await supabase
            .from('user_activities')
            .select('is_base, included_in_game')
            .limit(1);

        if (!finalError) {
            console.log('🎉 SUCCESS! Columns are now available.');
            console.log('📊 Sample data:', finalData);
        } else {
            console.log('❌ Verification failed. Manual SQL execution required.');
            console.log('\n🔗 Direct SQL Editor Link:');
            console.log('https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql/new');
            console.log('\n📋 SQL to execute:');
            console.log(`
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
  ON public.user_activities (user_id)
  WHERE is_base = true;
            `);
        }

    } catch (error) {
        console.error('❌ Fatal error:', error);
        console.log('\n🛠️ Please execute the SQL manually in Supabase dashboard.');
    }
}

executeSchemaChanges();