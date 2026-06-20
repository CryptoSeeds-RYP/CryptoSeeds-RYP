# Slice 108: Proof-Backed Wallet Claim Plans

## Outcome

Added the wallet-first planning layer for proof-backed reward claims.

The reward system now has a complete local planning chain:

1. Build holder reward epoch.
2. Export claim Merkle root and wallet proofs.
3. Build wallet transaction previews from those proofs.
4. Wallet signs `create_reward_claim_record_from_proof`.
5. Wallet signs either `claim_reward_tokens` or `claim_reward_record` depending on net claim amount.

## Added

- `buildRewardClaimMerkleWalletPlan`
- `RewardClaimMerkleWalletPlan`
- Tests proving:
  - every wallet record uses `create_reward_claim_record_from_proof`,
  - pay-now records build `claim_reward_tokens` when a source vault is supplied,
  - rollover records build `claim_reward_record`,
  - pay-now records remain blocked when no verified source vault is supplied.

## Design Rule

The public reward path should be wallet-created and proof-backed.

The authority-created `create_reward_claim_record` path remains useful for operations, recovery, and controlled internal flows, but it should not be the primary public holder/staker claim route.

## Safety Notes

- This is still preview-only.
- No transaction is signed or broadcast by this planner.
- Wallets keep custody.
- A verified reward source vault is required before positive token-claim previews are considered complete.
