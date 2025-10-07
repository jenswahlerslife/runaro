@echo off
echo ========================================
echo   Running Runaro in WSL Linux
echo ========================================
echo.

echo Opening Ubuntu terminal...
echo.
echo Inside Ubuntu, run these commands:
echo.
echo   cd /mnt/c/Runaro_website/Runaro
echo   npm run dev
echo.

wt wsl -d Ubuntu

pause
