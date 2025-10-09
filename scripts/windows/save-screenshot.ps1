# Quick Screenshot Saver for Claude Code
# Usage: Right-click and "Run with PowerShell" after copying screenshot

param(
    [string]$Description = "screenshot"
)

# Ensure Rettelser folder exists
$rettelserPath = Join-Path $PSScriptRoot "Rettelser"
if (-not (Test-Path $rettelserPath)) {
    New-Item -Path $rettelserPath -ItemType Directory -Force | Out-Null
}

# Generate timestamp filename
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$safeDesc = $Description -replace '[^a-zA-Z0-9]', '_' -replace '_+', '_'
$filename = "screenshot_${timestamp}_${safeDesc}.png"
$filepath = Join-Path $rettelserPath $filename

Write-Host "🖼️  Saving screenshot from clipboard..." -ForegroundColor Cyan
Write-Host "📁 Location: $filepath" -ForegroundColor Gray

try {
    # Load required assemblies
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    
    # Get image from clipboard
    $clipboard = [System.Windows.Forms.Clipboard]::GetImage()
    
    if ($clipboard -ne $null) {
        # Save the image
        $clipboard.Save($filepath, [System.Drawing.Imaging.ImageFormat]::Png)
        
        # Get file size
        $fileSize = [math]::Round((Get-Item $filepath).Length / 1KB, 1)
        
        Write-Host "✅ Success! Screenshot saved (${fileSize}KB)" -ForegroundColor Green
        Write-Host ""
        Write-Host "📋 Tell Claude to read: Rettelser/$($filename)" -ForegroundColor Yellow
        Write-Host ""
        
        # Add to log
        $logPath = Join-Path $rettelserPath "screenshot-log.txt"
        $logEntry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $filename - $Description"
        Add-Content -Path $logPath -Value $logEntry
        
    } else {
        Write-Host "❌ No image found in clipboard" -ForegroundColor Red
        Write-Host "💡 Tip: Use Win+Shift+S to take screenshot, then run this script" -ForegroundColor Blue
    }
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")