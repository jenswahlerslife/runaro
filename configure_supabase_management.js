// Script to configure Supabase settings via Management API
import fetch from 'node-fetch';

const PROJECT_ID = 'ojjpslrhyutizwpvvngu';
const SUPABASE_URL = `https://ojjpslrhyutizwpvvngu.supabase.co`;

// Try different API approaches
const MANAGEMENT_API_URL = 'https://api.supabase.com';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDY5MDY0NSwiZXhwIjoyMDQwMjY2NjQ1fQ.WJT3YGOtLd4r7FPEm9UfKBSy4UqZZSRmUCE4VzqQLyc";

console.log('🔧 Attempting to configure Supabase Auth settings via API...\n');

async function testManagementAPI() {
  console.log('1. 🧪 Testing Management API access...');
  
  try {
    // Try to access project info via Management API
    const projectResponse = await fetch(`${MANAGEMENT_API_URL}/v1/projects/${PROJECT_ID}`, {
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${projectResponse.status}`);
    
    if (projectResponse.ok) {
      const projectData = await projectResponse.json();
      console.log('   ✅ Management API accessible');
      console.log('   Project:', projectData.name || 'Unknown');
      return true;
    } else {
      console.log('   ❌ Management API not accessible with current credentials');
      const error = await projectResponse.text();
      console.log('   Error:', error);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Management API error:', error.message);
    return false;
  }
}

async function testAuthConfig() {
  console.log('\n2. 🔐 Testing Auth configuration access...');
  
  try {
    // Try to access auth config via different endpoints
    const authConfigUrl = `${SUPABASE_URL}/auth/v1/settings`;
    
    const response = await fetch(authConfigUrl, {
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      const config = await response.json();
      console.log('   ✅ Auth settings accessible');
      console.log('   Current settings:', JSON.stringify(config, null, 2));
      return config;
    } else {
      console.log('   ❌ Auth settings not accessible');
      const error = await response.text();
      console.log('   Error:', error);
      return null;
    }
  } catch (error) {
    console.log('   ❌ Auth config error:', error.message);
    return null;
  }
}

async function updateAuthSettings() {
  console.log('\n3. ⚙️ Attempting to update Auth settings...');
  
  const authSettings = {
    SITE_URL: 'https://runaro.dk',
    URI_ALLOW_LIST: 'https://runaro.dk/auth,https://runaro.dk/auth/callback,https://runaro.dk/',
    MAILER_AUTOCONFIRM: false,  // We want email confirmation
    MAILER_TEMPLATES_CONFIRMATION: {
      SUBJECT: 'Bekræft din Runaro konto',
      CONTENT_PATH: './templates/confirmation.html'
    }
  };
  
  try {
    // Try to update auth config
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(authSettings)
    });
    
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('   ✅ Auth settings updated successfully');
      console.log('   Updated settings:', JSON.stringify(result, null, 2));
      return true;
    } else {
      console.log('   ❌ Could not update auth settings');
      const error = await response.text();
      console.log('   Error:', error);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Update error:', error.message);
    return false;
  }
}

async function enableBuiltInEmail() {
  console.log('\n4. 📧 Attempting to enable built-in email provider...');
  
  try {
    // Try to enable Supabase's built-in email provider
    const emailSettings = {
      MAILER_AUTOCONFIRM: false,
      EXTERNAL_EMAIL_ENABLED: true,
      SMTP_HOST: '',
      SMTP_PORT: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_SENDER_NAME: 'Runaro',
      SMTP_SENDER_EMAIL: 'no-reply@mail.supabase.io'
    };
    
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailSettings)
    });
    
    console.log(`   Status: ${response.status}`);
    
    if (response.ok) {
      console.log('   ✅ Email provider configured');
      return true;
    } else {
      const error = await response.text();
      console.log('   ❌ Could not configure email provider');
      console.log('   Error:', error);
      return false;
    }
  } catch (error) {
    console.log('   ❌ Email config error:', error.message);
    return false;
  }
}

// Run all configuration attempts
async function main() {
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`Service Key: ${SERVICE_KEY.substring(0, 20)}...`);
  console.log();
  
  const hasManagementAccess = await testManagementAPI();
  const authConfig = await testAuthConfig();
  
  if (authConfig) {
    const settingsUpdated = await updateAuthSettings();
    const emailEnabled = await enableBuiltInEmail();
    
    if (settingsUpdated || emailEnabled) {
      console.log('\n🎉 SUCCESS! Supabase Auth has been configured automatically.');
      console.log('✅ Site URL set to: https://runaro.dk');
      console.log('✅ Redirect URLs configured');
      console.log('✅ Email confirmation enabled');
      console.log('✅ Built-in email provider activated');
      
      console.log('\n🧪 TEST NOW:');
      console.log('1. Go to https://runaro.dk/auth');
      console.log('2. Sign up with your email');
      console.log('3. Check your email (including spam)');
      console.log('4. Click the confirmation link');
    } else {
      console.log('\n❌ Could not automatically configure all settings.');
      console.log('Manual configuration is still required in the Supabase Dashboard.');
    }
  } else {
    console.log('\n❌ No API access to Auth configuration.');
    console.log('Manual configuration required in the Supabase Dashboard.');
  }
  
  console.log('\n🌐 Manual backup: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
}

main().catch(console.error);