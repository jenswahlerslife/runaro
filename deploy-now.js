#!/usr/bin/env node

/**
 * EMERGENCY SUPABASE DEPLOYMENT SCRIPT
 * Deploys create_game migration with service role access
 */

import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Production Connection
const connectionString = 'postgresql://postgres.ojjpslrhyutizwpvvngu:DATABASE_PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

async function deployMigration() {
  console.log('🚀 STARTING SUPABASE DEPLOYMENT...');

  try {
    // Read SQL migration file
    const sqlPath = path.join(__dirname, 'deploy-create-game-migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📂 SQL Migration loaded:', sqlPath);
    console.log('📏 SQL Size:', sqlContent.length, 'characters');

    // Alternative 1: Direct SQL execution via Supabase REST API
    console.log('🔧 Method 1: Trying REST API...');

    // Split SQL into individual statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log('📝 Found', statements.length, 'SQL statements');

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement.trim()) continue;

      console.log(`📤 Executing statement ${i + 1}/${statements.length}...`);

      try {
        const response = await fetch('https://ojjpslrhyutizwpvvngu.supabase.co/rest/v1/rpc/exec_sql', {
          method: 'POST',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: statement + ';' })
        });

        const result = await response.text();
        console.log(`✅ Statement ${i + 1} result:`, result.substring(0, 100));

      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} failed via REST API:`, err.message);
      }
    }

  } catch (error) {
    console.error('❌ DEPLOYMENT ERROR:', error.message);
    console.log('📋 Manual deployment required via Supabase Dashboard');
    console.log('🔗 Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
  }

  // Verification step
  console.log('🔍 VERIFYING DEPLOYMENT...');
  await verifyDeployment();
}

async function verifyDeployment() {
  try {

    // Check if enhanced create_game function exists
    const response = await fetch('https://ojjpslrhyutizwpvvngu.supabase.co/rest/v1/rpc/create_game', {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_league_id: '00000000-0000-0000-0000-000000000000',
        p_name: 'Test Game',
        p_duration_days: 14
      })
    });

    const result = await response.text();

    if (result.includes('success')) {
      console.log('✅ DEPLOYMENT SUCCESSFUL! Enhanced create_game function is working');
    } else {
      console.log('⚠️  Function exists but may need manual verification');
      console.log('📋 Response:', result.substring(0, 200));
    }

  } catch (error) {
    console.log('🔍 Verification requires manual check in Supabase Dashboard');
  }
}

// Execute deployment
deployMigration();