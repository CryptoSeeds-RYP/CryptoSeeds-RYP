# Slice 151: Public Testnet Readiness CLI

## Scope

This slice adds a repo-level readiness command for public devnet review.

## Changes

- Added `scripts/check-public-testnet-readiness.mjs`.
- Added `npm run testnet:readiness`.
- The command aggregates:
  - ops readiness,
  - devnet status,
  - devnet broadcast readiness,
  - devnet program inspection.
- The command is non-mutating by default and emits one machine-readable JSON report.
- Broadcast disabled remains a blocker for wallet-enabled public testnet readiness; a read-only preview can be reviewed separately from execution enablement.
- Added strict mode for CI/release gates.
- Added focused tests for ready aggregation, sourced blockers, child command failures, and noisy JSON parsing.
- Added setup documentation for the public testnet readiness gate.
- Added the new script and document to the ops readiness checklist.

## Safety Position

This does not fund wallets, create the devnet mint, deploy the program, initialize protocol state, or enable frontend broadcast. It is a decision gate before public testnet review, not an execution command.

## Expected Current Result

The command should report `BLOCKED` until the devnet authority wallet is funded, the configured devnet test mint exists, and the configured program account is deployed.

## Verification

- `node --check scripts/check-public-testnet-readiness.mjs`
- Focused CLI tests
- Full verification should include the standard app, ops, copy, visual, audit, and diff checks before push.
