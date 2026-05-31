# Slice 65 Evaluation - WSL Anchor Toolchain Ready

## Intent

Complete the WSL route for Solana/Anchor development and turn the protocol checks into repeatable project commands.

## Changes

- Installed and verified Ubuntu 24.04 as a WSL2 distribution.
- Bootstrapped Linux Rust, Solana/Agave CLI, AVM, and Anchor CLI.
- Added Linux Node.js/npm to the Solana/Anchor setup script because `anchor test` invokes Node.
- Added `idl-build` wiring to the Anchor program manifest.
- Added known Anchor/Solana cfg feature entries so Rust 1.96 protocol output stays readable.
- Replaced the placeholder Anchor test script with a real protocol unit-test command.
- Added Windows-to-WSL npm wrappers:
  - `npm run protocol:build:wsl`
  - `npm run protocol:test:wsl`
- Updated WSL/toolchain documentation to reflect the now-working Linux path.

## Verification

- `npm run protocol:build:wsl`
- `npm run protocol:test:wsl`

## Result

The Anchor program now builds through WSL and the protocol unit tests pass.

Current unit-test count:

```text
4 passed; 0 failed
```

## Notes

The current Anchor program id is still a development placeholder. The build wrapper uses `anchor build --ignore-keys` until a permanent program keypair is generated and synced before deployment.
