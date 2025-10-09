@echo off
echo ========================================
echo   RUNARO - Opening in WSL
echo ========================================
echo.
echo Installing VS Code WSL extension...
code --install-extension ms-vscode-remote.remote-wsl

echo.
echo Opening VS Code in WSL Ubuntu mode...
code --remote wsl+Ubuntu .

echo.
echo ========================================
echo DONE! VS Code is opening...
echo ========================================
echo.
echo Look for "WSL: Ubuntu" in bottom-left corner
echo.
echo Inside VS Code terminal, run this ONE command:
echo.
echo   npm ci
echo.
pause
