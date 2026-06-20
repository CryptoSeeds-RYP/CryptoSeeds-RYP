# WSL and Solana Setup Status

Date: 2026-05-31

## Current Status

WSL is now usable for the CryptoSeeds Solana/Anchor development lane.

- Default WSL distribution: `Ubuntu-24.04`
- WSL default version: `2`
- Installed distribution: `Ubuntu-24.04`, version `2`
- Ubuntu release: `Ubuntu 24.04.4 LTS`
- WSL kernel: `6.6.114.1-microsoft-standard-WSL2`
- Current WSL user for automated commands: `root`
- Linux Rust/Cargo: `1.96.0`
- Solana/Agave CLI: `solana-cli 3.1.10`
- Anchor CLI: `anchor-cli 1.0.2`
- AVM: `1.0.2`
- Node.js in WSL: `v18.19.1`
- npm in WSL: `9.2.0`

The repo can now run Anchor build and protocol unit-test checks through WSL from Windows PowerShell.

## Commands

From the repo root in Windows PowerShell:

```powershell
npm run wsl:check
npm run protocol:build:wsl
npm run protocol:idl:check
npm run protocol:test:wsl
npm run protocol:smoke:localnet:wsl
```

Inside WSL directly:

```bash
cd /mnt/c/Users/FiercePC/Desktop/crypto-seeds-microverse
npm run protocol:build
npm run protocol:test
```

## Program ID Note

The current synced localnet/devnet program id in `Anchor.toml` and `declare_id!` is:

```text
5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb
```

The matching devnet program keypair is generated locally under ignored `target/devnet/cryptoseeds_protocol-keypair.json`.
The devnet authority keypair is generated locally under ignored `target/devnet/devnet-authority.json`.
The planned devnet test RYP mint keypair is generated locally under ignored `target/devnet/ryp-test-mint-keypair.json`.

For the current development stage, use:

```bash
anchor build --ignore-keys
```

Before devnet deployment, fund the devnet authority wallet, create the devnet test RYP mint, and rerun:

```powershell
npm run devnet:prep -- --env .env.devnet.example
```

## Verification

Verified on 2026-05-31:

```powershell
npm run protocol:build:wsl
npm run protocol:test:wsl
```

`protocol:build:wsl` completed an Anchor build and IDL generation path.

`protocol:idl:check` compares the frontend wallet instruction spec against the generated Anchor IDL.

`protocol:test:wsl` ran the Anchor test script, which now executes:

```bash
cargo test --manifest-path programs/cryptoseeds_protocol/Cargo.toml
```

Current protocol unit-test result:

```text
4 passed; 0 failed
```

`protocol:smoke:localnet:wsl` runs the IDL drift check, starts a disposable local Solana validator, and verifies:

- `initialize_config`
- rejected duplicate tier thresholds
- rejected below-Seed stake
- `stake_ryp`
- rejected early voting-right activation
- rejected mismatched-owner unstake
- rejected oversized unstake
- top-up from Seed to Sprout without resetting voting eligibility
- rejected partial unstake that would leave below-Seed stake dust
- partial unstake from Sprout to Seed without losing Golden Key state
- rejected non-authority pause
- pause enforcement for stake, unstake, and voting activation
- `unstake_ryp`

The localnet smoke test preloads the compiled SBF program with `solana-test-validator --bpf-program`, so it does not require committing or funding a local program keypair.

## Follow-Up

Create a non-root WSL development user before this becomes the daily long-term development environment. The current root-based setup is acceptable for bootstrap automation, but a normal Linux user is cleaner for ongoing local development.
