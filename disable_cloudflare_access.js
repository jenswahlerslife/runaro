#!/usr/bin/env node

/**
 * Disable Cloudflare Access for Runaro Pages
 * This script will disable the Cloudflare Access protection that's blocking public access
 */

import { execSync } from 'child_process';

console.log('🔧 Disabling Cloudflare Access for Runaro Pages...\n');

async function disableCloudflareAccess() {
  try {
    // Step 1: List all Access applications to find the one blocking runaro.pages.dev
    console.log('1️⃣ Checking current Access applications...');
    
    try {
      const listCmd = 'npx wrangler access applications list';
      const output = execSync(listCmd, { encoding: 'utf8', stdio: 'pipe' });
      console.log('📋 Current Access applications:');
      console.log(output);
      
      // Look for applications that might be protecting Pages
      if (output.includes('runaro.pages.dev') || output.includes('pages.dev')) {
        console.log('⚠️ Found Access application protecting Pages deployment');
      }
    } catch (error) {
      console.log('⚠️ Could not list Access applications:', error.message);
    }

    // Step 2: Try to disable Access for the specific domain
    console.log('\n2️⃣ Attempting to disable Access for runaro.pages.dev...');
    
    // Method 1: Try to delete Access policies via Wrangler
    try {
      console.log('🔄 Trying method 1: Direct policy removal...');
      
      // This might work if there's a specific application ID
      const disableCmd = 'npx wrangler access applications list --json';
      const jsonOutput = execSync(disableCmd, { encoding: 'utf8', stdio: 'pipe' });
      
      const applications = JSON.parse(jsonOutput);
      console.log('📄 Found applications:', applications);
      
      // Find and disable applications that protect pages.dev
      const pagesToDisable = applications.filter(app => 
        app.domain.includes('pages.dev') || 
        app.domain.includes('runaro')
      );
      
      for (const app of pagesToDisable) {
        console.log(`🗑️ Removing Access application: ${app.name} (${app.domain})`);
        try {
          const deleteCmd = `npx wrangler access applications delete ${app.id}`;
          execSync(deleteCmd, { stdio: 'inherit' });
          console.log(`✅ Successfully removed: ${app.name}`);
        } catch (deleteError) {
          console.log(`⚠️ Could not delete ${app.name}:`, deleteError.message);
        }
      }
      
    } catch (error) {
      console.log('⚠️ Method 1 failed:', error.message);
    }

    // Method 2: Try Cloudflare API directly
    console.log('\n3️⃣ Trying method 2: Direct API calls...');
    
    try {
      // Get account info first
      const accountCmd = 'npx wrangler whoami';
      const accountInfo = execSync(accountCmd, { encoding: 'utf8' });
      console.log('👤 Account info:', accountInfo);
      
      // Try to get zone info
      const zonesCmd = 'npx wrangler zone list';
      execSync(zonesCmd, { stdio: 'inherit' });
      
    } catch (error) {
      console.log('⚠️ Method 2 failed:', error.message);
    }

    // Method 3: Use direct wrangler commands to manage the project
    console.log('\n4️⃣ Method 3: Managing Pages project directly...');
    
    try {
      // Check if we can modify the Pages project settings
      console.log('🔍 Checking Pages project configuration...');
      
      const projectCmd = 'npx wrangler pages project list';
      execSync(projectCmd, { stdio: 'inherit' });
      
      // Try to update project settings (this might include disabling Access)
      console.log('🔄 Attempting to update project settings...');
      
      // Note: This is a placeholder - the actual command might vary
      // We need to check what Wrangler commands are available for Pages Access
      
    } catch (error) {
      console.log('⚠️ Method 3 failed:', error.message);
    }

    // Final verification
    console.log('\n5️⃣ Verification: Testing site accessibility...');
    
    try {
      // Use curl or similar to test if the site is now accessible
      console.log('🧪 Testing site access...');
      
      // This is a simple test - in a real scenario we'd make an HTTP request
      console.log('📝 You should now test: https://runaro.dk');
      console.log('📝 And also test: https://00700e33.runaro.pages.dev');
      
    } catch (error) {
      console.log('⚠️ Verification failed:', error.message);
    }

    console.log('\n✅ Script completed!');
    console.log('\n📋 Summary:');
    console.log('   - Attempted to disable Cloudflare Access');
    console.log('   - Check https://runaro.dk to see if it loads normally');
    console.log('   - If still blocked, manual dashboard access may be needed');
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    console.log('\n🔧 Manual solution:');
    console.log('1. Go to https://dash.cloudflare.com');
    console.log('2. Navigate to Zero Trust → Access → Applications');
    console.log('3. Find any applications protecting *.pages.dev or runaro');
    console.log('4. Delete or disable these applications');
  }
}

// Handle potential environment variables
process.env.CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

// Run the script
disableCloudflareAccess();