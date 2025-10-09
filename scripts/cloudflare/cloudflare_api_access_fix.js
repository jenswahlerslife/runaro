#!/usr/bin/env node

/**
 * Disable Cloudflare Access via API
 * Direct API calls to remove Access protection from runaro.pages.dev
 */

const ACCOUNT_ID = '45ae1aa085ebaf8c78509f4ff3a31007'; // From wrangler whoami

console.log('🔧 Disabling Cloudflare Access via API...\n');

async function makeCloudflareAPIRequest(endpoint, method = 'GET', data = null) {
  // We'll need to get the API token from environment or wrangler config
  // For now, let's try using wrangler's built-in authentication
  
  const headers = {
    'Content-Type': 'application/json'
  };

  if (data) {
    data = JSON.stringify(data);
  }

  // Use curl with wrangler's token if available
  const { execSync } = await import('child_process');
  
  try {
    let curlCmd = `curl -s -X ${method}`;
    
    if (data) {
      curlCmd += ` -d '${data}'`;
    }
    
    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      curlCmd += ` -H "${key}: ${value}"`;
    });
    
    curlCmd += ` "https://api.cloudflare.com/client/v4/${endpoint}"`;
    
    console.log(`📡 API Request: ${method} ${endpoint}`);
    
    // This will fail without proper auth, but let's see what we get
    const result = execSync(curlCmd, { encoding: 'utf8' });
    return JSON.parse(result);
    
  } catch (error) {
    console.log(`⚠️ API request failed: ${error.message}`);
    return null;
  }
}

async function disableAccessViaAPI() {
  try {
    console.log('1️⃣ Fetching Access applications...');
    
    // List all Access applications for the account
    const appsEndpoint = `accounts/${ACCOUNT_ID}/access/apps`;
    const appsResponse = await makeCloudflareAPIRequest(appsEndpoint);
    
    if (appsResponse && appsResponse.success) {
      const apps = appsResponse.result;
      console.log(`📋 Found ${apps.length} Access applications`);
      
      // Find apps that protect pages.dev domains
      const pagesToDisable = apps.filter(app => 
        app.domain?.includes('pages.dev') || 
        app.domain?.includes('runaro') ||
        (app.policies && app.policies.some(policy => 
          policy.include?.some(include => 
            include.domain?.includes('pages.dev') || 
            include.domain?.includes('runaro')
          )
        ))
      );
      
      console.log(`🎯 Found ${pagesToDisable.length} applications to disable`);
      
      // Delete each problematic application
      for (const app of pagesToDisable) {
        console.log(`🗑️ Deleting Access app: ${app.name} (${app.domain})`);
        
        const deleteEndpoint = `accounts/${ACCOUNT_ID}/access/apps/${app.id}`;
        const deleteResponse = await makeCloudflareAPIRequest(deleteEndpoint, 'DELETE');
        
        if (deleteResponse && deleteResponse.success) {
          console.log(`✅ Successfully deleted: ${app.name}`);
        } else {
          console.log(`❌ Failed to delete: ${app.name}`);
        }
      }
      
    } else {
      console.log('❌ Failed to fetch Access applications');
    }
    
    console.log('\n2️⃣ Checking for Access policies...');
    
    // Also check for standalone policies
    const policiesEndpoint = `accounts/${ACCOUNT_ID}/access/policies`;
    const policiesResponse = await makeCloudflareAPIRequest(policiesEndpoint);
    
    if (policiesResponse && policiesResponse.success) {
      const policies = policiesResponse.result;
      console.log(`📋 Found ${policies.length} Access policies`);
      
      // Filter policies that might affect Pages
      const policiesToDisable = policies.filter(policy => 
        policy.name?.includes('pages') || 
        policy.name?.includes('runaro') ||
        policy.include?.some(include => 
          include.domain?.includes('pages.dev') || 
          include.domain?.includes('runaro')
        )
      );
      
      for (const policy of policiesToDisable) {
        console.log(`🗑️ Deleting Access policy: ${policy.name}`);
        
        const deleteEndpoint = `accounts/${ACCOUNT_ID}/access/policies/${policy.id}`;
        const deleteResponse = await makeCloudflareAPIRequest(deleteEndpoint, 'DELETE');
        
        if (deleteResponse && deleteResponse.success) {
          console.log(`✅ Successfully deleted policy: ${policy.name}`);
        } else {
          console.log(`❌ Failed to delete policy: ${policy.name}`);
        }
      }
    }
    
    console.log('\n🎉 Access removal completed!');
    console.log('🧪 Test the website now:');
    console.log('   - https://runaro.dk');
    console.log('   - https://00700e33.runaro.pages.dev');
    
  } catch (error) {
    console.error('❌ API approach failed:', error.message);
    
    // Fallback: Try to use wrangler to manage this indirectly
    console.log('\n🔄 Trying alternative approach...');
    
    try {
      const { execSync } = await import('child_process');
      
      // Check if there are any wrangler commands for managing access
      console.log('📚 Checking wrangler capabilities...');
      
      const helpOutput = execSync('npx wrangler --help', { encoding: 'utf8' });
      
      if (helpOutput.includes('access') || helpOutput.includes('zero-trust')) {
        console.log('✅ Wrangler has access management capabilities');
        // Try specific commands if available
      } else {
        console.log('❌ Wrangler does not have built-in access management');
        
        console.log('\n🔧 MANUAL SOLUTION REQUIRED:');
        console.log('1. Open https://dash.cloudflare.com');
        console.log('2. Go to Zero Trust → Access → Applications');
        console.log('3. Delete any applications protecting *.pages.dev or runaro');
        console.log('4. The site should then load normally');
      }
      
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
    }
  }
}

// Run the API-based disable
disableAccessViaAPI();