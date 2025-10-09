@echo off
echo ========================================
echo   Fresh WSL Ubuntu Terminal
echo ========================================
echo.

REM Kill all WSL processes
wsl --shutdown
timeout /t 2 /nobreak >nul

REM Start fresh WSL terminal with Windows Terminal
echo Opening Ubuntu terminal...
wt -w 0 wsl -d Ubuntu --cd /mnt/c/Runaro_website/Runaro

echo.
echo Terminal opened!
echo If nothing happened, press any key to try alternative method...
pause

REM Alternative: Use basic WSL command
wsl -d Ubuntu --cd /mnt/c/Runaro_website/Runaro
