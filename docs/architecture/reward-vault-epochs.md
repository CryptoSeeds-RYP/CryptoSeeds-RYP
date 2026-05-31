# Reward Vault and Epoch Drafts

This document defines the next CryptoSeeds reward infrastructure slice.

The goal is to prepare holder and staker reward accounting without enabling live payouts before protocol deployment and review gates.

## Reward Vault Roles

Every reward epoch draft should reference exactly one vault for each role:

| Role | Purpose |
| --- | --- |
| Holder reward | Funds Passive Holder Rewards for self-custodial RYP holders |
| Staker reward | Funds staking-specific rewards |
| Independent treasury | Receives the treasury fee bucket |
| Delivery cost reserve | Tracks payout delivery costs deducted from holder allocations |
| Rollover | Tracks dusty, small, or deferred holder allocations |

Draft vault config must include:

- label,
- reward mint,
- address or explicit pending status,
- custody model,
- verification status,
- notes,
- `receivesUserFunds = false`.

Reward vaults should never be presented as user custody accounts.

## Epoch Draft Flow

1. Collect platform/action fees into fee vault accounting.
2. Split fees by holder, staker, treasury, and any review-gated buckets.
3. Prepare a holder snapshot.
4. Exclude treasury, protocol, project-owner, charity, liquidity, and other system wallets as policy requires.
5. Build the Passive Holder Rewards epoch.
6. Validate accounting:

   `distributed net payouts + reserved delivery costs + rolled-forward allocations = holder reward pool`

7. Attach vault configs.
8. Export draft JSON for review.
9. Only after review, prepare devnet instructions.

## MVP Safety Rules

- Admin UI is draft/export only.
- No payout transaction from the Admin Dashboard.
- No reward vault movement from the Admin Dashboard.
- No mainnet action while program id is placeholder or broadcast is disabled.
- No holder payout if accounting does not balance.
- No duplicate vault address inside a draft.
- No disabled vault role inside a draft.
- No vault marked as receiving user funds.

## On-Chain Direction

Future Anchor accounts should likely include:

| Account | Purpose |
| --- | --- |
| `RewardConfig` | Reward authority, mint, vault roles, epoch cadence, pause flags |
| `RewardVaultState` | Role, mint, vault address, verification metadata hash |
| `RewardEpoch` | Snapshot timestamp, pool amount, net payout total, delivery cost reserve, rollover total |
| `RewardClaimRecord` | Wallet, epoch, claimed amount, delivery cost, rollover, claim state |
| `RewardExclusionList` | Hash or registry pointer for excluded wallets |

This should remain modular from staking until reward logic is fully reviewed.

## Current Implementation

Local domain model:

- `src/domain/rewardVaults.ts`
- `src/domain/rewardVaults.test.ts`

The model builds review-gated reward epoch drafts and serializes bigint accounting into JSON strings for review packets.
