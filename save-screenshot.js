#!/usr/bin/env node

/**
 * Screenshot Saver for Claude Code Debugging
 * 
 * This script helps save clipboard screenshots to the Rettelser folder
 * Usage: node save-screenshot.js [description]
 * 
 * How to use:
 * 1. Take a screenshot (Windows: Win+Shift+S, Mac: Cmd+Shift+4)
 * 2. Copy screenshot to clipboard  
 * 3. Run: node save-screenshot.js "beskrivelse af problemet"
 * 4. Screenshot will be saved to Rettelser folder with timestamp
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get description from command line arguments
const description = process.argv.slice(2).join(' ') || 'screenshot';

// Create safe filename from description
function createSafeFilename(desc) {
    return desc
        .toLowerCase()
        .replace(/[æåä]/g, 'a')
        .replace(/[øö]/g, 'o')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

// Generate filename with timestamp
function generateFilename(desc) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeDesc = createSafeFilename(desc);
    return `${timestamp}_${safeDesc}.png`;
}

async function saveScreenshot() {
    try {
        const filename = generateFilename(description);
        const filepath = path.join(__dirname, 'Rettelser', filename);
        
        console.log(`🖼️  Saving screenshot: ${description}`);
        console.log(`📁 Location: ${filepath}`);
        
        // Ensure Rettelser directory exists
        const rettelserDir = path.join(__dirname, 'Rettelser');
        if (!fs.existsSync(rettelserDir)) {
            fs.mkdirSync(rettelserDir, { recursive: true });
        }
        
        // Try different methods based on OS
        if (process.platform === 'win32') {
            // Windows: Use PowerShell to save clipboard image
            const powershellScript = `
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type -AssemblyName System.Drawing
                
                $clipboard = [System.Windows.Forms.Clipboard]::GetImage()
                if ($clipboard -ne $null) {
                    $clipboard.Save("${filepath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
                    Write-Host "Screenshot saved successfully!"
                } else {
                    Write-Host "No image found in clipboard"
                    exit 1
                }
            `;
            
            execSync(`powershell -Command "${powershellScript}"`, { stdio: 'inherit' });
            
        } else if (process.platform === 'darwin') {
            // macOS: Use pbpaste to save clipboard image
            execSync(`pbpaste > "${filepath}"`, { stdio: 'inherit' });
            
        } else {
            // Linux: Use xclip to save clipboard image
            execSync(`xclip -selection clipboard -t image/png -o > "${filepath}"`, { stdio: 'inherit' });
        }
        
        // Verify file was created
        if (fs.existsSync(filepath)) {
            const stats = fs.statSync(filepath);
            console.log(`✅ Success! Screenshot saved (${Math.round(stats.size / 1024)}KB)`);
            console.log(`📋 You can now paste this path in chat: Rettelser/${filename}`);
            
            // Create a log entry
            const logFile = path.join(rettelserDir, 'screenshot-log.txt');
            const logEntry = `${new Date().toISOString()} - ${filename} - ${description}\n`;
            fs.appendFileSync(logFile, logEntry);
            
        } else {
            console.log('❌ Error: Screenshot file was not created');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Error saving screenshot:', error.message);
        console.log('\n💡 Tips:');
        console.log('   - Make sure you have an image in your clipboard');
        console.log('   - Try copying the screenshot again');
        console.log('   - On Windows: Use Win+Shift+S to take screenshot');
        console.log('   - On Mac: Use Cmd+Shift+4 to take screenshot');
        process.exit(1);
    }
}

// Show help if needed
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Screenshot Saver for Claude Code Debugging

Usage:
  node save-screenshot.js [description]
  
Examples:
  node save-screenshot.js "login fejl på forsiden"
  node save-screenshot.js "leagues side loader ikke"
  node save-screenshot.js "console error ved start game"
  
How it works:
1. Take a screenshot and copy to clipboard
2. Run this script with a description
3. Screenshot gets saved to Rettelser/ folder
4. Use the filename to reference it in chat with Claude

Options:
  --help, -h    Show this help message
    `);
    process.exit(0);
}

// Run the function
saveScreenshot();