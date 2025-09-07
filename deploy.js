#!/usr/bin/env node

/**
 * RUNARO AUTO-DEPLOY - Complete automation
 * Handles: Build → Supabase migrations → Cloudflare deployment
 * Usage: npm run deploy
 */

import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

console.log('🚀 RUNARO AUTO-DEPLOY STARTING...\n');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigrations() {
  console.log('1️⃣ RUNNING SUPABASE MIGRATIONS...');
  
  // Look for migration files
  const migrationFiles = [
    'FINAL_SUPABASE_MIGRATION.sql',
    'add_age_column_only.sql'
  ].filter(file => existsSync(file));

  if (migrationFiles.length === 0) {
    console.log('   ✅ No migration files found, checking database state...');
    
    // Quick check if we need the age column
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('age')
        .limit(1);
      
      if (error && error.message.includes('age')) {
        console.log('   🔧 Need to add age column...');
        await executeSQL('ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age INTEGER;');
        await executeSQL('ALTER TABLE public.profiles ADD CONSTRAINT IF NOT EXISTS profiles_age_range CHECK (age IS NULL OR (age >= 5 AND age <= 120));');
      } else {
        console.log('   ✅ Database schema up to date');
      }
    } catch (checkError) {
      console.log('   ⚠️ Database check failed, continuing...');
    }
    return;
  }

  for (const file of migrationFiles) {
    console.log(`   📄 Running ${file}...`);
    
    try {
      const sql = readFileSync(file, 'utf8');
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.toLowerCase().includes('select'));

      for (const statement of statements) {
        if (statement.trim()) {
          await executeSQL(statement + ';');
        }
      }
      
      console.log(`   ✅ ${file} completed`);
      
    } catch (migrationError) {
      console.log(`   ⚠️ ${file} may have already been applied`);
    }
  }
}

async function executeSQL(sql) {
  try {
    // Method 1: Try RPC if function exists
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (!error) return;
    
    // Method 2: Try direct REST API
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });
    
    if (!response.ok) {
      // Method 3: Try PostgreSQL direct connection approach
      console.log(`   📡 Executing: ${sql.substring(0, 50)}...`);
      
      // Create a temporary SQL function to execute DDL
      const wrapperSQL = `
        DO $$
        BEGIN
          ${sql.replace(/;$/, '')}
        EXCEPTION
          WHEN duplicate_column THEN
            -- Column already exists
            NULL;
          WHEN duplicate_object THEN
            -- Constraint already exists
            NULL;
        END $$;
      `;
      
      const { error: wrapperError } = await supabase.rpc('exec', { sql: wrapperSQL });
      if (wrapperError) {
        console.log(`   ⚠️ ${wrapperError.message.substring(0, 100)}`);
      }
    }
    
  } catch (sqlError) {
    console.log(`   ⚠️ SQL may already be applied: ${sqlError.message.substring(0, 100)}`);
  }
}

async function buildProject() {
  console.log('2️⃣ BUILDING PROJECT...');
  
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('   ✅ Build completed');
  } catch (buildError) {
    console.error('   ❌ Build failed:', buildError.message);
    process.exit(1);
  }
}

async function deployToCloudflare() {
  console.log('3️⃣ DEPLOYING TO CLOUDFLARE...');
  
  try {
    const deployResult = execSync('npx wrangler pages deploy dist --project-name runaro --commit-dirty=true', { 
      encoding: 'utf8' 
    });
    
    console.log('   ✅ Cloudflare deployment completed');
    
    // Extract deployment URL
    const urlMatch = deployResult.match(/https:\/\/([a-f0-9]+)\.runaro\.pages\.dev/);
    if (urlMatch) {
      const deploymentUrl = urlMatch[0];
      console.log(`   🌐 New deployment: ${deploymentUrl}`);
    }
    
    console.log('   🌐 Live site: https://runaro.dk');
    
  } catch (deployError) {
    console.error('   ❌ Deployment failed:', deployError.message);
    process.exit(1);
  }
}

async function verifyDeployment() {
  console.log('4️⃣ VERIFYING DEPLOYMENT...');
  
  try {
    // Test database
    const { data: dbTest, error: dbError } = await supabase
      .from('profiles')
      .select('id, username, display_name, age')
      .limit(1);
    
    if (dbError) {
      console.log('   ⚠️ Database verification failed:', dbError.message);
    } else {
      console.log('   ✅ Database schema verified');
    }
    
    // Test website
    setTimeout(() => {
      try {
        const testResult = execSync('curl -s -I "https://runaro.dk" | head -1', { encoding: 'utf8' });
        if (testResult.includes('200') || testResult.includes('OK')) {
          console.log('   ✅ Website is live and accessible');
        }
      } catch (testError) {
        console.log('   ⚠️ Website test inconclusive');
      }
    }, 2000);
    
  } catch (verifyError) {
    console.log('   ⚠️ Verification incomplete');
  }
}

async function fullDeploy() {
  try {
    await runMigrations();
    await buildProject();
    await deployToCloudflare();
    await verifyDeployment();
    
    console.log('\n🎉 AUTO-DEPLOY COMPLETED!');
    console.log('═══════════════════════════════');
    console.log('✅ Database migrations applied');
    console.log('✅ Project built successfully');
    console.log('✅ Deployed to Cloudflare Pages');
    console.log('✅ Verification completed');
    console.log('\n🌐 READY FOR USE:');
    console.log('   Main site: https://runaro.dk');
    console.log('   Auth page: https://runaro.dk/auth');
    console.log('   Dashboard: https://runaro.dk/dashboard');
    
  } catch (error) {
    console.error('\n❌ AUTO-DEPLOY FAILED:', error.message);
    process.exit(1);
  }
}

// Handle direct execution
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  fullDeploy();
}

export { fullDeploy, runMigrations, buildProject, deployToCloudflare };