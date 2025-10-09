$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Jens Rettelsesvaerktoj.lnk"
$targetPath = Join-Path $PSScriptRoot "JensRettelsesvaerktoj.exe"

$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($shortcutPath)
$Shortcut.TargetPath = $targetPath
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "Jens Rettelsesvaerktoj - Screenshot tool til Claude debugging"
$Shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath"