# Slice 156: Bootstrap Post-init Gates

## Scope

This slice makes the devnet bootstrap orchestrator carry the operator through post-initialization inspection and read-only public readiness.

## Changes

- Added `--inspect-protocol` to `scripts/devnet-bootstrap.mjs`.
- Added `--read-only-ready` to `scripts/devnet-bootstrap.mjs`.
- `--execute-init` now implies both protocol-state inspection and read-only public readiness.
- Bootstrap output now includes `inspectProtocol` and `readOnlyReady` mode flags.
- Bootstrap status parsing now tolerates noisy child stdout by parsing the last JSON object candidate.
- Updated the funding packet command sequence to use `npm run devnet:bootstrap -- --env .env.devnet.example --execute-init`.
- Updated devnet deployment docs.
- Added focused bootstrap CLI regression tests.

## Safety Position

The new post-init gates are read-only. They do not sign additional transactions, enable frontend broadcast, or bypass review. They only inspect initialized protocol state and check read-only public testnet readiness after protocol initialization.

## Verification

- Focused bootstrap CLI tests
- Funding packet tests
- Full app regression and ops checks before push
