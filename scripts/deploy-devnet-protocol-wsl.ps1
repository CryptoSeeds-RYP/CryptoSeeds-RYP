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

function ConvertTo-WslPathLiteral {
  param([string]$Path)

  $fullPath = [System.IO.Path]::GetFullPath($Path)
  if ($fullPath -notmatch "^([A-Za-z]):\\(.*)$") {
    throw "Only Windows drive paths are supported for WSL conversion: $fullPath"
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
$programSoPath = Join-Path $repoRoot "programs/cryptoseeds_protocol/target/deploy/cryptoseeds_protocol.so"

$wslRepoRoot = ConvertTo-WslPath $repoRoot
$wslEnvPath = ConvertTo-WslPath $resolvedEnvPath
$wslAuthorityPath = ConvertTo-WslPath $resolvedAuthorityPath
$wslProgramKeypairPath = ConvertTo-WslPath $resolvedProgramKeypairPath
$wslProgramSoPath = ConvertTo-WslPathLiteral $programSoPath

$linuxPath = "/root/.cargo/bin:/root/.local/share/solana/install/active_release/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
$command = @(
  "export PATH=$linuxPath",
  "cd $(Quote-Bash $wslRepoRoot)",
  "anchor build --ignore-keys",
  "node scripts/check-protocol-idl-drift.mjs",
  "node scripts/prepare-devnet-deployment.mjs --env $(Quote-Bash $wslEnvPath) --strict",
  "test -f $(Quote-Bash $wslProgramSoPath)",
  "anchor program deploy $(Quote-Bash $wslProgramSoPath) --provider.cluster devnet --provider.wallet $(Quote-Bash $wslAuthorityPath) --program-keypair $(Quote-Bash $wslProgramKeypairPath) --commitment confirmed --no-idl -- --use-quic --skip-preflight --max-sign-attempts 30 --with-compute-unit-price 5000",
  "node scripts/check-devnet-program.mjs --env $(Quote-Bash $wslEnvPath) --strict"
) -join " && "

Write-Host "Deploying cryptoseeds_protocol to devnet with local ignored keypairs."
Write-Host "Env: $resolvedEnvPath"
Write-Host "Authority: $resolvedAuthorityPath"
Write-Host "Program keypair: $resolvedProgramKeypairPath"
Write-Host "Program artifact: $programSoPath"
Write-Host "No keypair contents will be printed."

wsl.exe -d $Distro -- bash -lc $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
