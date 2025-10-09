@echo off
echo ========================================
echo   COMPLETE RESET - This Will Work
echo ========================================
echo.
echo This will:
echo   1. Kill all VS Code processes
echo   2. Completely shutdown WSL
echo   3. Start fresh Ubuntu terminal
echo   4. You run commands manually there
echo.
echo Press Ctrl+C to cancel, or
pause

echo.
echo Step 1: Killing VS Code...
taskkill /F /IM Code.exe 2>nul
timeout /t 2 /nobreak >nul

echo Step 2: Shutting down WSL completely...
wsl --shutdown
timeout /t 3 /nobreak >nul

echo Step 3: Starting fresh WSL terminal...
echo.
echo ========================================
echo   Ubuntu Terminal Opening
echo ========================================
echo.
echo In the Ubuntu terminal, run these commands:
echo.
echo   cd /mnt/c/Runaro_website/Runaro
echo   node --version
echo   npm run dev
echo.
echo The dev server will start on http://localhost:8080
echo.

start wsl.exe

echo.
echo Terminal opened! If you can type in it now, run the commands above.
echo.
pause
