// Script to fix email redirect URL issue
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔧 Fixing email redirect URL configuration...\n');

async function diagnoseRedirectProblem() {
  console.log('1. 🔍 Diagnosing redirect URL problem...');
  
  try {
    // Test signup with different redirect options
    const testEmail = `test-redirect-${Date.now()}@gmail.com`;
    console.log(`   Testing with email: ${testEmail}`);
    
    console.log('\n   📧 Testing signup with explicit redirect URL...');
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          username: 'testuser',
          display_name: 'Test User',
          age: 25
        },
        emailRedirectTo: 'https://runaro.dk/auth'
      }
    });
    
    if (error) {
      console.log('   ❌ Signup failed:', error.message);
      return false;
    }
    
    console.log('   ✅ Signup successful');
    console.log(`   User created: ${!!data.user}`);
    console.log(`   User ID: ${data.user?.id}`);
    
    if (data.user) {
      console.log('\n   🧹 Cleaning up test user...');
      await supabase.auth.admin.deleteUser(data.user.id);
    }
    
    return true;
    
  } catch (error) {
    console.log('   ❌ Diagnosis error:', error.message);
    return false;
  }
}

async function checkAuthConfiguration() {
  console.log('\n2. ⚙️ Checking Auth configuration...');
  
  try {
    // Try different endpoints to check current configuration
    const endpoints = [
      `${SUPABASE_URL}/auth/v1/settings`,
      `${SUPABASE_URL}/rest/v1/auth.config`
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n   🔍 Checking: ${endpoint}`);
      
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
            'Content-Type': 'application/json'
          }
        });
        
        console.log(`   Status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.text();
          console.log(`   Response: ${data.substring(0, 200)}...`);
        } else {
          const error = await response.text();
          console.log(`   Error: ${error}`);
        }
      } catch (err) {
        console.log(`   Request error: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.log('   ❌ Configuration check error:', error.message);
  }
}

async function attemptAuthConfigUpdate() {
  console.log('\n3. 🛠️ Attempting to update Auth configuration...');
  
  try {
    // Try to update auth configuration via GoTrue API
    const configUpdate = {
      SITE_URL: 'https://runaro.dk',
      URI_ALLOW_LIST: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback,https://runaro.dk/',
      REDIRECT_URL: 'https://runaro.dk/auth',
      MAILER_AUTOCONFIRM: false,
      EXTERNAL_EMAIL_ENABLED: true
    };
    
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(configUpdate)
    });
    
    console.log(`   Update response status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('   ✅ Configuration updated successfully!');
      console.log('   New settings:', JSON.stringify(result, null, 2));
      return true;
    } else {
      const error = await response.text();
      console.log('   ❌ Configuration update failed:', error);
      return false;
    }
    
  } catch (error) {
    console.log('   ❌ Update error:', error.message);
    return false;
  }
}

async function createManualInstructions() {
  console.log('\n4. 📋 Creating manual fix instructions...');
  
  console.log('\n   🎯 MANUAL FIX REQUIRED:');
  console.log('   ======================');
  
  console.log('\n   1. Gå til Supabase Dashboard:');
  console.log('      https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
  
  console.log('\n   2. Authentication → Settings → URL Configuration:');
  console.log('      - Site URL: https://runaro.dk');
  console.log('      - Additional Redirect URLs:');
  console.log('        * https://runaro.dk');
  console.log('        * https://runaro.dk/auth');
  console.log('        * https://runaro.dk/auth/callback');
  
  console.log('\n   3. Authentication → Templates → Confirm signup:');
  console.log('      - Bekræft at "Confirmation URL" indeholder:');
  console.log('        {{ .SiteURL }}/auth#access_token={{ .Token }}&type=signup');
  console.log('      - ELLER:');
  console.log('        {{ .ConfirmationURL }}');
  
  console.log('\n   4. Save alle ændringer');
  
  console.log('\n   🧪 EFTER KONFIGURATION:');
  console.log('   1. Slet test-brugeren du lige oprettede');
  console.log('   2. Opret brugeren igen');
  console.log('   3. Bekræftelseslinket burde nu pege på https://runaro.dk/auth');
}

async function testWithRealUser() {
  console.log('\n5. 🧪 Quick test with a real scenario...');
  
  console.log('   💡 LØSNING TIL NUVÆRENDE PROBLEM:');
  console.log('   ================================');
  
  console.log('\n   Hvis du vil teste med det nuværende link:');
  console.log('   1. Kopier dit confirmation link fra emailen');
  console.log('   2. Erstat "localhost" med "runaro.dk"');
  console.log('   3. Brug det redigerede link i browseren');
  console.log('\n   Eksempel:');
  console.log('   FRA: http://localhost:3000/auth#access_token=...');
  console.log('   TIL:  https://runaro.dk/auth#access_token=...');
  
  console.log('\n   Dette vil virke indtil vi får fixet konfigurationen! 🚀');
}

// Main execution
async function main() {
  const diagnosed = await diagnoseRedirectProblem();
  await checkAuthConfiguration();
  const updated = await attemptAuthConfigUpdate();
  await createManualInstructions();
  await testWithRealUser();
  
  console.log('\n🏁 SAMMENFATNING:');
  console.log('================');
  
  if (updated) {
    console.log('✅ Auth konfiguration opdateret automatisk!');
    console.log('   Prøv at oprette en ny bruger - linket burde nu virke');
  } else {
    console.log('⚠️ Automatisk opdatering mislykkedes');
    console.log('   Manual konfiguration krævet i Supabase Dashboard');
  }
  
  console.log('\n🔧 HURTIG LØSNING (nu):');
  console.log('Redigér dit confirmation link:');
  console.log('Erstat "localhost" med "runaro.dk"');
  
  console.log('\n🎯 PERMANENT LØSNING:');
  console.log('Konfigurer Site URL i Supabase Dashboard');
}

main().catch(console.error);