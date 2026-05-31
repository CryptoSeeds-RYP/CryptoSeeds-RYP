# Slice 79 Evaluation - Passive Holder Rewards Net-of-Cost Model

## Goal

Turn the holder-fee bucket into a practical self-funding payout model where RYP holders can keep tokens in their own wallets and receive eligible fee distributions without staking.

## Completed

- Added a Passive Holder Rewards domain model.
- Added weekly snapshot payout accounting.
- Deducted payout delivery costs from each holder's gross allocation.
- Added roll-forward logic for dusty allocations.
- Added holder-size tiers with different payout cadence:
  - Canopy: weekly
  - Sprout: weekly
  - Seed: monthly
  - Small: quarterly
  - Micro: claim-only / roll forward
- Added excludable wallets for treasury, protocol, liquidity, project-owner, charity, and system wallets.
- Added accounting invariant tests.
- Surfaced Passive Holder Rewards in the Harvest Ledger.
- Documented the architecture in `docs/architecture/passive-holder-rewards.md`.

## Key Rule

`distributed net payouts + reserved delivery costs + rolled-forward allocations = holder reward pool`

This keeps payouts self-funding and auditable.

## CTO Note

This solves the core utility goal without requiring token migration. The current RYP mint does not need raw transfer-fee enforcement for holders to receive platform-funded rewards. It only needs reliable platform fee collection, holder snapshots, payout batching, and clear exclusion/roll-forward policy.

## Next Step

Design the on-chain reward vault and epoch account layout, then build the admin draft/export view for reward epochs and holder exclusion lists.
