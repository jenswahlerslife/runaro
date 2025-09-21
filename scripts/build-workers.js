#!/usr/bin/env node

/**
 * Build script for Cloudflare Workers with isolated dependencies
 * Compiles TypeScript workers to standalone JavaScript files
 */

const fs = require('fs');
const path = require('path');

const WORKERS_SRC_DIR = path.join(__dirname, '../src/workers');
const WORKERS_DIST_DIR = path.join(__dirname, '../workers');

// Mock TypeScript compilation for now - in a real implementation,
// this would use TypeScript compiler API or esbuild
function buildWorkerFromTypeScript(workerName) {
  console.log(`Building worker: ${workerName}`);

  // For now, copy the pre-built JavaScript file
  // In production, this would compile the TypeScript source
  const sourceFile = path.join(WORKERS_DIST_DIR, `${workerName}-refactored.js`);
  const targetFile = path.join(WORKERS_DIST_DIR, `${workerName}-compiled.js`);

  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, targetFile);
    console.log(`✅ Built ${workerName} -> ${targetFile}`);
  } else {
    console.error(`❌ Source file not found: ${sourceFile}`);
  }
}

function createWranglerConfig(workerName, config) {
  const configPath = path.join(WORKERS_DIST_DIR, `${workerName}.wrangler.toml`);

  const tomlContent = `name = "${config.name}"
main = "${config.main}"
compatibility_date = "${config.compatibilityDate || '2024-09-03'}"

# Cron trigger
${config.cron ? `[triggers]
crons = ["${config.cron}"]` : ''}

# Environment variables
[vars]
SUPABASE_URL = "${config.supabaseUrl || 'https://ojjpslrhyutizwpvvngu.supabase.co'}"

# Secrets are provided via Wrangler Secrets:
#   wrangler secret put CRON_SECRET
`;

  fs.writeFileSync(configPath, tomlContent);
  console.log(`✅ Created wrangler config: ${configPath}`);
}

function main() {
  console.log('🔨 Building Cloudflare Workers...');

  // Build game-finish-cron worker
  buildWorkerFromTypeScript('game-finish-cron');

  createWranglerConfig('game-finish-cron', {
    name: 'runaro-game-finish-cron',
    main: 'game-finish-cron-compiled.js',
    cron: '*/5 * * * *',
  });

  console.log('✅ Worker build complete!');
  console.log('\nNext steps:');
  console.log('1. Deploy with: wrangler deploy workers/game-finish-cron.wrangler.toml');
  console.log('2. Set secrets with: wrangler secret put CRON_SECRET');
}

if (require.main === module) {
  main();
}

module.exports = { buildWorkerFromTypeScript, createWranglerConfig };