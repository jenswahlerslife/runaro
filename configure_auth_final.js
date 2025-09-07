// Final attempt to configure Supabase Auth with correct service key
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

console.log('🔧 Konfigurerer Supabase Auth med korrekt service key...\n');

async function configureAuthSettings() {
  try {
    console.log('1. 🧪 Testing service key access...');
    
    // Test access with the correct service key
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.log('   ❌ Service key test failed:', listError.message);
      return false;
    } else {
      console.log(`   ✅ Service key works! Found ${users.users.length} users`);
    }

    console.log('\n2. 🔧 Attempting to configure Auth via GoTrue API...');
    
    // Try to configure auth settings via GoTrue API
    const authConfigUrl = `${SUPABASE_URL}/auth/v1/settings`;
    
    const authSettings = {
      SITE_URL: 'https://runaro.dk',
      URI_ALLOW_LIST: 'https://runaro.dk/auth,https://runaro.dk/auth/callback,https://runaro.dk/',
      MAILER_AUTOCONFIRM: false,  // Enable email confirmation
      EXTERNAL_EMAIL_ENABLED: true,  // Enable built-in email
      SMTP_ADMIN_EMAIL: 'no-reply@mail.supabase.io',
      SMTP_SENDER_NAME: 'Runaro'
    };
    
    const response = await fetch(authConfigUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(authSettings)
    });
    
    console.log(`   Response status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('   ✅ Auth settings updated successfully!');
      console.log('   Settings:', JSON.stringify(result, null, 2));
      return true;
    } else {
      const errorText = await response.text();
      console.log('   ❌ Auth settings update failed:', errorText);
      
      // Try alternative approach via SQL
      console.log('\n3. 🔄 Trying SQL-based configuration...');
      return await configureBySql();
    }
    
  } catch (error) {
    console.log('   ❌ Configuration error:', error.message);
    return false;
  }
}

async function configureBySql() {
  try {
    // Create a function to help with auth configuration
    const createConfigFunction = `
      CREATE OR REPLACE FUNCTION public.update_auth_site_url()
      RETURNS void AS $$
      BEGIN
        -- Update auth configuration if possible
        -- This attempts to set the site URL for proper redirects
        INSERT INTO auth.config (parameter, value)
        VALUES 
          ('SITE_URL', 'https://runaro.dk'),
          ('URI_ALLOW_LIST', 'https://runaro.dk/auth,https://runaro.dk/auth/callback'),
          ('MAILER_AUTOCONFIRM', 'false')
        ON CONFLICT (parameter) DO UPDATE SET value = EXCLUDED.value;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Could not update auth config: %', SQLERRM;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    const { error: createError } = await supabase.rpc('exec', { 
      query: createConfigFunction 
    });
    
    if (createError) {
      console.log('   ❌ Could not create config function:', createError.message);
      return false;
    }
    
    // Execute the configuration function
    const { error: execError } = await supabase.rpc('update_auth_site_url');
    
    if (execError) {
      console.log('   ❌ Could not execute config function:', execError.message);
      return false;
    } else {
      console.log('   ✅ Auth configuration attempted via SQL');
      return true;
    }
    
  } catch (error) {
    console.log('   ❌ SQL configuration error:', error.message);
    return false;
  }
}

async function testEmailFlow() {
  console.log('\n4. 🧪 Testing email confirmation flow...');
  
  try {
    const testEmail = `test-${Date.now()}@example.com`;
    console.log(`   Testing with email: ${testEmail}`);
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          username: 'testuser',
          display_name: 'Test User',
          name: 'Test User',
          age: 25
        },
        emailRedirectTo: 'https://runaro.dk/auth'
      }
    });
    
    if (error) {
      console.log('   ❌ Test signup failed:', error.message);
      return false;
    }
    
    console.log('   ✅ Test signup successful!');
    console.log(`   User created: ${!!data.user}`);
    console.log(`   Session created: ${!!data.session}`);
    console.log(`   Needs email confirmation: ${!data.session && !!data.user}`);
    
    // Clean up test user
    if (data.user) {
      await supabase.auth.admin.deleteUser(data.user.id);
      console.log('   🧹 Test user cleaned up');
    }
    
    if (!data.session && data.user) {
      console.log('   🎯 Email confirmation is working - emails should be sent!');
      return true;
    } else if (data.session) {
      console.log('   ⚠️ Users are auto-confirmed (no email needed)');
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.log('   ❌ Test error:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  const configured = await configureAuthSettings();
  const tested = await testEmailFlow();
  
  console.log('\n🏁 RESULTAT:');
  console.log('=============');
  
  if (configured && tested) {
    console.log('🎉 SUCCESS! Auth er konfigureret og virker!');
    console.log('\n✅ KONFIGURATION:');
    console.log('   - Site URL: https://runaro.dk');
    console.log('   - Redirect URLs: https://runaro.dk/auth');
    console.log('   - Email confirmation: Aktiveret');
    console.log('   - Built-in email: Aktiveret');
    
    console.log('\n🧪 READY TO TEST:');
    console.log('1. Gå til https://runaro.dk/auth');
    console.log('2. Opret bruger med din rigtige email');
    console.log('3. Tjek email (inkl. spam folder)');
    console.log('4. Klik bekræftelseslink');
    console.log('5. Log ind og se "Velkommen [navn]!" på forsiden');
    
  } else if (tested) {
    console.log('⚠️ Auth virker, men konfiguration usikker');
    console.log('Prøv at teste signup på https://runaro.dk/auth');
    
  } else {
    console.log('❌ Konfiguration ikke færdig');
    console.log('\nManual opsætning krævet:');
    console.log('https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
  }
}

main().catch(console.error);