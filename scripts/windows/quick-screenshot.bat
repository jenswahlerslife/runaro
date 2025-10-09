@echo off
REM Quick Screenshot Saver for Claude Code
REM Usage: Just double-click this file after copying screenshot to clipboard

setlocal enabledelayedexpansion

REM Create Rettelser folder if it doesn't exist
if not exist "Rettelser" mkdir "Rettelser"

REM Generate timestamp filename
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~2,2%" & set "YYYY=%dt:~0,4%" & set "MM=%dt:~4,2%" & set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%" & set "Min=%dt:~10,2%" & set "Sec=%dt:~12,2%"
set "filename=screenshot_%YYYY%-%MM%-%DD%_%HH%-%Min%-%Sec%.png"

echo Saving screenshot from clipboard...
echo Filename: %filename%

REM Use PowerShell to save clipboard image
powershell -command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $clipboard = [System.Windows.Forms.Clipboard]::GetImage(); if ($clipboard -ne $null) { $clipboard.Save('%cd%\Rettelser\%filename%', [System.Drawing.Imaging.ImageFormat]::Png); Write-Host 'Screenshot saved successfully!'; Write-Host 'Location: Rettelser\%filename%' } else { Write-Host 'No image found in clipboard. Please copy screenshot first.' }"

echo.
echo Screenshot saved! You can now tell Claude to read: Rettelser\%filename%
echo.
pause