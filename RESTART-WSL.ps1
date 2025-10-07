# Force restart WSL Ubuntu
Write-Host "Killing all WSL processes..." -ForegroundColor Yellow

# Kill WSL processes
Get-Process -Name "*wsl*" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "*ubuntu*" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "Waiting 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Restart WSL service
Write-Host "Restarting WSL..." -ForegroundColor Yellow
Restart-Service -Name "LxssManager" -Force

Write-Host "WSL restarted!" -ForegroundColor Green
Write-Host ""
Write-Host "Now run: FRESH-WSL-START.bat" -ForegroundColor Cyan
pause
