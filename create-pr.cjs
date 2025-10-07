#!/usr/bin/env node

/**
 * Create GitHub Pull Request using REST API
 * This script creates a PR for the current branch
 */

const https = require('https');
const { execSync } = require('child_process');

// Get current branch name
const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
const baseBranch = 'main';

// PR details
const title = 'chore: normalize repo for Linux/WSL & cross-platform builds';
const body = `## Summary
This PR normalizes the repository for Linux/WSL development and cross-platform compatibility.

## Changes
- ✅ **Line ending normalization**: Added \`.gitattributes\` and \`.editorconfig\` to enforce LF line endings
- ✅ **Windows artifacts removed**: Deleted \`.exe\`, \`.dll\` files and updated \`.gitignore\`
- ✅ **Cross-platform npm scripts**: Replaced PowerShell commands with Node.js-based \`scripts/load-env.cjs\`
- ✅ **Shell script permissions**: Added \`postinstall\` hook to make scripts executable
- ✅ **ESLint case-sensitivity**: Added \`eslint-plugin-import\` for import case checking
- ✅ **DevContainer**: Added \`.devcontainer/devcontainer.json\` for consistent development environment
- ✅ **CI workflow**: Added \`.github/workflows/ci.yml\` for automated Linux builds

## Testing
- All npm scripts tested and working in WSL environment
- Build, lint, and type-check pass successfully
- Database commands use cross-platform approach

## Migration Notes
- Developers using Windows should work in WSL for consistency
- All future development assumes Linux/WSL environment
- Automated setup scripts available: \`setup-wsl-auto.ps1\` and \`open-in-wsl.bat\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)`;

// GitHub API details
const owner = 'jenswahlerslife';
const repo = 'runaro';

// Check for GitHub token in environment
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

if (!token) {
  console.error('❌ Error: GitHub token not found');
  console.error('Please set GITHUB_TOKEN or GH_TOKEN environment variable');
  console.error('\nYou can create a token at: https://github.com/settings/tokens');
  console.error('Required scopes: repo');
  console.error('\nOr create the PR manually at:');
  console.error(`https://github.com/${owner}/${repo}/compare/${baseBranch}...${currentBranch}`);
  process.exit(1);
}

const data = JSON.stringify({
  title,
  body,
  head: currentBranch,
  base: baseBranch
});

const options = {
  hostname: 'api.github.com',
  path: `/repos/${owner}/${repo}/pulls`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length,
    'Authorization': `token ${token}`,
    'User-Agent': 'Node.js PR Creator',
    'Accept': 'application/vnd.github.v3+json'
  }
};

console.log(`Creating PR: ${currentBranch} → ${baseBranch}`);

const req = https.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 201) {
      const pr = JSON.parse(responseData);
      console.log('✅ Pull request created successfully!');
      console.log(`📎 URL: ${pr.html_url}`);
      console.log(`🔢 PR #${pr.number}`);
    } else {
      console.error(`❌ Failed to create PR (status ${res.statusCode})`);
      console.error(responseData);
      console.error('\nCreate PR manually at:');
      console.error(`https://github.com/${owner}/${repo}/compare/${baseBranch}...${currentBranch}`);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error creating PR:', error.message);
  console.error('\nCreate PR manually at:');
  console.error(`https://github.com/${owner}/${repo}/compare/${baseBranch}...${currentBranch}`);
  process.exit(1);
});

req.write(data);
req.end();
