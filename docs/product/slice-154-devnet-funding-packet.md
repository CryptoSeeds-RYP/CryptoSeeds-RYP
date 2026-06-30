# Slice 154: Devnet Funding Packet

## Scope

This slice adds a read-only funding handoff packet for the devnet authority blocker.

## Changes

- Added `scripts/prepare-devnet-funding-packet.mjs`.
- Added `npm run devnet:funding:packet`.
- The packet reports:
  - authority public address,
  - current SOL balance,
  - minimum top-up for mint creation,
  - recommended top-up for program deployment,
  - devnet-only warning,
  - Solana devnet faucet option,
  - existing-devnet-wallet transfer option,
  - post-funding command sequence through the bootstrap orchestrator and read-only deployment receipt.
- Added focused tests for missing funding, mint-ready funding, deploy-ready funding, and invalid config.
- Added the funding packet to the operations model and devnet deployment docs.

## Safety Position

This command is read-only. It does not request airdrops, sign transactions, hold private keys, move funds, deploy programs, or initialize protocol state.

## Current Expected Result

Until the authority wallet is funded, the command should report `FUNDING_REQUIRED` with the public authority address:

```text
Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe
```

Minimum funding is `0.1` devnet SOL for mint creation. Recommended funding is `3` devnet SOL for deployment headroom.

## Verification

- Syntax check for the new script
- Focused funding packet tests
- Full app regression and ops checks before push
