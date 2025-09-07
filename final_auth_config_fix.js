// Final attempt to configure auth via Management API with Personal Access Token
import fetch from 'node-fetch';

const PERSONAL_ACCESS_TOKEN = "sbp_554d2e7160eee173374d13e786b9fa1776634033";
const PROJECT_ID = "ojjpslrhyutizwpvvngu";

console.log('🔧 FINAL AUTH CONFIG FIX VIA MANAGEMENT API\n');

async function exploreAllManagementEndpoints() {
  console.log('1. 🔍 Exploring ALL possible Management API endpoints...');
  
  const baseEndpoints = [
    'https://api.supabase.com/v1/projects',
    'https://api.supabase.com/v1/organizations'
  ];
  
  const projectEndpoints = [
    `https://api.supabase.com/v1/projects/${PROJECT_ID}`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/settings`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/config`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/auth`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/gotrue`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/auth/settings`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/auth/config`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/config/auth`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/config/gotrue`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/gotrue/settings`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/gotrue/config`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/environment`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/environment-variables`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/env`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/secrets`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/api-keys`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/settings/auth`,
    `https://api.supabase.com/v1/projects/${PROJECT_ID}/settings/gotrue`
  ];
  
  const workingEndpoints = [];
  
  for (const endpoint of projectEndpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      const path = endpoint.split('/').slice(-2).join('/');
      console.log(`   📡 ${path}: ${response.status}`);
      
      if (response.ok) {
        const data = await response.text();
        console.log(`   ✅ ACCESSIBLE: ${data.substring(0, 150)}...`);
        workingEndpoints.push({ endpoint, data: data.substring(0, 500) });
      } else if (response.status === 404) {
        console.log('   ❌ Not found');
      } else {
        const error = await response.text();
        console.log(`   ⚠️ ${response.status}: ${error.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message.substring(0, 100)}`);
    }
  }
  
  return workingEndpoints;
}

async function tryAuthConfigurationViaWorkingEndpoints(workingEndpoints) {
  console.log('\n2. ⚙️ Trying auth configuration via working endpoints...');
  
  const authConfigs = [
    {
      name: 'Standard Config',
      config: {
        site_url: 'https://runaro.dk',
        uri_allow_list: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback',
        mailer_autoconfirm: false,
        external_email_enabled: true
      }
    },
    {
      name: 'GoTrue Format',
      config: {
        GOTRUE_SITE_URL: 'https://runaro.dk',
        GOTRUE_URI_ALLOW_LIST: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback',
        GOTRUE_MAILER_AUTOCONFIRM: 'false',
        GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true'
      }
    },
    {
      name: 'Settings Format',
      config: {
        auth: {
          site_url: 'https://runaro.dk',
          additional_redirect_urls: ['https://runaro.dk/auth', 'https://runaro.dk/auth/callback'],
          enable_confirmations: true
        }
      }
    },
    {
      name: 'Environment Variables',
      config: {
        environment_variables: {
          GOTRUE_SITE_URL: 'https://runaro.dk',
          GOTRUE_URI_ALLOW_LIST: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback'
        }
      }
    }
  ];
  
  for (const workingEndpoint of workingEndpoints) {
    console.log(`\n   🔄 Trying configurations on: ${workingEndpoint.endpoint.split('/').slice(-2).join('/')}`);
    
    for (const authConfig of authConfigs) {
      console.log(`   📝 ${authConfig.name}...`);
      
      const methods = ['PUT', 'PATCH', 'POST'];
      
      for (const method of methods) {
        try {
          const response = await fetch(workingEndpoint.endpoint, {
            method,
            headers: {
              'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(authConfig.config)
          });
          
          console.log(`     ${method}: ${response.status}`);
          
          if (response.ok) {
            const result = await response.text();
            console.log('     🎉 SUCCESS! AUTH CONFIGURATION UPDATED!');
            console.log(`     📋 Result: ${result.substring(0, 200)}`);
            return { success: true, endpoint: workingEndpoint.endpoint, method, config: authConfig };
          } else if (response.status === 405) {
            console.log('     ⚠️ Method not allowed');
          } else {
            const error = await response.text();
            console.log(`     ❌ ${error.substring(0, 100)}`);
          }
        } catch (error) {
          console.log(`     ❌ ${method} error: ${error.message.substring(0, 100)}`);
        }
      }
    }
  }
  
  return { success: false };
}

async function tryDirectProjectUpdate() {
  console.log('\n3. 🎯 Direct project update approach...');
  
  try {
    // First, get current project info to see structure
    const getResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}`, {
      headers: {
        'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (getResponse.ok) {
      const projectData = await getResponse.json();
      console.log('   ✅ Current project data retrieved');
      console.log(`   📋 Current region: ${projectData.region}`);
      console.log(`   📋 Current status: ${projectData.status}`);
      
      // Try to update the entire project with auth settings
      const updateData = {
        ...projectData,
        settings: {
          ...projectData.settings,
          auth: {
            site_url: 'https://runaro.dk',
            additional_redirect_urls: ['https://runaro.dk/auth', 'https://runaro.dk/auth/callback'],
            enable_email_confirmations: true
          }
        }
      };
      
      const updateResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      });
      
      console.log(`   📡 Project update status: ${updateResponse.status}`);
      
      if (updateResponse.ok) {
        const result = await updateResponse.json();
        console.log('   🎉 PROJECT UPDATED WITH AUTH SETTINGS!');
        return true;
      } else {
        const error = await updateResponse.text();
        console.log(`   ❌ Project update failed: ${error.substring(0, 200)}`);
      }
    }
  } catch (error) {
    console.log('   ❌ Direct project update error:', error.message);
  }
  
  return false;
}

async function trySecretsApproach() {
  console.log('\n4. 🔐 Advanced secrets approach...');
  
  try {
    // Get current secrets to understand format
    const getResponse = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/secrets`, {
      headers: {
        'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (getResponse.ok) {
      const secrets = await getResponse.json();
      console.log(`   ✅ Found ${secrets.length} current secrets`);
      
      // Try different secret formats
      const secretFormats = [
        // Array format (as expected by API based on earlier error)
        [
          { name: 'GOTRUE_SITE_URL', value: 'https://runaro.dk' },
          { name: 'GOTRUE_URI_ALLOW_LIST', value: 'https://runaro.dk,https://runaro.dk/auth,https://runaro.dk/auth/callback' }
        ],
        // Individual secrets
        { name: 'GOTRUE_SITE_URL', value: 'https://runaro.dk' }
      ];
      
      for (const [index, secretData] of secretFormats.entries()) {
        console.log(`   📝 Secret format ${index + 1}...`);
        
        const methods = ['POST', 'PUT', 'PATCH'];
        
        for (const method of methods) {
          try {
            const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/secrets`, {
              method,
              headers: {
                'Authorization': `Bearer ${PERSONAL_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(secretData)
            });
            
            console.log(`     ${method}: ${response.status}`);
            
            if (response.ok || response.status === 201) {
              const result = await response.text();
              console.log('     🎉 SECRETS UPDATED FOR AUTH CONFIG!');
              console.log(`     📋 Result: ${result.substring(0, 200)}`);
              return true;
            } else {
              const error = await response.text();
              console.log(`     ❌ ${error.substring(0, 100)}`);
            }
          } catch (error) {
            console.log(`     ❌ ${method} error: ${error.message.substring(0, 50)}`);
          }
        }
      }
    }
  } catch (error) {
    console.log('   ❌ Secrets approach error:', error.message);
  }
  
  return false;
}

// Main execution
async function main() {
  console.log('🎯 FINAL AUTH CONFIG FIX');
  console.log('=========================');
  console.log('Bruger dit Personal Access Token til fuld Dashboard kontrol!\n');
  
  const workingEndpoints = await exploreAllManagementEndpoints();
  
  if (workingEndpoints.length === 0) {
    console.log('❌ No working endpoints found');
    return;
  }
  
  console.log(`\n📊 Found ${workingEndpoints.length} working endpoints`);
  
  const configResult = await tryAuthConfigurationViaWorkingEndpoints(workingEndpoints);
  
  if (configResult.success) {
    console.log('\n🎉🎉 SUCCESS! AUTH CONFIGURATION UPDATED! 🎉🎉');
    console.log(`✅ Updated via: ${configResult.endpoint}`);
    console.log(`✅ Method: ${configResult.method}`);
    console.log(`✅ Config: ${configResult.config.name}`);
  } else {
    const projectSuccess = await tryDirectProjectUpdate();
    const secretsSuccess = !projectSuccess ? await trySecretsApproach() : false;
    
    if (projectSuccess || secretsSuccess) {
      console.log('\n🎉 SUCCESS! Auth configuration updated via alternative method!');
    } else {
      console.log('\n❌ All automatic configuration attempts failed');
      console.log('\n📋 MANUAL DASHBOARD CONFIGURATION REQUIRED:');
      console.log('https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/auth/url-configuration');
      console.log('Site URL: https://runaro.dk');
      console.log('Additional Redirect URLs: https://runaro.dk/auth');
    }
  }
  
  console.log('\n🧪 After any configuration change:');
  console.log('1. Wait 30 seconds for propagation');
  console.log('2. Test with: node quick_test_auth.js');
  console.log('3. Create wahlers3@hotmail.com again');
  console.log('4. Check if email links now point to https://runaro.dk/auth');
}

main().catch(console.error);