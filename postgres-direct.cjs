const { Client } = require('pg');
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

async function executeDirectPostgreSQL() {
    const connectionString = `postgresql://postgres.ojjpslrhyutizwpvvngu:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;

    const client = new Client({
        connectionString,
        ssl: true,
        application_name: 'claude-schema-patch'
    });

    try {
        console.log('🔗 Connecting to PostgreSQL directly...');
        await client.connect();
        console.log('✅ Connected successfully!');

        console.log('🔧 Executing schema patch...');

        // Execute each statement individually for better error handling
        const statements = [
            `ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;`,
            `ALTER TABLE public.user_activities ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;`,
            `CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user ON public.user_activities (user_id) WHERE is_base = true;`
        ];

        for (const [index, statement] of statements.entries()) {
            try {
                console.log(`📝 Executing statement ${index + 1}/3...`);
                const result = await client.query(statement);
                console.log(`✅ Statement ${index + 1} executed successfully`);
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log(`⚠️ Statement ${index + 1}: Already exists (OK)`);
                } else {
                    console.log(`❌ Statement ${index + 1} failed:`, error.message);
                }
            }
        }

        // Verify the schema changes
        console.log('🔍 Verifying schema changes...');
        const verifyQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema='public'
              AND table_name='user_activities'
              AND column_name IN ('is_base','included_in_game')
            ORDER BY column_name;
        `;

        const verifyResult = await client.query(verifyQuery);
        console.log('📊 Verification results:');
        console.table(verifyResult.rows);

        if (verifyResult.rows.length === 2) {
            console.log('🎉 SUCCESS! Both columns have been added successfully!');
            console.log('✅ Schema patch completed.');
        } else {
            console.log('⚠️ Only partial success. Some columns may be missing.');
        }

    } catch (error) {
        console.error('❌ Connection or execution error:', error.message);
        console.log('\n🛠️ Fallback: Please execute this SQL manually in Supabase SQL Editor:');
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
    } finally {
        try {
            await client.end();
            console.log('🔌 Database connection closed');
        } catch (err) {
            // Connection already closed
        }
    }
}

executeDirectPostgreSQL();