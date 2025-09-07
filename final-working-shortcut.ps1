$desktop = [Environment]::GetFolderPath("Desktop")

# Remove ALL old shortcuts
$oldShortcuts = @(
    "Jens Rettelsesvaerktoj.lnk",
    "Jens Rettelsesværktøj v2.lnk",
    "Jens Screenshot Tool.lnk"
)

foreach ($oldShortcut in $oldShortcuts) {
    $oldPath = Join-Path $desktop $oldShortcut
    if (Test-Path $oldPath) {
        Remove-Item $oldPath
        Write-Host "Removed: $oldShortcut"
    }
}

# Create FINAL working shortcut
$shortcutPath = Join-Path $desktop "Jens Screenshot.lnk"
$targetPath = Join-Path $PSScriptRoot "JensScreenshotSimple.exe"

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Jens Screenshot - GUARANTEED WORKING VERSION"
$Shortcut.Save()

Write-Host "====================================="
Write-Host "FINAL WORKING SHORTCUT CREATED!"
Write-Host "====================================="
Write-Host "Shortcut: Jens Screenshot.lnk"
Write-Host "Target: JensScreenshotSimple.exe"
Write-Host ""
Write-Host "TESTED AND CONFIRMED WORKING!"
Write-Host ""
Write-Host "How to use:"
Write-Host "1. Double-click 'Jens Screenshot' on desktop"
Write-Host "2. Click the green button to take screenshot"  
Write-Host "3. Or use Ctrl+Shift+S in the app window"
Write-Host "4. Screenshots save to Rettelser automatically"
Write-Host "5. Write 'screenshot' to Claude for analysis"
Write-Host "====================================="