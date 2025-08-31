#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Function to check if there are changes to commit
function hasChanges() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return status.trim().length > 0;
  } catch (error) {
    console.error('Error checking git status:', error.message);
    return false;
  }
}

// Function to auto-commit and push changes
function autoSync() {
  if (!hasChanges()) {
    console.log('No changes to sync');
    return;
  }

  try {
    console.log('🔄 Auto-syncing changes to GitHub...');
    
    // Add all changes
    execSync('git add .', { stdio: 'inherit' });
    
    // Create commit with timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const commitMessage = `Auto-sync: Updates from Claude Code - ${timestamp}`;
    
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
    
    // Push to GitHub
    execSync('git push origin main', { stdio: 'inherit' });
    
    console.log('✅ Successfully synced to GitHub!');
    console.log(`📝 Commit: ${commitMessage}`);
    
  } catch (error) {
    console.error('❌ Auto-sync failed:', error.message);
    
    // If push fails due to remote changes, try to pull first
    if (error.message.includes('rejected') || error.message.includes('fetch first')) {
      try {
        console.log('🔄 Attempting to pull remote changes first...');
        execSync('git pull origin main --no-edit', { stdio: 'inherit' });
        execSync('git push origin main', { stdio: 'inherit' });
        console.log('✅ Successfully synced after pull!');
      } catch (pullError) {
        console.error('❌ Auto-sync with pull also failed:', pullError.message);
      }
    }
  }
}

// Export for use in other scripts
export { autoSync, hasChanges };

// If called directly, run auto-sync
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.argv[1] === __filename) {
  autoSync();
}