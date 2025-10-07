@echo off
echo ========================================
echo   Installing Node.js in WSL Ubuntu
echo ========================================
echo.

REM Install Node.js in WSL
wsl bash -c "curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"

echo.
echo Installing project dependencies...
wsl bash -c "cd /mnt/c/Runaro_website/Runaro && npm ci"

echo.
echo ========================================
echo   Starting Development Server in WSL
echo ========================================
echo.

REM Start dev server in WSL
wsl bash -c "cd /mnt/c/Runaro_website/Runaro && npm run dev"

pause
