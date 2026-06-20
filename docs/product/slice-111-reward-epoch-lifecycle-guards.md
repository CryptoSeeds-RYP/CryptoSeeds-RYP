# Slice 111 - Reward Epoch Lifecycle Guards

Tightened the Anchor reward epoch lifecycle before devnet deployment.

## What Changed

- `review_reward_epoch` now requires the epoch to:
  - match the requested reward config,
  - match the configured RYP reward mint,
  - still be in `Drafted` status,
  - still have `execution_blocked = true`,
  - have no recorded or claimed amounts,
  - have balanced reward accounting,
  - have a non-zero `claim_merkle_root`.
- `cancel_reward_epoch` now rejects cancellation once claim accounting has started.
- Authority-created and proof-created claim record paths now explicitly validate the epoch/config/mint binding before recording claim amounts.
- Added `InvalidRewardEpochConfig` for clearer client and log failures.

## Why It Matters

The project is moving toward wallet-created, proof-backed, self-custodial reward claims.

Requiring a claim Merkle root before review keeps the public reward path verifiable and prevents accidentally approving a reward epoch that can only be serviced through authority-created records.

Rejecting cancellation after claim accounting starts avoids partially serviced epochs being silently shut off after some wallet records or claims have already been recorded.

This does not change account sizes, PDA seeds, or custody behavior.
