import { execSync, spawn } from 'child_process';
import fs from 'fs';

console.log('⚡ Cloudflare Development Environment');
console.log('===================================');

// Check if wrangler is available
try {
  execSync('wrangler --version', { stdio: 'ignore' });
  console.log('✅ Wrangler CLI is available');
} catch (error) {
  console.log('❌ Wrangler CLI not found. Please run: npm install -g wrangler');
  process.exit(1);
}

// Start local development with Cloudflare Pages compatibility
console.log('🔧 Starting Cloudflare-compatible development server...');

try {
  // First build the project
  console.log('📦 Building project for development...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Start Wrangler Pages dev server
  console.log('🚀 Starting Wrangler Pages development server...');
  console.log('📍 Server will be available at: http://localhost:8788');
  console.log('🔄 Watching for changes...');
  console.log('');
  
  // Start the dev server
  const devServer = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', '8788', '--live-reload'], {
    stdio: 'inherit',
    shell: true
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('\\n🛑 Stopping development server...');
    devServer.kill();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\\n🛑 Stopping development server...');
    devServer.kill();
    process.exit(0);
  });
  
  devServer.on('close', (code) => {
    console.log(`\\n📋 Development server exited with code ${code}`);
  });
  
} catch (error) {
  console.log('❌ Failed to start development server:', error.message);
  process.exit(1);
}