@echo off
echo ========================================
echo   Fixing WSL Ubuntu
echo ========================================
echo.

echo Step 1: Shutting down WSL...
wsl --shutdown

echo Waiting 5 seconds...
timeout /t 5 /nobreak >nul

echo.
echo Step 2: Starting WSL Ubuntu...
wsl --distribution Ubuntu --exec bash -c "echo WSL is working!"

echo.
echo Step 3: Testing project access...
wsl --distribution Ubuntu --exec bash -c "cd /mnt/c/Runaro_website/Runaro && ls package.json"

echo.
echo ========================================
echo   WSL Fixed! Now run: RUN-IN-WSL.bat
echo ========================================
pause
