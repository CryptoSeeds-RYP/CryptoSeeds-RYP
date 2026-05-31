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

Anchor now includes the first reward-account scaffold:

| Account | Purpose |
| --- | --- |
| `RewardConfig` | Reward authority, mint, vault roles, epoch cadence, pause flags |
| `RewardVaultState` | Role, mint, vault address, verification metadata hash |
| `RewardEpoch` | Snapshot timestamp, pool amount, net payout total, delivery cost reserve, rollover total |
| `RewardClaimRecord` | Wallet, epoch, claimed amount, delivery cost, rollover, claim state |
| `RewardExclusionList` | Hash or registry pointer for excluded wallets |

Current reward instructions:

| Instruction | Purpose | Movement |
| --- | --- | --- |
| `initialize_reward_config` | Creates reward config and split/cadence policy | No funds |
| `register_reward_vault` | Registers one role-specific vault state as pending verification | No funds |
| `verify_reward_vault` | Marks a reviewed vault state as verified when metadata hash matches | No funds |
| `draft_reward_epoch` | Creates a balanced, execution-blocked epoch draft | No funds |

No claim or payout instruction exists yet.

Reward logic remains modular from staking until the full claim, batching, exclusion-list, and authority review is complete.

## Protocol Rejection Rules

The Anchor validation layer rejects:

- non-authority reward setup,
- reward split totals that do not equal 10,000 bps,
- zero or out-of-bounds reward cadence,
- zero reward pools,
- unbalanced epoch accounting,
- disabled vaults,
- unverified vaults,
- vault states with the wrong role, reward mint, or reward config,
- vault states marked as receiving user funds,
- default/empty vault addresses,
- blank metadata hashes,
- vaults with pending custody disclosure,
- metadata-hash mismatches during verification.

These checks are covered by Rust unit tests in `programs/cryptoseeds_protocol/src/lib.rs` and the WSL localnet smoke flow in `scripts/run-anchor-localnet-smoke.mjs`.

## Current Implementation

Local domain model:

- `src/domain/rewardVaults.ts`
- `src/domain/rewardVaults.test.ts`

The model builds review-gated reward epoch drafts and serializes bigint accounting into JSON strings for review packets.

Protocol model:

- `programs/cryptoseeds_protocol/src/lib.rs`

The protocol model stores reward config, vault verification state, and draft epochs only. It keeps `execution_blocked = true` on drafted epochs.
