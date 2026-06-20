param(
  [string]$Distro = "Ubuntu-24.04",
  [string]$EnvPath = ".env.devnet.example",
  [string]$AuthorityPath = "target/devnet/devnet-authority.json",
  [string]$ProgramKeypairPath = "target/devnet/cryptoseeds_protocol-keypair.json"
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

function Quote-Bash {
  param([string]$Value)
  return "'" + $Value.Replace("'", "'\''") + "'"
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resolvedEnvPath = Resolve-Path (Join-Path $repoRoot $EnvPath)
$resolvedAuthorityPath = Resolve-Path (Join-Path $repoRoot $AuthorityPath)
$resolvedProgramKeypairPath = Resolve-Path (Join-Path $repoRoot $ProgramKeypairPath)

$wslRepoRoot = ConvertTo-WslPath $repoRoot
$wslEnvPath = ConvertTo-WslPath $resolvedEnvPath
$wslAuthorityPath = ConvertTo-WslPath $resolvedAuthorityPath
$wslProgramKeypairPath = ConvertTo-WslPath $resolvedProgramKeypairPath

$linuxPath = "/root/.cargo/bin:/root/.local/share/solana/install/active_release/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
$command = @(
  "export PATH=$linuxPath",
  "cd $(Quote-Bash $wslRepoRoot)",
  "anchor build --ignore-keys",
  "node scripts/check-protocol-idl-drift.mjs",
  "node scripts/prepare-devnet-deployment.mjs --env $(Quote-Bash $wslEnvPath) --strict",
  "anchor deploy -p cryptoseeds_protocol --provider.cluster devnet --provider.wallet $(Quote-Bash $wslAuthorityPath) --program-keypair $(Quote-Bash $wslProgramKeypairPath) --commitment confirmed --no-idl",
  "node scripts/check-devnet-program.mjs --env $(Quote-Bash $wslEnvPath) --strict"
) -join " && "

Write-Host "Deploying cryptoseeds_protocol to devnet with local ignored keypairs."
Write-Host "Env: $resolvedEnvPath"
Write-Host "Authority: $resolvedAuthorityPath"
Write-Host "Program keypair: $resolvedProgramKeypairPath"
Write-Host "No keypair contents will be printed."

wsl.exe -d $Distro -- bash -lc $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
