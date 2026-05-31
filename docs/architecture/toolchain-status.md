# Toolchain Status

Current machine status:

- Node.js on Windows: installed
- npm on Windows: installed through `npm.cmd`
- Rust on Windows: installed in user profile
- Cargo on Windows: installed in user profile
- Windows host-side Rust check path: available through `stable-x86_64-pc-windows-gnullvm` and portable LLVM-MinGW
- WSL package: installed
- WSL default distribution: `Ubuntu-24.04`
- WSL default version: `2`
- Ubuntu 24.04: installed and running as a WSL2 distribution
- Linux Rust/Cargo: `1.96.0`
- Linux Solana/Agave CLI: `solana-cli 3.1.10`
- Linux Anchor CLI / AVM: `1.0.2`
- Linux Node.js: `v18.19.1`
- Linux npm: `9.2.0`

## Verified Rust

Windows host-side:

- `rustc 1.96.0`
- `cargo 1.96.0`

WSL:

- `rustc 1.96.0`
- `cargo 1.96.0`
- `solana-cli 3.1.10`
- `anchor-cli 1.0.2`

## Commands

Windows host-side Rust checks:

```powershell
npm run protocol:check:win
npm run protocol:test:win
```

WSL Solana/Anchor checks from Windows PowerShell:

```powershell
npm run protocol:build:wsl
npm run protocol:test:wsl
```

Native Linux/WSL commands:

```bash
npm run protocol:build
npm run protocol:test
```

## Program ID Policy

The current Anchor program id is a development placeholder. `anchor build --ignore-keys` is intentionally used until we approve and sync a permanent devnet/mainnet program keypair.

Before deployment:

- Generate the real program keypair.
- Run `anchor keys sync`.
- Update `.env.example` and frontend config defaults.
- Review the key-management plan before any public deployment.

## Current Result

The WSL route is now the primary Solana/Anchor path.

- `npm run protocol:build:wsl` passes.
- `npm run protocol:test:wsl` passes.
- `npm run protocol:check:win` and `npm run protocol:test:win` remain useful host-side Rust checks.
