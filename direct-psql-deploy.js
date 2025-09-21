#!/usr/bin/env node

/**
 * DIRECT POSTGRESQL DEPLOYMENT
 * Uses pg client to connect directly to Supabase PostgreSQL
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase PostgreSQL Connection
// Note: You'll need to get the database password from Supabase dashboard
const dbConfig = {
  host: 'aws-0-eu-central-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.ojjpslrhyutizwpvvngu',
  password: 'YOUR_DATABASE_PASSWORD_HERE', // Replace with actual password
  ssl: { rejectUnauthorized: false }
};

async function deployWithPsql() {
  console.log('🚀 DIRECT POSTGRESQL DEPLOYMENT STARTING...');

  const client = new Client(dbConfig);

  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Read SQL migration file
    const sqlPath = path.join(__dirname, 'deploy-create-game-migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📂 SQL Migration loaded:', sqlPath);
    console.log('📏 SQL Size:', sqlContent.length, 'characters');

    // Execute the migration
    console.log('📤 Executing SQL migration...');
    const result = await client.query(sqlContent);

    console.log('✅ MIGRATION EXECUTED SUCCESSFULLY!');
    console.log('📋 Result:', result);

    // Verify deployment
    console.log('🔍 Verifying create_game function...');
    const verifyResult = await client.query(`
      SELECT
        routine_name,
        specific_name,
        routine_type,
        data_type
      FROM information_schema.routines
      WHERE routine_name = 'create_game'
      AND routine_schema = 'public'
      ORDER BY specific_name;
    `);

    console.log('✅ VERIFICATION RESULTS:');
    console.log('📊 Found functions:', verifyResult.rows);

    if (verifyResult.rows.length >= 2) {
      console.log('🎉 SUCCESS! Enhanced create_game function deployed!');
      console.log('✅ Both overloaded functions are available:');
      verifyResult.rows.forEach(row => {
        console.log(`  - ${row.routine_name} (${row.specific_name})`);
      });
    } else {
      console.log('⚠️  Partial deployment - manual verification needed');
    }

  } catch (error) {
    console.error('❌ DEPLOYMENT ERROR:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.log('\n🔑 DATABASE PASSWORD REQUIRED:');
      console.log('1. Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/settings/database');
      console.log('2. Copy the database password');
      console.log('3. Replace YOUR_DATABASE_PASSWORD_HERE in this script');
      console.log('4. Re-run: node direct-psql-deploy.js');
    }

  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Execute deployment
deployWithPsql();