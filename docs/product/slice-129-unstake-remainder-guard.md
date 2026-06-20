# Slice 129: Unstake Remainder Guard

## Purpose

Prevent users from accidentally leaving a below-Seed residual stake that has no MicroVerse access.

## Implemented

- Added an unstake remainder validation rule.
- Full unstake to zero remains allowed.
- Partial unstake is allowed only when the remaining stake still maps to an active tier.
- The validation runs before the token transfer CPI.
- Added Rust unit coverage for zero exit, valid Seed remainder, and invalid below-Seed remainder.

## Boundaries

- This does not change staking tier thresholds.
- This does not add lockups.
- This does not prevent users from fully exiting.
- Existing below-tier states should not exist after this guard is deployed, but migration policy should still be reviewed before mainnet.

## Deferred

- UI warning before partial unstake.
- Admin/indexer detection for any legacy below-tier positions.
- Optional dust-sweep flow if a legacy below-tier position is ever found.
