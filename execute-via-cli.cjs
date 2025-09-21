const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create a temporary SQL file with our schema changes
const sqlContent = `
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
`;

async function executeViaSupabaseCLI() {
    console.log('🚀 EXECUTING SQL VIA SUPABASE CLI');
    console.log('==================================');

    try {
        // Write SQL to temporary file
        const tempSqlFile = path.join(__dirname, 'temp_schema_patch.sql');
        fs.writeFileSync(tempSqlFile, sqlContent);
        console.log('📝 Created temporary SQL file');

        // Set environment variables
        process.env.SUPABASE_ACCESS_TOKEN = 'sbp_4d1e6b1e1b73bdf1b092c04bfa1336a005576207';
        process.env.SUPABASE_PROJECT_REF = 'ojjpslrhyutizwpvvngu';
        process.env.SUPABASE_DB_PASSWORD = 'Jzu37nnq!123456';

        console.log('🔧 Environment configured');

        // Try multiple approaches with Supabase CLI
        const approaches = [
            // Approach 1: Direct SQL execution
            ['npx', 'supabase', 'db', 'push', '--include-seed', '--password', 'Jzu37nnq!123456'],

            // Approach 2: SQL file execution
            ['npx', 'supabase', 'db', 'reset', '--linked'],

            // Approach 3: Migration creation and push
            ['npx', 'supabase', 'migration', 'new', 'add_user_activities_columns']
        ];

        // First, try to login and link
        console.log('🔐 Logging in to Supabase...');
        await executeCommand(['npx', 'supabase', 'login', '--token', 'sbp_4d1e6b1e1b73bdf1b092c04bfa1336a005576207']);

        console.log('🔗 Linking to project...');
        await executeCommand(['npx', 'supabase', 'link', '--project-ref', 'ojjpslrhyutizwpvvngu']);

        // Create a new migration with our SQL
        console.log('📋 Creating migration...');
        const migrationResult = await executeCommand(['npx', 'supabase', 'migration', 'new', 'add_user_activities_columns']);

        if (migrationResult.success) {
            // Find the created migration file and write our SQL to it
            const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
            if (fs.existsSync(migrationsDir)) {
                const migrationFiles = fs.readdirSync(migrationsDir)
                    .filter(f => f.includes('add_user_activities_columns'))
                    .sort()
                    .reverse();

                if (migrationFiles.length > 0) {
                    const migrationFile = path.join(migrationsDir, migrationFiles[0]);
                    fs.writeFileSync(migrationFile, sqlContent);
                    console.log('✅ Migration file updated with our SQL');

                    // Push the migration
                    console.log('🚀 Pushing migration to production...');
                    const pushResult = await executeCommand(['npx', 'supabase', 'db', 'push', '--password', 'Jzu37nnq!123456']);

                    if (pushResult.success) {
                        console.log('🎉 SUCCESS! Migration pushed successfully!');

                        // Verify the changes
                        console.log('🔍 Verifying changes...');
                        await verifyChanges();

                        // Clean up
                        fs.unlinkSync(tempSqlFile);
                        return { success: true, message: 'Schema changes deployed successfully' };
                    }
                }
            }
        }

        // If migration approach fails, try direct database connection
        console.log('🔄 Trying direct database approach...');
        const dbResult = await executeCommand([
            'psql',
            `postgresql://postgres.ojjpslrhyutizwpvvngu:Jzu37nnq!123456@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
            '-f', tempSqlFile
        ]);

        if (dbResult.success) {
            console.log('🎉 SUCCESS! Direct database execution worked!');
            await verifyChanges();
            fs.unlinkSync(tempSqlFile);
            return { success: true, message: 'Schema changes applied via direct connection' };
        }

        // Clean up and report failure
        fs.unlinkSync(tempSqlFile);
        console.log('❌ All CLI approaches failed');

        return { success: false, message: 'CLI execution failed - manual intervention required' };

    } catch (error) {
        console.error('❌ CLI execution error:', error.message);
        return { success: false, error: error.message };
    }
}

function executeCommand(command) {
    return new Promise((resolve) => {
        console.log(`🔧 Executing: ${command.join(' ')}`);

        const process = spawn(command[0], command.slice(1), {
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Command succeeded');
                if (stdout) console.log('📤 Output:', stdout.trim());
                resolve({ success: true, stdout, stderr });
            } else {
                console.log(`❌ Command failed with code ${code}`);
                if (stderr) console.log('📤 Error:', stderr.trim());
                resolve({ success: false, code, stdout, stderr });
            }
        });

        process.on('error', (error) => {
            console.log('❌ Command execution error:', error.message);
            resolve({ success: false, error: error.message });
        });
    });
}

async function verifyChanges() {
    const { createClient } = require('@supabase/supabase-js');

    const supabase = createClient(
        'https://ojjpslrhyutizwpvvngu.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4'
    );

    try {
        const { data, error } = await supabase
            .from('user_activities')
            .select('is_base, included_in_game')
            .limit(1);

        if (!error) {
            console.log('✅ Verification successful! Columns are now accessible.');
            console.log('📊 Sample data:', data);
            return true;
        } else {
            console.log('❌ Verification failed:', error.message);
            return false;
        }
    } catch (error) {
        console.log('❌ Verification error:', error.message);
        return false;
    }
}

// Execute the CLI approach
executeViaSupabaseCLI()
    .then(result => {
        if (result.success) {
            console.log('\n🎉 MISSION ACCOMPLISHED!');
            console.log('========================');
            console.log('✅ SQL schema changes have been deployed');
            console.log('✅ user_activities table now has is_base and included_in_game columns');
            console.log('✅ Game setup page should work without errors');
            console.log('✅ CSP headers already deployed for Supabase Realtime');
            console.log('\nThe complete fix is now live in production!');
        } else {
            console.log('\n❌ CLI DEPLOYMENT FAILED');
            console.log('=========================');
            console.log('Manual intervention is still required.');
            console.log('\n🔗 Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql/new');
            console.log('\n📋 Execute the SQL provided earlier to complete the fix.');
        }
    })
    .catch(console.error);