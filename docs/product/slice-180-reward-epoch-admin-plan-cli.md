# Slice 180 - Reward Epoch Admin Plan CLI

## Scope

This slice adds a plan-only operations command for reward epoch admin lifecycle preparation.

## Changes

- Added `npm run rewards:epoch:admin-plan`.
- Added `scripts/prepare-reward-epoch-admin-plan.mjs`.
- The command chains the holder reward claim-packet pipeline, then emits reviewed planner inputs for:
  - `buildDraftRewardEpochTransactionPlan`,
  - `buildReviewRewardEpochTransactionPlan`,
  - `buildCancelRewardEpochTransactionPlan`.
- The packet validates:
  - holder claim-packet readiness,
  - positive reward pool,
  - balanced net, delivery-cost, and rollover accounting,
  - bounded claim window,
  - bounded reward cadence,
  - non-future snapshot timestamp,
  - snapshot age inside cadence,
  - nonzero claim Merkle root.
- The command derives a deterministic exclusion-list hash from excluded snapshot rows.
- Ops readiness and mission status now require the admin reward epoch plan script.

## Safety

The command is plan-only. It does not sign, broadcast, create epochs, review epochs, cancel epochs, create claim records, or move tokens.

## Devnet Status

No devnet transaction was submitted in this slice. Devnet remains blocked until the authority wallet receives devnet SOL.
