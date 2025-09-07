#!/usr/bin/env node

/**
 * Helper script for Claude to read the latest screenshot
 * This script finds and returns the path to the most recent screenshot
 */

const fs = require('fs');
const path = require('path');

function getLatestScreenshot() {
    const rettelserDir = path.join(__dirname, 'Rettelser');
    
    try {
        // Check if LATEST.txt exists (created by screenshot app)
        const latestFile = path.join(rettelserDir, 'LATEST.txt');
        if (fs.existsSync(latestFile)) {
            const filename = fs.readFileSync(latestFile, 'utf8').trim();
            const filepath = path.join(rettelserDir, filename);
            
            if (fs.existsSync(filepath)) {
                return {
                    success: true,
                    filepath: filepath,
                    filename: filename,
                    relativePath: `Rettelser/${filename}`
                };
            }
        }
        
        // Fallback: Find most recent screenshot file
        if (!fs.existsSync(rettelserDir)) {
            return {
                success: false,
                error: 'Rettelser folder not found. Take a screenshot first!'
            };
        }
        
        const files = fs.readdirSync(rettelserDir)
            .filter(file => file.startsWith('screenshot_') && file.endsWith('.png'))
            .map(file => ({
                name: file,
                path: path.join(rettelserDir, file),
                mtime: fs.statSync(path.join(rettelserDir, file)).mtime
            }))
            .sort((a, b) => b.mtime - a.mtime);
        
        if (files.length === 0) {
            return {
                success: false,
                error: 'No screenshots found. Take a screenshot first!'
            };
        }
        
        const latest = files[0];
        return {
            success: true,
            filepath: latest.path,
            filename: latest.name,
            relativePath: `Rettelser/${latest.name}`,
            timestamp: latest.mtime.toLocaleString('da-DK')
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// If called directly, output the result
if (require.main === module) {
    const result = getLatestScreenshot();
    
    if (result.success) {
        console.log(`📸 Seneste screenshot: ${result.relativePath}`);
        if (result.timestamp) {
            console.log(`📅 Taget: ${result.timestamp}`);
        }
    } else {
        console.log(`❌ Fejl: ${result.error}`);
    }
}

module.exports = { getLatestScreenshot };