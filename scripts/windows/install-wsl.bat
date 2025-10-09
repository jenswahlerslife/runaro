@echo off
setlocal
REM Helper to run the PowerShell WSL installer with elevation

REM Try to relaunch the PowerShell script elevated via UAC with window visible
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process PowerShell -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -NoExit -File \"%~dp0install-wsl.ps1\"'"
if %errorlevel%==0 (
  REM Elevated instance launched; exit this non-admin shell
  endlocal & exit /b 0
)

REM Fallback: run non-elevated; the PS script will self-elevate
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0install-wsl.ps1" %*
endlocal
