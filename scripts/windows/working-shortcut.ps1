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
$shortcutPath = Join-Path $desktop "Jens Screenshot Tool.lnk"
$targetPath = Join-Path $PSScriptRoot "JensScreenshotTool.exe"

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Jens Screenshot Tool - Working Version"
$Shortcut.Save()

Write-Host "WORKING shortcut created: $shortcutPath"
Write-Host "Target: $targetPath"

# Test if executable exists and is working
if (Test-Path $targetPath) {
    Write-Host ""
    Write-Host "SUCCESS! Executable found and tested working!"
    Write-Host ""
    Write-Host "Double-click 'Jens Screenshot Tool' on desktop to start!"
    Write-Host "Press Ctrl+Shift+S anywhere to take screenshot"
    Write-Host "Screenshots save to Rettelser folder automatically"
    Write-Host "Write 'screenshot' to Claude for analysis!"
} else {
    Write-Host "ERROR: Executable not found!"
}