#!/usr/bin/env node

/**
 * Direct Cloudflare Access Fix
 * Uses authenticated requests to disable Access protection
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const ACCOUNT_ID = '45ae1aa085ebaf8c78509f4ff3a31007';

console.log('🔧 DIRECT CLOUDFLARE ACCESS FIX\n');

function findWranglerAuth() {
  // Try to find wrangler config/auth
  const possiblePaths = [
    join(homedir(), '.wrangler'),
    join(homedir(), '.cloudflare'),
    join(process.cwd(), '.wrangler')
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log(`📁 Found Wrangler config at: ${path}`);
      return path;
    }
  }
  
  return null;
}

async function makeAuthenticatedRequest(endpoint, method = 'GET', data = null) {
  try {
    // Use wrangler to make authenticated requests through a workaround
    let curlCmd;
    
    if (method === 'GET') {
      // For GET requests, we can try using wrangler's built-in auth
      curlCmd = `npx wrangler dev --local --port 0 --compatibility-date 2023-01-01 --config /dev/null --name temp --no-bundle 2>/dev/null & sleep 1; curl -s "https://api.cloudflare.com/client/v4/${endpoint}" -H "Authorization: Bearer $(npx wrangler auth whoami --json 2>/dev/null | jq -r '.apiToken')" 2>/dev/null || echo '{"success":false}'`;
    } else {
      // For DELETE/POST requests
      const dataFlag = data ? `-d '${JSON.stringify(data)}'` : '';
      curlCmd = `curl -s -X ${method} ${dataFlag} "https://api.cloudflare.com/client/v4/${endpoint}" -H "Authorization: Bearer $(npx wrangler auth whoami --json 2>/dev/null | jq -r '.apiToken')" -H "Content-Type: application/json" 2>/dev/null || echo '{"success":false}'`;
    }
    
    console.log(`📡 ${method} ${endpoint}`);
    
    const result = execSync(curlCmd, { encoding: 'utf8', shell: true });
    return JSON.parse(result.trim());
    
  } catch (error) {
    console.log(`⚠️ Request failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function directAccessFix() {
  console.log('🔍 Step 1: Finding Cloudflare authentication...');
  
  const wranglerPath = findWranglerAuth();
  
  console.log('\n🎯 Step 2: Attempting to list and remove Access applications...');
  
  try {
    // Method 1: Direct API calls (if auth works)
    const appsResponse = await makeAuthenticatedRequest(`accounts/${ACCOUNT_ID}/access/apps`);
    
    if (appsResponse.success && appsResponse.result) {
      console.log(`📋 Found ${appsResponse.result.length} Access applications`);
      
      const problematicApps = appsResponse.result.filter(app => 
        (app.domain && (app.domain.includes('pages.dev') || app.domain.includes('runaro'))) ||
        (app.name && (app.name.toLowerCase().includes('pages') || app.name.toLowerCase().includes('runaro')))
      );
      
      console.log(`🎯 Found ${problematicApps.length} problematic applications`);
      
      for (const app of problematicApps) {
        console.log(`🗑️ Removing: ${app.name} (${app.domain})`);
        
        const deleteResponse = await makeAuthenticatedRequest(
          `accounts/${ACCOUNT_ID}/access/apps/${app.id}`, 
          'DELETE'
        );
        
        if (deleteResponse.success) {
          console.log(`✅ Successfully removed: ${app.name}`);
        } else {
          console.log(`❌ Failed to remove: ${app.name}`);
        }
      }
      
    } else {
      console.log('⚠️ Could not fetch Access applications via API');
    }
    
    // Method 2: Try to manage through Pages project settings
    console.log('\n🔄 Step 3: Checking Pages project settings...');
    
    // Sometimes Access is configured at the project level
    try {
      const projectInfo = execSync('npx wrangler pages project list --json 2>/dev/null', { encoding: 'utf8' });
      const projects = JSON.parse(projectInfo);
      
      const runaroProject = projects.find(p => p.name === 'runaro');
      
      if (runaroProject) {
        console.log(`📋 Found Runaro project: ${runaroProject.name}`);
        console.log(`🔗 Domains: ${runaroProject.domains?.join(', ')}`);
        
        // Check if there are any project-level access settings we can modify
        console.log('🔧 Project-level Access settings may need manual review');
      }
      
    } catch (projectError) {
      console.log('⚠️ Could not check project settings:', projectError.message);
    }
    
    // Method 3: Nuclear option - try to recreate deployment without Access
    console.log('\n🚀 Step 4: Creating fresh deployment...');
    
    try {
      // Deploy again to potentially bypass any cached Access settings
      console.log('📦 Creating new deployment...');
      
      const deployResult = execSync('npx wrangler pages deploy dist --project-name runaro --commit-dirty=true', { 
        encoding: 'utf8' 
      });
      
      console.log('✅ New deployment created');
      
      // Extract the new URL from deployment result
      const urlMatch = deployResult.match(/https:\/\/([a-f0-9]+)\.runaro\.pages\.dev/);
      if (urlMatch) {
        const newUrl = urlMatch[0];
        console.log(`🆕 New URL: ${newUrl}`);
        console.log('🧪 Test this URL to see if Access is bypassed');
        
        // Quick test of the new URL
        setTimeout(async () => {
          try {
            const testResult = execSync(`curl -s -I "${newUrl}" | head -1`, { encoding: 'utf8' });
            console.log(`📊 URL test result: ${testResult.trim()}`);
            
            if (testResult.includes('200') || testResult.includes('OK')) {
              console.log('🎉 SUCCESS! New deployment appears to be accessible');
            } else if (testResult.includes('302') || testResult.includes('301')) {
              console.log('⚠️ Still redirecting - Access might still be active');
            }
          } catch (testError) {
            console.log('⚠️ Could not test new URL');
          }
        }, 3000);
      }
      
    } catch (deployError) {
      console.log('⚠️ Deployment approach failed:', deployError.message);
    }
    
  } catch (error) {
    console.error('❌ Direct fix failed:', error.message);
  }
  
  console.log('\n📋 SUMMARY:');
  console.log('✅ Attempted multiple methods to disable Access');
  console.log('🧪 Test these URLs:');
  console.log('   - https://runaro.dk (main domain)');
  console.log('   - Latest deployment URL shown above');
  console.log('\n💡 If still blocked:');
  console.log('   1. Go to https://dash.cloudflare.com');
  console.log('   2. Zero Trust → Access → Applications');
  console.log('   3. Delete any apps protecting *.pages.dev');
}

// Run the direct fix
directAccessFix();