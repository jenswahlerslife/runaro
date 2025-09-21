/**
 * Deploy SQL Migration to Supabase Production Database
 * Uses direct PostgreSQL connection with node-postgres
 *
 * SETUP INSTRUCTIONS:
 * 1. Install node-postgres: npm install pg
 * 2. Get your database password from Supabase Dashboard:
 *    - Go to https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu
 *    - Click "Connect" button
 *    - Copy password from Direct connection string
 * 3. Set DB_PASSWORD environment variable or modify the script
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// You need to set your database password here or via environment variable
const DB_PASSWORD = process.env.DB_PASSWORD || 'YOUR_DB_PASSWORD_HERE';

// Supabase PostgreSQL connection details
const connectionConfig = {
  host: 'db.ojjpslrhyutizwpvvngu.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

async function deployMigration() {
  const client = new Client(connectionConfig);

  try {
    console.log('🚀 Starting SQL migration deployment...');

    if (DB_PASSWORD === 'YOUR_DB_PASSWORD_HERE') {
      console.error('❌ Please set your database password in the script or DB_PASSWORD environment variable');
      process.exit(1);
    }

    // Connect to database
    console.log('🔗 Connecting to Supabase database...');
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Read the SQL file
    const sqlPath = path.join(__dirname, 'deploy-create-game-migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📖 SQL file loaded successfully');
    console.log(`📝 SQL content length: ${sqlContent.length} characters`);

    // Execute the entire SQL as a transaction
    console.log('\n⏳ Executing SQL migration...');
    const result = await client.query(sqlContent);

    console.log('✅ Migration executed successfully');

    // Test the function exists
    console.log('\n🔍 Verifying enhanced create_game function...');
    const testQuery = `
      SELECT
        routine_name,
        specific_name,
        routine_type,
        data_type
      FROM information_schema.routines
      WHERE routine_name = 'create_game'
      AND routine_schema = 'public'
      ORDER BY specific_name;
    `;

    const testResult = await client.query(testQuery);
    console.log(`✅ Found ${testResult.rows.length} create_game function variations:`);
    testResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.specific_name} (${row.routine_type})`);
    });

    console.log('\n🎉 Migration deployment completed successfully!');
    console.log('✨ Enhanced create_game function has been deployed to production');

  } catch (error) {
    console.error('\n💥 Migration deployment failed:', error.message);

    if (error.code === 'ENOTFOUND') {
      console.error('🔍 Network error - check your internet connection');
    } else if (error.code === '28P01') {
      console.error('🔐 Authentication failed - check your database password');
    } else if (error.code === '42601') {
      console.error('📝 SQL syntax error in the migration file');
    }

    process.exit(1);
  } finally {
    try {
      await client.end();
      console.log('🔌 Database connection closed');
    } catch (err) {
      console.error('Error closing connection:', err.message);
    }
  }
}

// Run the migration
deployMigration();