@echo off
REM Automatic WSL + VS Code Setup for Runaro
REM This script opens the project in VS Code with WSL Ubuntu

echo ========================================
echo   Runaro - Opening in WSL Ubuntu
echo ========================================
echo.

REM Get the current directory in WSL format
set "CURRENT_DIR=%cd%"

REM Convert Windows path to WSL path
for /f "tokens=*" %%i in ('wsl wslpath -a "%CURRENT_DIR%"') do set WSL_PATH=%%i

echo Current Windows Path: %CURRENT_DIR%
echo WSL Path: %WSL_PATH%
echo.
echo Opening VS Code in WSL mode...
echo.

REM Open VS Code with WSL remote extension
code --remote wsl+Ubuntu "%WSL_PATH%"

echo.
echo ========================================
echo   VS Code is opening in WSL mode!
echo ========================================
echo.
echo Look for "WSL: Ubuntu" in the bottom-left corner
echo.
echo Next steps inside VS Code terminal:
echo   1. Run: ./scripts/wsl-setup.sh
echo   2. Or run: npm ci
echo   3. Then: npm run dev
echo.
pause
