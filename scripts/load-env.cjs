#!/usr/bin/env node
/**
 * Cross-platform environment variable loader
 * Loads variables from .env.local and executes the provided command
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read .env.local file
const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found');
  console.error('Please create .env.local file with your Supabase credentials');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

// Parse environment variables
envContent.split('\n').forEach(line => {
  line = line.trim();

  // Skip comments and empty lines
  if (!line || line.startsWith('#')) return;

  // Parse KEY=VALUE
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    const value = valueParts.join('=').trim();
    envVars[key.trim()] = value;
  }
});

// Get the command to execute (everything after the script name)
const command = process.argv.slice(2).join(' ');

if (!command) {
  console.error('Error: No command provided');
  console.error('Usage: node scripts/load-env.js <command>');
  process.exit(1);
}

// Execute command with environment variables
try {
  execSync(command, {
    stdio: 'inherit',
    env: { ...process.env, ...envVars }
  });
} catch (error) {
  process.exit(error.status || 1);
}
