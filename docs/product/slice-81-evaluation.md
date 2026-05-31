# Slice 81 Evaluation - Anchor Reward Account Scaffold

## Goal

Move reward vault and epoch accounting from local review packets toward protocol-shaped Solana state without enabling live payouts.

## Completed

- Added Anchor PDA seeds for reward config, reward vault state, and reward epochs.
- Added `RewardConfig`, `RewardVaultState`, `RewardEpoch`, `RewardClaimRecord`, and `RewardExclusionList` account structs.
- Added role, custody, verification, and epoch status enums.
- Added reward setup instructions:
  - `initialize_reward_config`
  - `register_reward_vault`
  - `verify_reward_vault`
  - `draft_reward_epoch`
- Kept all reward instructions non-custodial and no-fund-movement.
- Kept drafted reward epochs explicitly `execution_blocked = true`.
- Added Rust rejection tests for split totals, cadence bounds, epoch accounting balance, and verified-vault requirements.
- Extended WSL localnet smoke coverage for reward config, vault verification, and draft epoch rejection paths.
- Updated protocol documentation.

## Safety Posture

- No claim instruction exists.
- No payout instruction exists.
- No reward vault token transfer exists.
- Vaults marked as receiving user funds are rejected.
- Epoch drafts require verified vault state for all required roles.
- Epoch drafts reject unbalanced accounting.
- Verification requires the reviewed metadata hash to match.
- Blank metadata hashes and pending custody disclosures are rejected.

## Next Step

Regenerate Anchor IDL through the WSL build path, then add frontend read-only decoding/spec documentation for the new reward accounts before any wallet-approved reward setup transaction builder is exposed.
