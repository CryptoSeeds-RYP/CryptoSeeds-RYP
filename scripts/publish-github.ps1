param(
  [string]$RepoName = "CryptoSeeds-RYP",
  [string]$Visibility = "private"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $Name"
  }
}

Require-Command "git"
Require-Command "gh"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$status = git -c "safe.directory=$repoRoot" status --short
if ($status) {
  throw "Working tree is not clean. Commit or stash changes before publishing."
}

gh auth status

$currentBranch = git -c "safe.directory=$repoRoot" branch --show-current
if ($currentBranch -ne "main") {
  git -c "safe.directory=$repoRoot" branch -M main
}

$existingRemote = git -c "safe.directory=$repoRoot" remote get-url origin 2>$null
if (-not $existingRemote) {
  gh repo create $RepoName "--$Visibility" --source . --remote origin --push
} else {
  git -c "safe.directory=$repoRoot" push -u origin main
}

gh repo view $RepoName --web

