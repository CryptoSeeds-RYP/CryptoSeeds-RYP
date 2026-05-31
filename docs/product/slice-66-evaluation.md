# Slice 66 Evaluation - Localnet Protocol Smoke Test

## Intent

Move beyond compile-only protocol checks by proving the CryptoSeeds staking program can run against a disposable local Solana validator.

## Changes

- Added `scripts/run-anchor-localnet-smoke.mjs`.
- Added `scripts/test-anchor-localnet-wsl.ps1`.
- Added `npm run protocol:smoke:localnet:wsl`.
- Pinned `rpc-websockets` to a compatible 9.3.x version and forced its nested `uuid` dependency to `11.1.1` so Node-based Solana scripts can run cleanly in WSL without reintroducing the vulnerable v8 line.
- Documented the new localnet smoke path in README and setup/toolchain docs.

## Verification

- `npm run protocol:smoke:localnet:wsl`
- `npm audit --omit=dev`

## Result

The smoke test passes against a real local validator.

The script verifies:

- The compiled SBF program is preloaded at the declared Anchor id.
- A test RYP-like mint can be created.
- `initialize_config` creates the protocol config and vault.
- `stake_ryp` transfers Seed-tier tokens into the vault and updates stake state.
- `unstake_ryp` returns tokens and resets tier, Golden Key state, and voting state.

## Notes

The smoke test uses `solana-test-validator --bpf-program` so the repo does not need to commit a localnet program keypair. This keeps key hygiene cleaner while still proving on-chain execution.
