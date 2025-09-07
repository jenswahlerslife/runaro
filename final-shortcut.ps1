$desktop = [Environment]::GetFolderPath("Desktop")

# Remove ALL old shortcuts
$oldShortcuts = @(
    "Jens Rettelsesvaerktoj.lnk",
    "Jens Rettelsesværktøj v2.lnk"
)

foreach ($oldShortcut in $oldShortcuts) {
    $oldPath = Join-Path $desktop $oldShortcut
    if (Test-Path $oldPath) {
        Remove-Item $oldPath
        Write-Host "Removed: $oldShortcut"
    }
}

# Create final working shortcut
$shortcutPath = Join-Path $desktop "Jens Rettelsesvaerktoj.lnk"
$targetPath = Join-Path $PSScriptRoot "JensRettelsesvaerktoj-FIXED.exe"

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Jens Rettelsesvaerktoj - Working Screenshot Tool"
$Shortcut.Save()

Write-Host "✅ Working shortcut created: $shortcutPath"
Write-Host "🎯 Target: $targetPath"

# Test if executable exists and is working
if (Test-Path $targetPath) {
    Write-Host "✅ Executable found and ready!"
    Write-Host ""
    Write-Host "🚀 Double-click the desktop icon to start!"
    Write-Host "📸 Press Ctrl+Shift+S anywhere to take screenshot"
    Write-Host "📁 Screenshots save to Rettelser folder automatically"
} else {
    Write-Host "❌ Error: Executable not found!"
}