# Slice 138: Holder Reward Snapshot Guardrails

## Implemented

- Hardened `scripts/prepare-holder-reward-epoch.mjs` before payout math runs.
- Added strict reward input checks for:
  - valid Solana reward mint,
  - valid holder wallet public keys,
  - duplicate holder snapshot rows by canonical wallet address,
  - nonnegative base-unit amounts,
  - nonzero reward pool,
  - valid ISO timestamps,
  - valid and unique payout cadences,
  - valid reward vault public keys,
  - duplicate reward vault addresses.
- Added CLI regression tests that execute the real reward epoch draft script with temporary JSON input.
- Aligned the app-side reward draft model so zero reward pools block review instead of only warning.

## Security Boundary

- This remains review/export tooling only.
- No wallet signing, broadcast, claim-record creation, or token movement is exposed by the reward epoch draft command.
- Bad holder snapshots now fail closed before they can become review packets.

## Verification

- Focused CLI tests pass.
- Existing reward epoch draft example still produces a review-required packet.
