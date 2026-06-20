# Slice 105: Reward Merkle Claim Records

## Outcome

Added a proof-backed claim-record path for holder and staker reward epochs.

Wallets can now create their own reviewed reward claim record by submitting a Merkle proof against the epoch `claim_merkle_root`. This keeps the weekly holder/staker distribution model scalable without requiring the authority to initialize every wallet claim record one by one.

## Protocol Changes

- `RewardEpoch` now stores `claim_merkle_root`.
- `draft_reward_epoch` accepts the reviewed claim root alongside the exclusion-list hash.
- `create_reward_claim_record_from_proof` initializes a wallet-owned claim record after validating:
  - reviewed epoch state,
  - holder/staker role only,
  - balanced claim accounting,
  - non-empty epoch Merkle root,
  - capped Merkle proof depth,
  - leaf fields bound to epoch PDA, role, wallet, gross amount, delivery cost, net amount, rollover amount, and leaf index.
- Existing authority-created claim records remain available for controlled operations.

## Safety Notes

- No user seed phrases or custody are involved.
- The wallet pays for and signs its own proof-backed claim-record creation.
- Token movement still only happens through `claim_reward_tokens` from verified program-controlled reward vaults.
- Zero-net rollover claims still use `claim_reward_record` and move no funds.
- This does not create a global transfer tax on the existing SPL token.

## Verification

- Anchor build passed.
- IDL drift check passed for 26 instruction plans and 11 account layouts.
- WSL localnet smoke passed, including:
  - reviewed epoch with claim Merkle root,
  - authority-created holder token claim,
  - proof-created staker rollover claim,
  - duplicate holder claim rejection,
  - read-only admin reward inspection.
