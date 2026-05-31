param(
  [string]$Distro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Stop"

function ConvertTo-WslPath {
  param([string]$Path)

  $resolvedPath = (Resolve-Path $Path).Path
  if ($resolvedPath -notmatch "^([A-Za-z]):\\(.*)$") {
    throw "Only Windows drive paths are supported for WSL conversion: $resolvedPath"
  }

  $drive = $Matches[1].ToLowerInvariant()
  $relativePath = $Matches[2] -replace "\\", "/"
  return "/mnt/$drive/$relativePath"
}

$repoRoot = Join-Path $PSScriptRoot ".."
$wslRepoRoot = ConvertTo-WslPath $repoRoot
$linuxPath = "/root/.cargo/bin:/root/.local/share/solana/install/active_release/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
$escapedRepoRoot = $wslRepoRoot.Replace("'", "'\''")
$command = "export PATH=$linuxPath; cd '$escapedRepoRoot' && anchor build --ignore-keys && node scripts/run-anchor-localnet-smoke.mjs"

wsl.exe -d $Distro -- bash -lc $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
