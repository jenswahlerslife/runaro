@echo off
echo Building Claude Code Screenshot Tool executable...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Install PyInstaller if not already installed
pip install pyinstaller

echo.
echo 🔨 Building executable...
pyinstaller --onefile --windowed --name="JensRettelsesvaerktoj" --icon=NONE screenshot-app.py

if exist "dist\JensRettelsesvaerktoj.exe" (
    echo.
    echo ✅ Build successful!
    echo 📁 Executable location: dist\JensRettelsesvaerktoj.exe
    echo.
    echo 💡 Usage:
    echo    1. Double-click JensRettelsesvaerktoj.exe to start
    echo    2. Look for camera icon in system tray
    echo    3. Press Ctrl+Shift+S to take screenshots
    echo    4. Screenshots saved to Rettelser folder
    echo    5. Write "screenshot" to Claude for analysis
    echo.
    
    REM Copy exe to main directory for easier access
    copy "dist\JensRettelsesvaerktoj.exe" "JensRettelsesvaerktoj.exe"
    
    echo 🎯 Ready to use! Run JensRettelsesvaerktoj.exe
    
) else (
    echo ❌ Build 
)

echo.
pause