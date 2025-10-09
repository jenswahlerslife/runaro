@echo off
echo ========================================
echo   Reconnecting VS Code to WSL
echo ========================================
echo.

echo Step 1: Closing VS Code...
taskkill /F /IM "Code.exe" 2>nul

echo Step 2: Shutting down WSL...
wsl --shutdown

echo Step 3: Waiting 3 seconds...
timeout /t 3 /nobreak >nul

echo Step 4: Starting WSL Ubuntu...
wsl -d Ubuntu -e bash -c "echo 'WSL is ready'"

echo Step 5: Opening VS Code in WSL mode...
code --remote wsl+Ubuntu /mnt/c/Runaro_website/Runaro

echo.
echo ========================================
echo   VS Code is opening in WSL mode!
echo ========================================
echo.
echo Look for "WSL: Ubuntu" in bottom-left corner
echo.
echo In the terminal, run:
echo   npm run dev
echo.
pause
