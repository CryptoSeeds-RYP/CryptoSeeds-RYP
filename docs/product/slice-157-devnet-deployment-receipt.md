# Slice 157: Devnet Deployment Receipt

## Scope

This slice adds a read-only deployment receipt for devnet release review.

## Changes

- Added `npm run devnet:deployment:receipt`.
- Added `scripts/prepare-devnet-deployment-receipt.mjs`.
- The receipt aggregates devnet status, program inspection, protocol-state inspection, public testnet readiness, and the local program artifact hash.
- Added read-only and wallet-execution receipt profiles.
- Added focused receipt tests.
- Added the command to ops readiness and setup documentation.

## Safety Position

The receipt is read-only. It does not deploy, initialize, submit transactions, enable frontend broadcast, or authorize launch. It exists to make release review harder to misread after devnet funding and initialization.

## Verification

- Receipt CLI tests
- Ops readiness
- Full app and protocol checks before push
