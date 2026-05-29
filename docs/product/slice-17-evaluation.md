# Slice 17 Evaluation - Publish and Linux Toolchain Helpers

## Built

- Added `scripts/publish-github.ps1` for repeatable GitHub repo creation and push.
- Added `scripts/setup-wsl-solana.ps1` for elevated Windows WSL/Ubuntu feature setup.
- Added `scripts/setup-solana-anchor-linux.sh` for Linux Rust, Solana/Agave, AVM, and Anchor setup inside WSL.

## Current Status

- Target GitHub repo name: `CryptoSeeds-RYP`.
- Connected GitHub app profile: `CryptoSeeds-RYP`.
- GitHub CLI is installed but not authenticated.
- `gh auth login` was launched in a visible PowerShell window, but CLI auth is not complete yet.
- WSL is not installed.
- Elevated WSL setup was attempted, but the UAC prompt was canceled.

## Required User Actions

1. Complete GitHub CLI login:

   ```powershell
   gh auth login --hostname github.com --git-protocol https --web
   ```

2. Run WSL setup from an elevated PowerShell:

   ```powershell
   C:\Users\FiercePC\Desktop\crypto-seeds-microverse\scripts\setup-wsl-solana.ps1
   ```

3. Reboot if Windows requests it.

4. After Ubuntu is installed, run the Linux setup script inside WSL:

   ```bash
   cd /mnt/c/Users/FiercePC/Desktop/crypto-seeds-microverse
   bash scripts/setup-solana-anchor-linux.sh
   ```

## Verification Before This Slice

- Local repo is committed and clean before helper-script changes.
- Previous app checks passed:
  - `npm test`
  - `npm run build`
  - `npm audit --audit-level=moderate`
  - `npm run token:check`
  - `cargo fmt -- --check`

## Next Step After Auth

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\publish-github.ps1 -RepoName CryptoSeeds-RYP -Visibility private
```

