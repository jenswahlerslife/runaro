const { autoSync } = require('./auto-sync');

// Helper function to sync with custom message
function syncWithMessage(message) {
  const { execSync } = require('child_process');
  const fs = require('fs');
  
  try {
    // Check if there are changes
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (!status.trim()) {
      console.log('No changes to sync');
      return;
    }

    console.log(`🔄 Syncing: ${message}`);
    
    execSync('git add .', { stdio: 'inherit' });
    execSync(`git commit -m "${message}"`, { stdio: 'inherit' });
    execSync('git push origin main', { stdio: 'inherit' });
    
    console.log('✅ Successfully synced to GitHub!');
    
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    
    // Fallback to auto-sync
    console.log('🔄 Trying fallback auto-sync...');
    autoSync();
  }
}

module.exports = { syncWithMessage };