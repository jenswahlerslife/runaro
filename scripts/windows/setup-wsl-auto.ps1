# Automatic WSL Development Setup for Runaro
# This PowerShell script sets up everything automatically

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Runaro - Automatic WSL Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if WSL is installed
Write-Host "Checking WSL installation..." -ForegroundColor Yellow
try {
    $wslVersion = wsl --version
    Write-Host "✅ WSL is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ WSL is not installed" -ForegroundColor Red
    Write-Host "Installing WSL Ubuntu..." -ForegroundColor Yellow
    wsl --install -d Ubuntu
    Write-Host "⚠️  Please restart your computer and run this script again" -ForegroundColor Yellow
    pause
    exit
}

# Check if Ubuntu is installed
Write-Host "Checking Ubuntu distribution..." -ForegroundColor Yellow
$distributions = wsl --list --quiet
if ($distributions -match "Ubuntu") {
    Write-Host "✅ Ubuntu is installed" -ForegroundColor Green
} else {
    Write-Host "Installing Ubuntu..." -ForegroundColor Yellow
    wsl --install -d Ubuntu
    Write-Host "⚠️  Please complete Ubuntu setup and run this script again" -ForegroundColor Yellow
    pause
    exit
}

# Set Ubuntu as default
Write-Host "Setting Ubuntu as default WSL distribution..." -ForegroundColor Yellow
wsl --set-default Ubuntu
Write-Host "✅ Ubuntu set as default" -ForegroundColor Green

# Get current directory path
$currentPath = Get-Location
$wslPath = wsl wslpath -a "$currentPath"

Write-Host ""
Write-Host "Project Paths:" -ForegroundColor Cyan
Write-Host "  Windows: $currentPath" -ForegroundColor White
Write-Host "  WSL: $wslPath" -ForegroundColor White
Write-Host ""

# Check if VS Code is installed
Write-Host "Checking VS Code installation..." -ForegroundColor Yellow
try {
    $codeVersion = code --version
    Write-Host "✅ VS Code is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ VS Code is not installed" -ForegroundColor Red
    Write-Host "Please install VS Code from: https://code.visualstudio.com/" -ForegroundColor Yellow
    pause
    exit
}

# Install VS Code WSL extension
Write-Host ""
Write-Host "Installing VS Code WSL extension..." -ForegroundColor Yellow
code --install-extension ms-vscode-remote.remote-wsl
Write-Host "✅ WSL extension installed" -ForegroundColor Green

# Make setup script executable
Write-Host ""
Write-Host "Making setup script executable..." -ForegroundColor Yellow
wsl chmod +x "$wslPath/scripts/wsl-setup.sh"
Write-Host "✅ Setup script is executable" -ForegroundColor Green

# Option to run setup inside WSL
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Choose Setup Option:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Run full setup now (installs Node.js, dependencies, etc.)" -ForegroundColor White
Write-Host "2. Just open VS Code in WSL (setup manually later)" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Enter choice (1 or 2)"

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "Running automated setup inside WSL..." -ForegroundColor Yellow
    Write-Host "This may take a few minutes..." -ForegroundColor Yellow
    Write-Host ""

    # Run the setup script inside WSL
    wsl -d Ubuntu bash -c "cd '$wslPath' && ./scripts/wsl-setup.sh"

    Write-Host ""
    Write-Host "✅ Setup complete!" -ForegroundColor Green
}

# Open VS Code in WSL mode
Write-Host ""
Write-Host "Opening VS Code in WSL mode..." -ForegroundColor Yellow
code --remote wsl+Ubuntu "$wslPath"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ All Done!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "VS Code is now opening in WSL mode!" -ForegroundColor White
Write-Host "Look for 'WSL: Ubuntu' in the bottom-left corner" -ForegroundColor White
Write-Host ""
Write-Host "Inside VS Code terminal, you can run:" -ForegroundColor Cyan
Write-Host "  npm run dev           - Start development server" -ForegroundColor White
Write-Host "  npm run build         - Production build" -ForegroundColor White
Write-Host "  npm test              - Run tests" -ForegroundColor White
Write-Host "  npm run db:push       - Deploy database migrations" -ForegroundColor White
Write-Host ""
Write-Host "Happy coding! 🏃‍♂️" -ForegroundColor Yellow
Write-Host ""
pause
