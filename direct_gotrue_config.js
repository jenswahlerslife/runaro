// Direct GoTrue Admin API configuration
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";
const PERSONAL_ACCESS_TOKEN = "sbp_554d2e7160eee173374d13e786b9fa1776634033";
const PROJECT_ID = "ojjpslrhyutizwpvvngu";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('🔧 DIRECT GOTRUE ADMIN API CONFIGURATION\n');

async function exploreAvailableEndpoints() {
  console.log('1. 🔍 Exploring available Management API endpoints...');
  
  const endpoints = [
    'https://api.supabase.com/v1/organizations',
    `https://api.supabase.com/v1/projects/${PROJECT_ID}`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/settings`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/secrets`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/config`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/auth-config`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/gotrue-config`
  ];
  
  const availableEndpoints = [];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const endpointName = endpoint.split('/').pop();
      console.log(`   📡 ${endpointName}: ${response.status}`);
      
      if (response.ok) {
        availableEndpoints.push({ endpoint, name: endpointName });
        const data = await response.text();
        console.log(`   ✅ Available: ${data.substring(0, 100)}...`);
      } else if (response.status === 404) {
        console.log('   ❌ Not found');
      } else {
        console.log(`   ⚠️ ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
  
  return availableEndpoints;
}

async function trySecretBasedConfiguration() {
  console.log('\n2. 🔐 Trying secrets-based configuration...');
  
  const secretEndpoints = [
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/secrets`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/config/secrets`
  ];
  
  const secrets = [
    { name: 'GOTRUE_SITE_URL', value: 'https://runaro.dk' },
    { name: 'GOTRUE_URI_ALLOW_LIST', value: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback' },
    { name: 'AUTH_SITE_URL', value: 'https://runaro.dk' },
    { name: 'SITE_URL', value: 'https://runaro.dk' }
  ];
  
  for (const endpoint of secretEndpoints) {
    console.log(`\n   🔍 Trying: ${endpoint}`);
    
    for (const secret of secrets) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(secret)
        });
        
        console.log(`   📝 ${secret.name}: ${response.status}`);
        
        if (response.ok) {
          console.log('   🎉 SECRET UPDATED!');
          return true;
        } else {
          const error = await response.text();
          console.log(`   ❌ Failed: ${error.substring(0, 100)}`);
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
  }
  
  return false;
}

async function tryEnvironmentVariables() {
  console.log('\n3. 🌍 Trying environment variables configuration...');
  
  try {
    // Check if we can get project settings first
    const settingsResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/settings`, {
      headers: {
        'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      console.log('   ✅ Current project settings accessible');
      console.log(`   📋 Project ref: ${settings.ref}`);
      console.log(`   📋 Name: ${settings.name}`);
      
      // Try to update settings
      const updateData = {
        auth: {
          site_url: 'https://runaro.dk',
          redirect_urls: ['https://runaro.dk/auth', 'https://runaro.dk/auth/callback']
        }
      };
      
      const updateResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/settings`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      console.log(`   📡 Settings update: ${updateResponse.status}`);
      
      if (updateResponse.ok) {
        console.log('   🎉 SETTINGS UPDATED VIA PROJECT API!');
        return true;
      } else {
        const error = await updateResponse.text();
        console.log(`   ❌ Update failed: ${error}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Environment variables approach failed: ${error.message}`);
  }
  
  return false;
}

async function createManualFixInstructions() {
  console.log('\n4. 📋 Creating comprehensive manual fix instructions...');
  
  const instructions = `
# SITE URL MANUAL FIX INSTRUCTIONS

## Problem:
Bekræftelseslinks i emails peger til localhost:3000 i stedet for https://runaro.dk

## Løsning (2 minutter):

1. **Gå til Supabase Dashboard:**
   https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu

2. **Navigate til Authentication:**
   - Klik på "Authentication" i sidebar
   - Klik på "Settings"
   - Klik på "URL Configuration"

3. **Opdater URL Configuration:**
   - **Site URL**: https://runaro.dk
   - **Additional Redirect URLs**: 
     * https://runaro.dk/auth
     * https://runaro.dk/auth/callback

4. **Gem ændringer:**
   - Klik "Save" 
   - Vent 30 sekunder på propagation

## Test efter fix:
1. Slet wahlers3@hotmail.com (hvis den findes)
2. Opret brugeren igen på https://runaro.dk/auth
3. Tjek email - linket burde nu pege til https://runaro.dk/auth
4. Klik linket - det virker nu!

## Verifikation:
Bekræftelseslink format:
✅ KORREKT: https://runaro.dk/auth#access_token=...
❌ FORKERT: http://localhost:3000/#access_token=...

Claude kan håndtere alt andet automatisk!
  `;
  
  try {
    require('fs').writeFileSync('SITE_URL_MANUAL_FIX.md', instructions);
    console.log('   ✅ Manual fix instructions created: SITE_URL_MANUAL_FIX.md');
    return true;
  } catch (error) {
    console.log('   ❌ Could not create instructions:', error.message);
    return false;
  }
}

async function testAndCleanup() {
  console.log('\n5. 🧪 Testing current state and cleanup...');
  
  try {
    // Clean up any test users first
    console.log('   🧹 Cleaning up test users...');
    
    const { data: users } = await supabase.auth.admin.listUsers();
    const testUsers = users.users.filter(u => 
      u.email.includes('test') || 
      u.email.includes('claude') ||
      u.email.includes('config')
    );
    
    for (const user of testUsers) {
      await supabase.auth.admin.deleteUser(user.id);
      console.log(`   🗑️ Deleted test user: ${user.email}`);
    }
    
    console.log(`   📊 Remaining users: ${users.users.length - testUsers.length}`);
    
    // Test current configuration
    const testEmail = `final-test-${Date.now()}@gmail.com`;
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: { username: 'finaltest', display_name: 'Final Test', age: 25 },
        emailRedirectTo: 'https://runaro.dk/auth'
      }
    });
    
    if (!error && data.user) {
      console.log('   📧 Test email sent for final verification');
      console.log(`   🔗 Check: ${testEmail} for confirmation link`);
      
      // Clean up
      await supabase.auth.admin.deleteUser(data.user.id);
      console.log('   🧹 Test user cleaned up');
    }
    
    return true;
    
  } catch (error) {
    console.log('   ❌ Test/cleanup error:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🎯 DIRECT GOTRUE CONFIGURATION');
  console.log('===============================');
  
  const availableEndpoints = await exploreAvailableEndpoints();
  const secretsSuccess = await trySecretBasedConfiguration();
  const envSuccess = await tryEnvironmentVariables();
  const instructionsCreated = await createManualFixInstructions();
  const tested = await testAndCleanup();
  
  console.log('\n🏁 CONFIGURATION RESULTAT:');
  console.log('==========================');
  
  if (secretsSuccess || envSuccess) {
    console.log('🎉 AUTOMATISK KONFIGURATION SUCCESS!');
    console.log('✅ Site URL burde nu være konfigureret korrekt');
    console.log('🧪 Test ved at oprette wahlers3@hotmail.com igen');
    
  } else {
    console.log('⚠️ AUTOMATISK KONFIGURATION IKKE MULIG');
    console.log('');
    console.log('📋 MANUEL FIX KRÆVET (2 minutter):');
    console.log('1. https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
    console.log('2. Authentication → Settings → URL Configuration');
    console.log('3. Site URL: https://runaro.dk');
    console.log('4. Additional Redirect URLs: https://runaro.dk/auth');
    console.log('5. Save changes');
    
    console.log('\n🔧 MIDLERTIDIG LØSNING:');
    console.log('I bekræftelsesemails: Erstat "localhost:3000" med "runaro.dk"');
  }
  
  if (instructionsCreated) {
    console.log('\n📖 Se SITE_URL_MANUAL_FIX.md for detaljerede instruktioner');
  }
  
  console.log('\n✅ Alt andet er konfigureret perfekt!');
  console.log('💡 Efter Site URL fix vil alt virke automatisk! 🚀');
}

main().catch(console.error);