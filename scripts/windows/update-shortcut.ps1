$desktop = [Environment]::GetFolderPath("Desktop")

# Remove old shortcut
$oldShortcutPath = Join-Path $desktop "Jens Rettelsesvaerktoj.lnk"
if (Test-Path $oldShortcutPath) {
    Remove-Item $oldShortcutPath
    Write-Host "Removed old shortcut"
}

# Create new shortcut pointing to v2 executable
$shortcutPath = Join-Path $desktop "Jens Rettelsesværktøj v2.lnk"
$targetPath = Join-Path $PSScriptRoot "JensRettelsesvaerktoj-v2.exe"

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Jens Rettelsesværktøj v2.0 - Screenshot tool som Windows Klippeværktøj"
$Shortcut.Save()

Write-Host "New desktop shortcut created: $shortcutPath"
Write-Host "Target: $targetPath"

# Test if executable exists
if (Test-Path $targetPath) {
    Write-Host "✅ Executable found and ready to use!"
} else {
    Write-Host "❌ Executable not found at: $targetPath"
}