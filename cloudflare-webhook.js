#!/usr/bin/env node

/**
 * Cloudflare Pages Webhook Handler
 * 
 * This script can be used to receive deployment status updates from Cloudflare Pages
 * You can set this up as a webhook endpoint in your Cloudflare Pages project settings
 */

const fs = require('fs');
const path = require('path');

function logDeploymentStatus(data) {
    const logFile = path.join(__dirname, 'deployment-logs.txt');
    const timestamp = new Date().toISOString();
    
    const logEntry = `
[${timestamp}] Deployment Update
Status: ${data.status}
Environment: ${data.environment}
Deployment URL: ${data.url}
Commit: ${data.deployment_trigger?.metadata?.commit_hash || 'Unknown'}
Branch: ${data.deployment_trigger?.metadata?.branch || 'Unknown'}
${data.status === 'failure' ? `Error: ${JSON.stringify(data.deployment_trigger?.metadata?.errors || 'No error details', null, 2)}` : ''}
---
`;
    
    fs.appendFileSync(logFile, logEntry);
    console.log('Deployment status logged to:', logFile);
}

// Example usage for webhook endpoint
if (process.argv[2] === '--webhook') {
    // This would be used in a webhook server
    console.log('Webhook handler ready. Set this URL in Cloudflare Pages notifications.');
} else {
    console.log('Cloudflare webhook handler. Use --webhook to start webhook server.');
}

module.exports = { logDeploymentStatus };