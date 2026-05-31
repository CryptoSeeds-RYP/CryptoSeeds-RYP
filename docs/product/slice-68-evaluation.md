# Slice 68 Evaluation - Voting Gate and Stake Transition Checks

## Intent

Extend the localnet staking smoke test so it verifies governance timing and stake transition invariants, not only one deposit and one full withdrawal.

The focus is the governance promise: Voting Rights must not activate until the 14-day staking delay has elapsed, and stake changes must not silently reset or corrupt that timer.

## Changes

- Added localnet coverage for rejected early `activate_voting_rights`.
- Added localnet coverage for rejected unstake amounts above the wallet's staked balance.
- Added a Seed-to-Sprout top-up flow.
- Verified top-ups preserve `staking_start_ts` and `voting_rights_eligible_ts`.
- Added a Sprout-to-Seed partial unstake flow.
- Verified partial unstake preserves Golden Key state when the remaining stake is still Seed tier.
- Verified partial unstake preserves the original voting eligibility timer.
- Added pause coverage for `activate_voting_rights`.
- Expanded `StakePosition` parsing in the smoke test so timestamp, vote count, and bump fields can be asserted.

## Verification

- `npm run protocol:smoke:localnet:wsl`

## Result

The localnet smoke test now verifies:

- `reject_early_voting_activation`
- `reject_insufficient_unstake`
- `stake_top_up_to_sprout`
- `partial_unstake_back_to_seed`
- `pause_blocks_voting_activation`

The flow also confirms final full unstake returns all test RYP to the owner wallet and resets the active Golden Key and Voting Rights state.

## Security Notes

This gives the staking program stronger executable coverage for:

- governance delay enforcement
- no accidental timer reset on top-up
- no accidental receipt loss on partial unstake that remains tier-qualified
- insufficient-stake rejection before vault movement
- pause coverage across staking, unstaking, and voting activation

The current local validator route does not expose runtime clock-warp RPC. Positive activation after the full 14-day delay should be tested with a dedicated harness or a future configurable test-only delay path before devnet launch.

## Next Recommended Protocol Checks

- Add a dedicated voting-right activation success test with controlled time.
- Add restake-after-full-unstake coverage proving the timer resets across zero-stake gaps.
- Add client simulation tests that compare `src/solana/protocolTransactionPlan.ts` account metas with localnet execution.
- Add IDL drift checks once the devnet program id is approved.
