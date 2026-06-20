# Slice 110 - Reward Event Audit Fields

Added more audit data to reward epoch and reward claim events in the Anchor program.

## What Changed

- `RewardEpochDrafted` now emits:
  - `snapshot_taken_at`,
  - `reward_mint`,
  - `exclusion_list_hash`,
  - `claim_merkle_root`.
- `RewardEpochReviewed` now emits:
  - `claim_merkle_root`,
  - `execution_blocked`.
- `RewardEpochCancelled` now emits:
  - `execution_blocked`.
- `RewardClaimRecordCreated`, `RewardClaimProofVerified`, and `RewardClaimed` now emit:
  - `claim_record`,
  - `delivery_cost_amount`.
- `RewardClaimed` also emits `rolled_forward_amount`.

## Why It Matters

Reward distribution needs clear public audit trails.

These events make it easier for admin logs, indexers, dashboards, and future verification tooling to prove which reviewed root, wallet claim record, and payout accounting values were used without relying only on raw account decoding.

This does not change account sizes, PDA seeds, or token custody behavior.
