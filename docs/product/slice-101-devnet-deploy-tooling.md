# Slice 101 Devnet Deploy Tooling

Date: 2026-06-20

This slice adds safe deployment tooling for the first devnet protocol deploy.

## Added

- `npm run devnet:program:check`
- `npm run devnet:deploy:wsl`
- `scripts/check-devnet-program.mjs`
- `scripts/deploy-devnet-protocol-wsl.ps1`

## Behavior

`devnet:program:check` reads a devnet env file and checks whether the configured program account exists, is executable, and is owned by Solana's upgradeable BPF loader.

`devnet:deploy:wsl` runs:

1. Anchor build with `--ignore-keys`.
2. IDL drift check.
3. Strict devnet prep.
4. Anchor deploy with ignored local keypairs.
5. Devnet program inspection.

## Safety Boundaries

- Keypair files remain under ignored `target/devnet`.
- Keypair contents are never printed.
- Deploy refuses to continue while strict devnet prep is blocked.
- App broadcast remains disabled.
- No protocol initialization or admin transaction broadcast is hidden inside the deploy wrapper.

## Current Blocker

The devnet authority wallet still has `0 SOL`, so the configured devnet test mint cannot be created and strict devnet prep remains blocked.
