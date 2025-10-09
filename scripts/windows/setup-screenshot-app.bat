@echo off
echo Installing Jens Rettelsesværktøj...
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python from https://python.org
    pause
    exit /b 1
)

echo ✅ Python found
echo.

REM Install required packages
echo 📦 Installing required packages...
pip install pillow pystray keyboard plyer

if errorlevel 1 (
    echo ❌ Failed to install packages
    pause
    exit /b 1
)

echo.
echo ✅ Installation complete!
echo.
echo 🚀 Starting Jens Rettelsesværktøj...
echo.
echo 💡 Usage:
echo    📸 Press Ctrl+Shift+S to take screenshot
echo    📁 Screenshots saved to Rettelser folder  
echo    💬 Write "screenshot" to Claude for analysis
echo.
echo 🔴 To exit: Right-click camera icon in system tray
echo.

python screenshot-app.py

pause