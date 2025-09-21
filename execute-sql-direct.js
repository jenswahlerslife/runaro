import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const { Client } = pg;

async function executeSQLPatch() {
  // Connection string using the database password from env
  const connectionString = `postgresql://postgres.ojjpslrhyutizwpvvngu:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`;

  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔗 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Execute the SQL patch
    console.log('🔧 Executing SQL patch...');

    const sql = `
      -- Idempotent SQL patch for user_activities table
      ALTER TABLE public.user_activities
        ADD COLUMN IF NOT EXISTS is_base boolean NOT NULL DEFAULT false;

      ALTER TABLE public.user_activities
        ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

      -- Enforce one base per user with partial unique index
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_base_per_user
        ON public.user_activities (user_id)
        WHERE is_base = true;
    `;

    await client.query(sql);
    console.log('✅ SQL patch executed successfully!');

    // Verify columns exist
    console.log('🔍 Verifying columns...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema='public'
        AND table_name='user_activities'
        AND column_name IN ('is_base','included_in_game')
      ORDER BY column_name;
    `);

    console.log('📋 Column verification results:');
    console.table(verifyResult.rows);

    if (verifyResult.rows.length === 2) {
      console.log('✅ Both columns exist and are properly configured!');
    } else {
      console.log('❌ Some columns may be missing');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

executeSQLPatch();