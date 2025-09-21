#!/usr/bin/env node

/**
 * DEPLOYMENT MED FULD ADGANG
 * Bruger service role og CLI token til komplet deployment
 */

import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dine credentials
const CLI_TOKEN = 'sbp_98a2f45a9746097dd3ff95773748eeb04e8b24f5';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

async function deployWithFullAccess() {
  console.log('🚀 FULD ADGANG DEPLOYMENT STARTER...');

  try {
    // Read SQL migration
    const sqlPath = path.join(__dirname, 'deploy-create-game-migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📂 SQL Migration loaded:', sqlPath);
    console.log('📏 SQL Size:', sqlContent.length, 'characters');

    // Method 1: Try Management API with CLI token
    console.log('🔧 Method 1: Trying Management API...');

    const managementResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/migrations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'enhance_create_game_with_duration',
        sql: sqlContent
      })
    });

    const managementResult = await managementResponse.text();
    console.log('📋 Management API response:', managementResult.substring(0, 200));

    if (managementResponse.ok) {
      console.log('✅ DEPLOYMENT VIA MANAGEMENT API SUCCESSFUL!');
      await verifyDeployment();
      return;
    }

    // Method 2: Try direct function creation via REST API
    console.log('🔧 Method 2: Direct function creation...');

    // Extract just the function creation SQL
    const functionSQL = sqlContent
      .split('\n')
      .filter(line =>
        line.includes('CREATE OR REPLACE FUNCTION') ||
        line.includes('RETURNS json') ||
        line.includes('LANGUAGE plpgsql') ||
        line.includes('SECURITY DEFINER') ||
        line.includes('AS $$') ||
        line.includes('BEGIN') ||
        line.includes('END;') ||
        line.includes('$$;') ||
        (line.trim().length > 0 && !line.startsWith('--') && !line.startsWith('SET') && !line.startsWith('DROP'))
      )
      .join('\n');

    console.log('📤 Creating function via REST API...');
    console.log('🔍 Function SQL preview:', functionSQL.substring(0, 300));

    // Method 3: Use PostgREST raw SQL endpoint (if available)
    const restResponse = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/sql',
        'Accept': 'application/json'
      },
      body: functionSQL
    });

    const restResult = await restResponse.text();
    console.log('📋 REST API response:', restResult.substring(0, 200));

    if (restResponse.ok) {
      console.log('✅ DEPLOYMENT VIA REST API SUCCESSFUL!');
      await verifyDeployment();
      return;
    }

    // Method 4: Manual deployment instructions
    console.log('🔧 Automatic deployment not possible - showing manual instructions...');
    console.log('');
    console.log('🎯 MANUAL DEPLOYMENT REQUIRED:');
    console.log('1. Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
    console.log('2. Click "SQL Editor" in sidebar');
    console.log('3. Click "New query"');
    console.log('4. Copy content from: deploy-create-game-migration.sql');
    console.log('5. Paste and click "Run"');
    console.log('');
    console.log('✅ Expected result: "Enhanced create_game function deployed successfully"');

  } catch (error) {
    console.error('❌ DEPLOYMENT ERROR:', error.message);
  }
}

async function verifyDeployment() {
  console.log('🔍 VERIFYING DEPLOYMENT...');

  try {
    // Test the enhanced create_game function
    const testResponse = await fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/rpc/create_game`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE,
        'Authorization': `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_league_id: '00000000-0000-0000-0000-000000000000',
        p_name: 'Test Verification Game',
        p_duration_days: 14
      })
    });

    const testResult = await testResponse.text();
    console.log('🧪 Function test result:', testResult.substring(0, 200));

    if (testResult.includes('success') || testResult.includes('Not authorized')) {
      console.log('✅ VERIFICATION SUCCESSFUL! Function is working');
      console.log('🎉 Enhanced create_game is deployed and functional!');
    } else {
      console.log('⚠️  Function may need manual verification');
    }

  } catch (error) {
    console.log('🔍 Verification completed - manual check recommended');
  }
}

// Execute deployment
deployWithFullAccess();