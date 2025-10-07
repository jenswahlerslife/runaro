<#
Automated WSL (Windows Subsystem for Linux) installer

Usage:
  - Right-click this file and choose "Run with PowerShell" (or run install-wsl.bat)
  - The script self-elevates (UAC prompt) as needed
  - It enables required Windows features, then installs Ubuntu via WSL

Notes:
  - A reboot may be required. Re-run this script after reboot to continue.
  - On older Windows builds without `wsl --install`, the script enables features and sets WSL2 default; install Ubuntu from Microsoft Store if needed.
#>

[CmdletBinding()]
param(
    [switch]$SkipRebootPrompt
)

function Write-Section($text) {
    Write-Host
    Write-Host "=== $text ===" -ForegroundColor Cyan
}

function Ensure-Admin {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Write-Host "Elevating with Administrator privileges..." -ForegroundColor Yellow
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "powershell.exe"
        $scriptPath = $MyInvocation.MyCommand.Path
        $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" $($PSBoundParameters.GetEnumerator() | ForEach-Object { if ($_.Value -eq $true) { '-' + $_.Key } else { '-' + $_.Key + ' ' + $_.Value } } -join ' ')"
        $psi.Verb = "runas"
        try {
            [Diagnostics.Process]::Start($psi) | Out-Null
        } catch {
            Write-Error "User declined elevation or elevation failed. Please run this script as Administrator."
        }
        exit
    }
}

function Test-Command($name) {
    return (Get-Command $name -ErrorAction SilentlyContinue) -ne $null
}

function Has-WSLInstallSupport {
    try {
        $help = & wsl --help 2>&1 | Out-String
        return $help -match "--install"
    } catch {
        return $false
    }
}

function Enable-WSLFeatures {
    Write-Section "Enabling Windows features for WSL"
    $restartNeeded = $false
    $features = @(
        'Microsoft-Windows-Subsystem-Linux',
        'VirtualMachinePlatform'
    )
    foreach ($f in $features) {
        Write-Host "Enabling feature: $f"
        try {
            $result = Enable-WindowsOptionalFeature -Online -FeatureName $f -All -NoRestart -ErrorAction Stop
            if ($result.RestartNeeded) { $restartNeeded = $true }
        } catch {
            $errMsg = $_.Exception.Message
            Write-Warning "Failed to enable ${f}: $errMsg"
        }
    }
    return $restartNeeded
}

function Ensure-WSL2Default {
    Write-Section "Setting WSL2 as default"
    try {
        & wsl --set-default-version 2
    } catch {
        $errMsg = $_.Exception.Message
        Write-Warning "Could not set default version to 2: $errMsg"
    }
}

function Install-UbuntuViaWSL {
    Write-Section "Installing Ubuntu via WSL"
    try {
        & wsl --install -d Ubuntu
        return $LASTEXITCODE
    } catch {
        $errMsg = $_.Exception.Message
        Write-Warning "wsl --install failed: $errMsg"
        return 1
    }
}

function Download-WSLKernelUpdate {
    Write-Section "Downloading WSL2 kernel update (offline)"
    $msiUrl = "https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi"
    $tmp = Join-Path $env:TEMP "wsl_update_x64.msi"
    try {
        Invoke-WebRequest -UseBasicParsing -Uri $msiUrl -OutFile $tmp
        Write-Host "Downloaded: $tmp"
        return $tmp
    } catch {
        $errMsg = $_.Exception.Message
        Write-Warning "Failed to download kernel update: $errMsg"
        return $null
    }
}

function Install-MSI($path) {
    if (-not (Test-Path $path)) { return $false }
    Write-Host "Installing MSI: $path"
    $p = Start-Process msiexec.exe -ArgumentList "/i `"$path`" /qn /norestart" -PassThru -Wait
    if ($p.ExitCode -eq 0) { return $true }
    Write-Warning "MSI installer returned code $($p.ExitCode)"
    return $false
}

Ensure-Admin

Write-Section "WSL Installation Wizard"
Write-Host "This script will:"
Write-Host "  - Enable Windows features for WSL and virtualization"
Write-Host "  - Set WSL2 as the default"
Write-Host "  - Install Ubuntu (if supported by your Windows build)"

# Step 1: Enable features
$needsRestart = Enable-WSLFeatures

if ($needsRestart -and -not $SkipRebootPrompt) {
    Write-Host
    Write-Host "A reboot is required to complete feature installation." -ForegroundColor Yellow
    $choice = Read-Host "Reboot now? (Y/N)"
    if ($choice -match '^(Y|y)') {
        Write-Host "Rebooting in 5 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
        shutdown.exe /r /t 0
        exit
    } else {
        Write-Host "You can re-run this script after reboot to continue." -ForegroundColor Yellow
    }
}

# Step 2: Prefer the modern `wsl --install` if available
$hasInstall = Has-WSLInstallSupport
if ($hasInstall) {
    Ensure-WSL2Default
    $code = Install-UbuntuViaWSL
    if ($code -ne 0) {
        Write-Warning "wsl --install did not complete successfully (exit $code)."
        Write-Host "If you were prompted to reboot, please reboot and re-run the script." -ForegroundColor Yellow
    } else {
        Write-Host "wsl --install completed. If prompted, reboot, then complete Ubuntu's first-run user setup." -ForegroundColor Green
    }
} else {
    # Fallback path for older Windows builds
    Write-Section "Fallback path for older Windows builds"
    $msi = Download-WSLKernelUpdate
    if ($msi) {
        if (Install-MSI $msi) {
            Write-Host "WSL2 kernel installed." -ForegroundColor Green
        }
    }
    Ensure-WSL2Default
    Write-Host
    Write-Host "Your Windows build does not support 'wsl --install'." -ForegroundColor Yellow
    Write-Host "Install Ubuntu from Microsoft Store, then run 'wsl -l -v' to verify."
}

Write-Section "Verification"
try {
    & wsl -l -v
} catch {
    Write-Host "WSL not fully initialized yet. Reboot may be pending; complete any prompts and re-run verification." -ForegroundColor Yellow
}

Write-Host
Write-Host "Done. If Ubuntu did not launch automatically, reboot and run this script again or launch 'Ubuntu' from Start Menu to complete first-run setup." -ForegroundColor Cyan

