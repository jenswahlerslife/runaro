#!/usr/bin/env node

/**
 * Cloudflare Pages Deployment Log Fetcher
 * 
 * This script fetches the latest deployment logs from Cloudflare Pages
 * Usage: node get-deployment-logs.js [project-name]
 */

const { execSync } = require('child_process');

const PROJECT_NAME = process.argv[2] || 'runaro'; // Default project name

async function getDeploymentLogs() {
    try {
        console.log(`🔍 Fetching deployment logs for project: ${PROJECT_NAME}...\n`);
        
        // Get the latest deployments
        console.log('📋 Getting latest deployments...');
        const deploymentListCmd = `npx wrangler pages deployment list --project-name ${PROJECT_NAME} --json`;
        const deploymentListOutput = execSync(deploymentListCmd, { encoding: 'utf8' });
        
        // Extract JSON from the output (skip the wrangler header)
        const lines = deploymentListOutput.split('\n');
        const jsonStartIndex = lines.findIndex(line => line.trim().startsWith('['));
        const jsonLines = lines.slice(jsonStartIndex);
        const deployments = JSON.parse(jsonLines.join('\n'));
        
        if (deployments.length === 0) {
            console.log('❌ No deployments found');
            return;
        }
        
        // Get the latest deployment
        const latestDeployment = deployments[0];
        console.log(`📊 Latest deployment: ${latestDeployment.Id}`);
        console.log(`🔄 Status: ${latestDeployment.Status}`);
        console.log(`🌐 URL: ${latestDeployment.Deployment}`);
        console.log(`🔗 Build logs: ${latestDeployment.Build}\n`);
        
        // Check if deployment failed
        if (latestDeployment.Status === 'Failure') {
            console.log('❌ Latest deployment failed!');
            console.log('📝 Click the build logs link above to see detailed error information');
        } else if (latestDeployment.Status.includes('ago')) {
            console.log('✅ Latest deployment was successful!');
        } else {
            console.log(`🔄 Deployment status: ${latestDeployment.Status}`);
        }
        
        // Note: Wrangler doesn't expose build logs directly via CLI
        // This is a limitation of the current Wrangler API
        console.log('\n💡 For detailed build logs, check the Cloudflare Pages dashboard:');
        console.log(`   https://dash.cloudflare.com/`);
        
    } catch (error) {
        if (error.message.includes('not authenticated')) {
            console.log('🔐 Authentication required. Run: npx wrangler login');
            console.log('   Then try again.');
        } else if (error.message.includes('project not found')) {
            console.log(`❌ Project "${PROJECT_NAME}" not found.`);
            console.log('   Available projects can be listed with: npx wrangler pages project list');
        } else {
            console.log('❌ Error:', error.message);
        }
    }
}

// Run the function
getDeploymentLogs();