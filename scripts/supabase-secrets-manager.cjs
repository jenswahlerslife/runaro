// Use global fetch in Node 18+ or fallback to node-fetch
const fetch = globalThis.fetch || require('node-fetch');
require('dotenv').config({ path: '.env.production' });

class SupabaseSecretsManager {
  constructor() {
    this.accessToken = process.env.SUPABASE_ACCESS_TOKEN;
    this.projectRef = process.env.SUPABASE_PROJECT_REF;
    this.baseUrl = 'https://api.supabase.com/v1';

    if (!this.accessToken || !this.projectRef) {
      throw new Error('Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF in environment');
    }
  }

  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`${method} ${url}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  // List all Edge Functions
  async listFunctions() {
    return this.makeRequest(`/projects/${this.projectRef}/functions`);
  }

  // Get secrets for a specific function
  async getFunctionSecrets(functionName) {
    return this.makeRequest(`/projects/${this.projectRef}/functions/${functionName}/secrets`);
  }

  // Set secrets for a specific function
  async setFunctionSecrets(functionName, secrets) {
    const body = {
      secrets: Object.entries(secrets).map(([name, value]) => ({ name, value }))
    };
    return this.makeRequest(`/projects/${this.projectRef}/functions/${functionName}/secrets`, 'POST', body);
  }

  // Deploy a function (trigger redeploy)
  async deployFunction(functionName) {
    return this.makeRequest(`/projects/${this.projectRef}/functions/${functionName}/deploy`, 'POST');
  }

  // Get function details
  async getFunctionDetails(functionName) {
    return this.makeRequest(`/projects/${this.projectRef}/functions/${functionName}`);
  }

  // Helper: Set standard Runaro secrets for any function
  async setRunaroSecrets(functionName, additionalSecrets = {}) {
    const standardSecrets = {
      SUPABASE_URL: process.env.VITE_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...additionalSecrets
    };

    console.log(`Setting secrets for ${functionName}:`);
    Object.keys(standardSecrets).forEach(key => {
      const value = standardSecrets[key];
      const displayValue = value && value.length > 20 ? `${value.substring(0, 20)}...` : value;
      console.log(`  ${key}: ${displayValue}`);
    });

    return this.setFunctionSecrets(functionName, standardSecrets);
  }
}

// Command line interface
async function main() {
  const manager = new SupabaseSecretsManager();
  const command = process.argv[2];
  const functionName = process.argv[3];

  try {
    switch (command) {
      case 'list':
        const functions = await manager.listFunctions();
        console.log('Edge Functions:');
        functions.forEach(func => {
          console.log(`  - ${func.name} (${func.status})`);
        });
        break;

      case 'secrets':
        if (!functionName) {
          console.error('Usage: node supabase-secrets-manager.cjs secrets <function-name>');
          process.exit(1);
        }
        const secrets = await manager.getFunctionSecrets(functionName);
        console.log(`Secrets for ${functionName}:`);
        secrets.forEach(secret => {
          console.log(`  ${secret.name}: [HIDDEN]`);
        });
        break;

      case 'set-runaro':
        if (!functionName) {
          console.error('Usage: node supabase-secrets-manager.cjs set-runaro <function-name> [EXTRA_KEY=value]');
          process.exit(1);
        }

        // Parse additional secrets from command line
        const extraSecrets = {};
        for (let i = 4; i < process.argv.length; i++) {
          const [key, value] = process.argv[i].split('=');
          if (key && value) {
            extraSecrets[key] = value;
          }
        }

        await manager.setRunaroSecrets(functionName, extraSecrets);
        console.log(`✅ Secrets set for ${functionName}`);
        break;

      case 'deploy':
        if (!functionName) {
          console.error('Usage: node supabase-secrets-manager.cjs deploy <function-name>');
          process.exit(1);
        }
        await manager.deployFunction(functionName);
        console.log(`✅ ${functionName} deployed`);
        break;

      case 'fix-transfer-activity':
        // Special command to fix transfer-activity with Strava secrets
        console.log('🔧 Fixing transfer-activity function...');

        // Set all required secrets
        await manager.setRunaroSecrets('transfer-activity', {
          STRAVA_CLIENT_ID: '174654',
          STRAVA_CLIENT_SECRET: process.argv[3] || 'PLACEHOLDER_NEED_REAL_SECRET'
        });

        // Trigger redeploy
        console.log('📡 Redeploying function...');
        await manager.deployFunction('transfer-activity');

        console.log('✅ transfer-activity should now work!');
        console.log('🧪 Test with: curl -X OPTIONS https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/transfer-activity');
        break;

      default:
        console.log('Supabase Secrets Manager');
        console.log('Usage:');
        console.log('  node supabase-secrets-manager.cjs list');
        console.log('  node supabase-secrets-manager.cjs secrets <function-name>');
        console.log('  node supabase-secrets-manager.cjs set-runaro <function-name> [EXTRA_KEY=value]');
        console.log('  node supabase-secrets-manager.cjs deploy <function-name>');
        console.log('  node supabase-secrets-manager.cjs fix-transfer-activity [strava-client-secret]');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SupabaseSecretsManager;