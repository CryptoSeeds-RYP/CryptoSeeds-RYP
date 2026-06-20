# Slice 97 Reward Claim Batch Planner

Date: 2026-06-20

This slice adds preview-only batch planning for holder/staker reward claim records.

## Added

- Added `src/solana/rewardClaimBatchPlan.ts`.
- Converts a balanced holder reward epoch into role-keyed `create_reward_claim_record` plans.
- Adds wallet-side claim previews:
  - `claim_reward_tokens` for positive net payouts when a verified source vault is supplied.
  - `claim_reward_record` for zero-net rollover records.
- Skips excluded wallets and zero-allocation records.
- Summarizes gross, delivery-cost, net-claim, and rollover totals for review.
- Blocks batches when payout totals no longer match reviewed epoch totals.

## Safety Boundaries

- The planner is `PREVIEW_ONLY`.
- It does not sign, broadcast, create claim records, or move funds.
- Admin record creation and wallet token claiming remain separate transaction paths.
- Positive wallet claims remain marked `SOURCE_VAULT_REQUIRED` until a verified reward source vault address is provided.

## Verification

- Added `src/solana/rewardClaimBatchPlan.test.ts`.
- Tests cover pay-now claims, rollover claims, excluded wallets, missing source vault warnings, and mismatched epoch totals.
