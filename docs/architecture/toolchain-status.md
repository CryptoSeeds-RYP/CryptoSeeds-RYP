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
npm run protocol:smoke:localnet:wsl
```

Native Linux/WSL commands:

```bash
npm run protocol:build
npm run protocol:test
```

## Program ID Policy

The current Anchor program id has been synced for localnet/devnet prep:

`5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb`

The matching keypair is local-only under ignored `target/devnet/cryptoseeds_protocol-keypair.json`. `anchor build --ignore-keys` remains useful for local verification, while devnet deployment remains blocked until the devnet authority is funded and the devnet test RYP mint exists.

Before deployment:

- Fund the devnet authority wallet.
- Create the devnet test RYP mint.
- Run `npm run devnet:prep -- --env .env.devnet.example`.
- Review the key-management plan before any public deployment.

## Current Result

The WSL route is now the primary Solana/Anchor path.

- `npm run protocol:build:wsl` passes.
- `npm run protocol:test:wsl` passes.
- `npm run protocol:smoke:localnet:wsl` passes against a disposable local validator.
- `npm run protocol:check:win` and `npm run protocol:test:win` remain useful host-side Rust checks.
