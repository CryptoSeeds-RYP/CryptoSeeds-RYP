# Slice 96 Reward Token Claim Path

Date: 2026-06-20

This slice moves reward claims from record-only accounting toward a real, guarded payout path while keeping Admin execution exposure closed.

## Added On Chain

- Added role-keyed reward claim records so the same wallet can have separate holder and staker claims in one epoch.
- Added epoch-level recorded gross, recorded net, and claimed net totals.
- Added `claim_reward_tokens` for wallet-approved reward token transfer from verified program-controlled vaults.
- Restricted wallet claim roles to holder and staker reward buckets.
- Kept `claim_reward_record` as a zero-net rollover-only path.

## Safety Boundaries

- Token claims require a reviewed epoch.
- Token claims require a verified `RewardVaultState`.
- Token claims require `ProgramControlled` custody.
- Token claims reject duplicate claim records.
- Token claims reject over-payment beyond reviewed distributed net amount.
- Reward record creation rejects claim totals beyond reviewed epoch totals.
- Treasury, delivery-cost, and rollover roles cannot be claimed as wallet payout roles.

## Frontend/Tooling

- Expanded protocol transaction builders for reward claims, governance votes, project participation, SeedBot permissions, and fee config updates.
- Updated account layout manifests for the new reward epoch and claim record fields.
- Updated reward inspection decoding to expose recorded and claimed epoch totals.
- Updated localnet smoke to prove a holder token payout and a staker rollover record in the same epoch.

## Verification

- Rust unit tests now cover claim role restrictions, epoch claim caps, and program-controlled vault requirements.
- `protocol:idl:check` covers 24 instructions and 11 account layouts.
- WSL localnet smoke passes with an actual reward vault token transfer.

## Remaining Protocol Work

- Fund the devnet authority wallet and create the devnet RYP test mint.
- Deploy the expanded program to devnet.
- Add production batching/export tooling for holder and staker claim records.
- Add admin review UI for claim totals before record creation.
- Keep public reward-claim UI disabled until devnet inspection and final compliance copy are reviewed.
