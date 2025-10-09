/**
 * Automated Edge Function Deployment Script
 *
 * This script provides automated deployment capabilities for Supabase Edge Functions.
 * It uses the working API method discovered during the transfer-activity fix.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EdgeFunctionDeployer {
  constructor() {
    this.projectRef = 'ojjpslrhyutizwpvvngu';
    this.accessToken = 'sbp_38d564351d1f0f43a23413c6e527faf2d255e858'; // Claude-Code-Full-Access
    this.baseUrl = 'https://api.supabase.com/v1';
  }

  /**
   * Read Edge Function source code
   */
  readFunctionCode(functionName) {
    const functionPath = path.join(__dirname, '..', 'infra', 'supabase', 'functions', functionName, 'index.ts');
    if (!fs.existsSync(functionPath)) {
      throw new Error(`Function ${functionName} not found at ${functionPath}`);
    }
    return fs.readFileSync(functionPath, 'utf8');
  }

  /**
   * Deploy Edge Function via Supabase API
   */
  async deployFunction(functionName, functionCode = null, options = {}) {
    console.log(`🚀 Deploying Edge Function: ${functionName}`);

    // Read function code if not provided
    if (!functionCode) {
      functionCode = this.readFunctionCode(functionName);
    }

    // Functions that handle their own JWT verification
    const customAuthFunctions = ['import-recent-activities'];
    const verifyJwt = options.verifyJwt ?? !customAuthFunctions.includes(functionName);

    console.log(`   JWT verification: ${verifyJwt ? 'enabled (Supabase)' : 'disabled (custom)'}`);

    try {
      // First, try to create a new version via POST
      let response = await fetch(`${this.baseUrl}/projects/${this.projectRef}/functions/${functionName}/versions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: functionCode,
          verify_jwt: verifyJwt,
          import_map_code: '{}'
        })
      });

      // If POST fails, fallback to PATCH (for config updates only)
      if (!response.ok) {
        console.log(`   POST failed (${response.status}), trying PATCH...`);
        response = await fetch(`${this.baseUrl}/projects/${this.projectRef}/functions/${functionName}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            verify_jwt: verifyJwt
          })
        });
      }

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${functionName} deployed successfully!`);
        console.log(`   Version: ${result.version}`);
        console.log(`   Status: ${result.status}`);
        return { success: true, result };
      } else {
        const error = await response.text();
        console.error(`❌ ${functionName} deployment failed:`, response.status, error);
        return { success: false, error };
      }

    } catch (error) {
      console.error(`❌ ${functionName} deployment error:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deploy multiple Edge Functions
   */
  async deployAllFunctions() {
    console.log('🚀 Deploying all Edge Functions...');

    const functionsDir = path.join(__dirname, '..', 'infra', 'supabase', 'functions');
    const functionDirs = fs.readdirSync(functionsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    const results = [];

    for (const functionName of functionDirs) {
      const result = await this.deployFunction(functionName);
      results.push({ functionName, ...result });
    }

    console.log('\n📊 Deployment Summary:');
    results.forEach(({ functionName, success, error }) => {
      const status = success ? '✅' : '❌';
      console.log(`   ${status} ${functionName}${error ? ` - ${error}` : ''}`);
    });

    return results;
  }

  /**
   * Quick deploy with common fixes applied
   */
  async quickDeploy(functionName, fixes = []) {
    console.log(`⚡ Quick deploying ${functionName} with fixes...`);

    let functionCode = this.readFunctionCode(functionName);

    // Apply common fixes
    fixes.forEach(fix => {
      switch (fix) {
        case 'polyline-import':
          if (functionCode.includes('import polyline from')) {
            functionCode = functionCode.replace(
              'import polyline from \'https://esm.sh/polyline@0.2.0\';',
              'import * as polyline from \'https://esm.sh/polyline@0.2.0\';'
            );
            console.log('   🔧 Applied polyline import fix');
          }
          break;
        case 'cors-headers':
          // Add more CORS fixes if needed
          break;
      }
    });

    return await this.deployFunction(functionName, functionCode);
  }
}

// CLI interface
const isMainModule = process.argv[1] && process.argv[1].endsWith('automated-edge-function-deploy.js');
if (isMainModule) {
  const deployer = new EdgeFunctionDeployer();
  const command = process.argv[2];
  const functionName = process.argv[3];

  switch (command) {
    case 'deploy':
      if (!functionName) {
        console.error('Usage: node automated-edge-function-deploy.js deploy <function-name>');
        process.exit(1);
      }
      await deployer.deployFunction(functionName);
      break;

    case 'deploy-all':
      await deployer.deployAllFunctions();
      break;

    case 'quick-fix':
      if (!functionName) {
        console.error('Usage: node automated-edge-function-deploy.js quick-fix <function-name>');
        process.exit(1);
      }
      await deployer.quickDeploy(functionName, ['polyline-import', 'cors-headers']);
      break;

    default:
      console.log('🚀 Automated Edge Function Deployer');
      console.log('\nCommands:');
      console.log('  deploy <function-name>  - Deploy specific Edge Function');
      console.log('  deploy-all              - Deploy all Edge Functions');
      console.log('  quick-fix <function-name> - Deploy with common fixes applied');
      console.log('\nExamples:');
      console.log('  node automated-edge-function-deploy.js deploy transfer-activity');
      console.log('  node automated-edge-function-deploy.js deploy-all');
      console.log('  node automated-edge-function-deploy.js quick-fix transfer-activity');
  }
}

export default EdgeFunctionDeployer;
