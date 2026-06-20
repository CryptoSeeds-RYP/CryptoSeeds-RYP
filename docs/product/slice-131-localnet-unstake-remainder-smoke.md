# Slice 131: Localnet Unstake Remainder Smoke

## Purpose

Extend localnet smoke coverage so the deployed Anchor instruction rejects below-Seed partial unstake remainders, not only the Rust unit helper.

## Implemented

- Added a localnet smoke assertion from Sprout stake state.
- The smoke flow now attempts an unstake that would leave 4,000 RYP staked.
- The expected result is the `StakeBelowSeedTier` custom error.
- The smoke flow verifies vault balance and stake-position amount remain unchanged after rejection.
- Updated the WSL Solana status checklist.

## Boundaries

- This is localnet deployment smoke coverage only.
- It does not deploy to devnet.
- It does not add a public unstake form.

## Deferred

- Run the same flow against devnet after funding, mint creation, deployment, and protocol initialization.
- Add a live stake-position powered unstake input to the UI.
