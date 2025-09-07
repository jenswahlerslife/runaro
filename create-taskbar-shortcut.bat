@echo off
echo Creating taskbar shortcut for Jens Rettelsesværktøj...
echo.

REM Check if executable exists
if not exist "JensRettelsesvaerktoj.exe" (
    echo ❌ JensRettelsesvaerktoj.exe not found
    echo Please run build-exe.bat first to create the executable
    pause
    exit /b 1
)

REM Create shortcut on desktop
set "desktop=%USERPROFILE%\Desktop"
set "shortcut_path=%desktop%\Jens Rettelsesværktøj.lnk"
set "target_path=%cd%\JensRettelsesvaerktoj.exe"

echo Creating desktop shortcut...

REM Use PowerShell to create shortcut
powershell -command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%shortcut_path%'); $Shortcut.TargetPath = '%target_path%'; $Shortcut.WorkingDirectory = '%cd%'; $Shortcut.Description = 'Jens Rettelsesværktøj - Screenshot tool til Claude debugging'; $Shortcut.Save()"

if exist "%shortcut_path%" (
    echo ✅ Desktop shortcut created: Jens Rettelsesværktøj.lnk
    echo.
    echo 📌 To pin to taskbar:
    echo    1. Go to your desktop
    echo    2. Right-click "Jens Rettelsesværktøj" shortcut
    echo    3. Select "Pin to taskbar"
    echo.
    echo 🎯 Or just double-click the shortcut to start!
) else (
    echo ❌ Failed to create shortcut
)

echo.
pause