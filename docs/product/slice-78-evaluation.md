# Slice 78 Evaluation - Fee Router and 1% RYP Transfer Fee

## Goal

Capture the clarified tokenomics direction: RYP token transfers should target a 1% fee, using the same holder, staker, and independent treasury bucket model as the wider platform fee policy.

## Completed

- Added a dedicated fee-router domain model.
- Added the 1% RYP transfer-fee policy.
- Kept the existing 3.5% platform/action fee separate from the token-transfer fee.
- Added fee quote and fee distribution helpers in base units.
- Added validation for holder/staker/treasury splits.
- Surfaced fee-route drafts in the Admin Dashboard.
- Updated the Governance Hall fee policy panel.
- Documented Solana enforcement options and the wrapper/migration/token-extension decision.
- Updated RYP mint checks to report the token program owner.

## Fee Memory

- RYP token-transfer fee target: 1%.
- Transfer-fee buckets: holders, stakers, independent treasury.
- Platform/action fee: 3.5% before tier reductions.
- Tier reductions remain: Seed 3.5%, Sprout 3.15%, Sapling 2.8%, Tree 2.45%, Fruit 2.1%.
- Exact holder/staker/treasury split percentages remain configurable.

## CTO Note

The MVP can enforce fees on CryptoSeeds-controlled actions. Enforcing a fee on every raw wallet-to-wallet RYP transfer requires a reviewed wrapper, migration, or Solana token-extension route.

## Next Step

Build the admin draft/export layer for fee split proposals and prepare the protocol account design for holder/staker/treasury accrual.
