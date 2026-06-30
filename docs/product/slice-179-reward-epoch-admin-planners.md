# Slice 179 - Reward Epoch Admin Planners

## Scope

This slice adds frontend transaction planners for the admin reward epoch lifecycle before devnet deployment.

## Changes

- Added `DRAFT_REWARD_EPOCH`, `REVIEW_REWARD_EPOCH`, and `CANCEL_REWARD_EPOCH` prepared transaction actions.
- Added `buildDraftRewardEpochTransactionPlan` with local guards for:
  - positive reward pool amount,
  - balanced net, delivery-cost, and rollover accounting,
  - bounded claim window,
  - bounded reward cadence,
  - non-future snapshot timestamp,
  - snapshot age within the configured cadence,
  - nonzero claim Merkle root.
- Added review and cancel planners that derive the correct reward epoch accounts and carry state-review warnings.
- Added delivery-cost reserve and rollover vault state address resolution for draft epoch account ordering.

## Verification

- `npm.cmd run test -- src/solana/protocolTransactionPlan.test.ts`
- `npm.cmd test`
- `npm.cmd run build`
- `npm.cmd run ops:check`
- `npm.cmd run copy:audit`
- `npm.cmd run visual:audit`
- `npm.cmd run protocol:idl:check`
- `npm.cmd audit --audit-level=moderate`
- `git diff --check`
- `npm.cmd run protocol:build:wsl`
- `npm.cmd run protocol:test:wsl`
- `npm.cmd run protocol:smoke:localnet:wsl`

## Devnet Status

No devnet transaction was submitted in this slice. Devnet remains blocked until the authority wallet receives devnet SOL.
