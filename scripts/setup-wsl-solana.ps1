$ErrorActionPreference = "Stop"

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script from an elevated PowerShell session."
  }
}

Assert-Admin

Write-Host "Enabling Windows Subsystem for Linux..." -ForegroundColor Cyan
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -All -NoRestart

Write-Host "Enabling Virtual Machine Platform..." -ForegroundColor Cyan
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -All -NoRestart

Write-Host "Attempting Ubuntu installation..." -ForegroundColor Cyan
wsl.exe --install -d Ubuntu

Write-Host ""
Write-Host "If Windows asks for a reboot, reboot before continuing Solana/Anchor setup." -ForegroundColor Yellow
Write-Host "After Ubuntu opens, create the Linux user, then run scripts/setup-solana-anchor-linux.sh inside WSL." -ForegroundColor Yellow

