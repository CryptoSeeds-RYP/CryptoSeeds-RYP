$ErrorActionPreference = "Stop"

Write-Host "Checking WSL prerequisites..." -ForegroundColor Cyan

$systemInfo = systeminfo
$virtualizationLine = $systemInfo | Select-String -Pattern "Virtualization Enabled In Firmware"
$vmExtensionsLine = $systemInfo | Select-String -Pattern "VM Monitor Mode Extensions"
$slatLine = $systemInfo | Select-String -Pattern "Second Level Address Translation"

function Write-DetectedLine {
  param(
    [object]$Line,
    [string]$Fallback
  )

  if ($Line) {
    Write-Host $Line
  } else {
    Write-Host $Fallback
  }
}

Write-Host ""
Write-Host "Firmware virtualization:" -ForegroundColor Cyan
Write-DetectedLine $vmExtensionsLine "VM Monitor Mode Extensions: unknown"
Write-DetectedLine $virtualizationLine "Virtualization Enabled In Firmware: unknown"
Write-DetectedLine $slatLine "Second Level Address Translation: unknown"

Write-Host ""
Write-Host "WSL status:" -ForegroundColor Cyan
try {
  wsl --status
} catch {
  Write-Host "wsl --status failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installed distributions:" -ForegroundColor Cyan
try {
  wsl -l -v
} catch {
  Write-Host "wsl -l -v failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Expected ready state:" -ForegroundColor Cyan
Write-Host "- Virtualization Enabled In Firmware: Yes"
Write-Host "- Ubuntu listed by wsl -l -v"
Write-Host "- Ubuntu version: 2"
