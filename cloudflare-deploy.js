import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🚀 Cloudflare Deployment Script');
console.log('================================');

// Check if wrangler is available
try {
  execSync('wrangler --version', { stdio: 'ignore' });
  console.log('✅ Wrangler CLI is available');
} catch (error) {
  console.log('❌ Wrangler CLI not found. Installing...');
  execSync('npm install -g wrangler@latest', { stdio: 'inherit' });
}

// Build the project
console.log('🔧 Building the project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully');
} catch (error) {
  console.log('❌ Build failed:', error.message);
  process.exit(1);
}

// Check if dist directory exists
if (!fs.existsSync('dist')) {
  console.log('❌ Build directory (dist) not found');
  process.exit(1);
}

// Deploy to Cloudflare Pages
console.log('📡 Deploying to Cloudflare Pages...');
try {
  // Get current git branch
  const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  console.log(`📋 Deploying branch: ${branch}`);
  
  // Deploy based on branch
  if (branch === 'main' || branch === 'master') {
    console.log('🌟 Production deployment');
    execSync('npx wrangler pages deploy dist --project-name runaro', { stdio: 'inherit' });
  } else {
    console.log('🧪 Preview deployment');
    execSync(`npx wrangler pages deploy dist --project-name runaro --branch ${branch}`, { stdio: 'inherit' });
  }
  
  console.log('✅ Deployment completed successfully!');
  
  // Get deployment URL
  console.log('🔗 Getting deployment URL...');
  try {
    const deployments = execSync('npx wrangler pages deployment list --project-name runaro', { encoding: 'utf8' });
    console.log('📋 Recent deployments:');
    console.log(deployments);
  } catch (urlError) {
    console.log('⚠️  Could not fetch deployment URL');
  }
  
} catch (error) {
  console.log('❌ Deployment failed:', error.message);
  process.exit(1);
}

console.log('');
console.log('🎉 Deployment process completed!');
console.log('🌐 Your site should be live at: https://runaro.pages.dev');