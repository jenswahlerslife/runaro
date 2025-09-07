// Direct SQL-based approach to configure Auth settings
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDY5MDY0NSwiZXhwIjoyMDQwMjY2NjQ1fQ.WJT3YGOtLd4r7FPEm9UfKBSy4UqZZSRmUCE4VzqQLyc";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🔧 Attempting direct Auth configuration via SQL...\n');

async function configureAuthViaSQL() {
  try {
    console.log('1. 🗃️ Checking current auth.config...');
    
    // Try to check auth config table
    const { data: config, error: configError } = await supabase
      .from('auth.config')
      .select('*');
      
    if (configError) {
      console.log('   ❌ Cannot access auth.config directly:', configError.message);
    } else {
      console.log('   ✅ Auth config accessible:', config);
    }

    console.log('\n2. 🔧 Attempting to configure auth settings...');
    
    // SQL to configure auth settings
    const authConfigSQL = `
      -- Update auth configuration for email confirmation
      UPDATE auth.config 
      SET 
        site_url = 'https://runaro.dk',
        uri_allow_list = 'https://runaro.dk/auth,https://runaro.dk/auth/callback,https://runaro.dk/',
        mailer_autoconfirm = false,
        mailer_secure_email_change_enabled = true,
        mailer_otp_exp = 86400,
        external_email_enabled = true
      WHERE true;
    `;
    
    const { data: updateResult, error: updateError } = await supabase
      .rpc('exec_sql', { sql: authConfigSQL });
      
    if (updateError) {
      console.log('   ❌ Cannot update auth config via SQL:', updateError.message);
      
      // Try alternative approach using Supabase functions
      console.log('\n3. 🔄 Trying alternative function approach...');
      
      const { data: funcResult, error: funcError } = await supabase
        .rpc('update_auth_config', {
          site_url: 'https://runaro.dk',
          uri_allow_list: 'https://runaro.dk/auth,https://runaro.dk/auth/callback,https://runaro.dk/',
          enable_email_confirmations: true
        });
        
      if (funcError) {
        console.log('   ❌ Function approach failed:', funcError.message);
        return false;
      } else {
        console.log('   ✅ Auth configured via function');
        return true;
      }
    } else {
      console.log('   ✅ Auth config updated via SQL');
      return true;
    }
  } catch (error) {
    console.log('   ❌ General error:', error.message);
    return false;
  }
}

async function createConfigFunction() {
  console.log('\n4. 🛠️ Creating helper function for Auth configuration...');
  
  const createFunctionSQL = `
    CREATE OR REPLACE FUNCTION public.configure_auth_settings()
    RETURNS TEXT AS $$
    BEGIN
      -- This function helps configure auth settings
      -- Note: Direct auth.config modifications may require superuser privileges
      
      PERFORM pg_notify('auth_config', 'Configuration requested for https://runaro.dk');
      
      RETURN 'Auth configuration function created. Manual dashboard configuration may still be required.';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  const { data, error } = await supabase
    .rpc('exec', { query: createFunctionSQL });
    
  if (error) {
    console.log('   ❌ Could not create function:', error.message);
    return false;
  } else {
    console.log('   ✅ Helper function created');
    return true;
  }
}

async function testCurrentAuthSettings() {
  console.log('\n5. 🧪 Testing current auth behavior...');
  
  try {
    // Try a test signup to see current behavior
    const testEmail = 'test-' + Date.now() + '@example.com';
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'testpassword123',
      options: {
        emailRedirectTo: 'https://runaro.dk/auth'
      }
    });
    
    if (error) {
      console.log('   ❌ Test signup failed:', error.message);
      return false;
    } else {
      console.log('   ✅ Test signup successful');
      console.log('   User created:', !!data.user);
      console.log('   Session created:', !!data.session);
      console.log('   Needs confirmation:', !data.session && !!data.user);
      
      // Clean up test user
      if (data.user) {
        await supabase.auth.admin.deleteUser(data.user.id);
        console.log('   🧹 Test user cleaned up');
      }
      
      return true;
    }
  } catch (error) {
    console.log('   ❌ Test error:', error.message);
    return false;
  }
}

// Run configuration
async function main() {
  const configured = await configureAuthViaSQL();
  const functionCreated = await createConfigFunction();
  const tested = await testCurrentAuthSettings();
  
  if (configured) {
    console.log('\n🎉 SUCCESS! Auth settings have been configured automatically.');
    console.log('\n✅ KONFIGURATION COMPLETERET:');
    console.log('   - Site URL: https://runaro.dk');
    console.log('   - Redirect URLs: https://runaro.dk/auth, https://runaro.dk/auth/callback');
    console.log('   - Email confirmation: Aktiveret');
    console.log('   - Built-in email provider: Aktiveret');
    
    console.log('\n🧪 TEST NU:');
    console.log('1. Gå til https://runaro.dk/auth');
    console.log('2. Opret en bruger med din email');
    console.log('3. Tjek din email (inkl. spam folder)');
    console.log('4. Klik på bekræftelseslinket');
    
  } else {
    console.log('\n❌ Automatisk konfiguration mislykkedes.');
    console.log('\n📋 MANUAL OPSÆTNING KRÆVET:');
    console.log('Gå til: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
    console.log('1. Authentication → Settings → URL Configuration');
    console.log('   - Site URL: https://runaro.dk');
    console.log('   - Additional Redirect URLs: https://runaro.dk/auth');
    console.log('2. Authentication → Providers → Email');
    console.log('   - Enable "Confirm email"');
    console.log('   - Use "Supabase" provider for simplest setup');
  }
  
  console.log('\n🏁 Configuration attempt completed.');
}

main().catch(console.error);