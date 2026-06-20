# Slice 117: Reward Claim Expiry

## Purpose

Reward epochs now have on-chain claim windows and expired-unclaimed accounting.

This implements the protocol-side foundation for the rule that unclaimed rewards can be redistributed after the approved claim window. The slice records redistribution accounting only; it does not move expired funds.

## Added

- `claim_window_seconds` argument on `draft_reward_epoch`.
- `claim_expires_at` on `RewardEpoch`.
- `expired_unclaimed_net_amount` on `RewardEpoch`.
- `expired_recorded_at` on `RewardEpoch`.
- `Expired` reward epoch status.
- `expire_reward_epoch_claims` Anchor instruction.
- Claim paths now reject after the epoch claim window closes.
- Localnet smoke coverage for a short-window epoch expiry.
- TypeScript transaction planner for `expire_reward_epoch_claims`.
- Admin reward inspection support for expired/blocked epochs.

## Rules

- Claim windows must be greater than zero and no longer than 366 days.
- Reviewed epochs are claimable only before `claim_expires_at`.
- Expiring an epoch records `distributed_net_amount - claimed_net_amount`.
- Expired epochs become execution-blocked and no longer accept claims.
- Expiration does not move tokens.

## Deferred

- Actual redistribution route for expired unclaimed funds.
- Public UI for expired reward epochs.
- Operational policy for default claim window length.

## Verification

- `npm.cmd run protocol:check:win`
- `npm.cmd run protocol:test:win`
- `npm.cmd run protocol:build:wsl`
- `npm.cmd run protocol:idl:check`
- `npm.cmd run protocol:smoke:localnet:wsl`
