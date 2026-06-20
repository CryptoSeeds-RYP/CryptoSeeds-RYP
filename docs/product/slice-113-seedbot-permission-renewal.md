# Slice 113 - SeedBot Permission Renewal

Added a user-signed SeedBot permission update path.

## What Changed

- Added `update_seedbot_permission` to the Anchor program.
- The wallet owner can renew or update an existing SeedBot permission record.
- The update path:
  - requires the protocol to be unpaused,
  - requires the wallet owner signer,
  - requires the permission to belong to the owner,
  - requires the permission to still point at the owner's stake position,
  - requires an active staking tier,
  - validates the same expiry, trade-size, daily-volume, trade-count, and slippage limits as creation,
  - refreshes the stake snapshot fields,
  - intentionally reactivates a revoked permission only when the owner signs the update.
- Added transaction-plan support for `UPDATE_SEEDBOT_PERMISSION`.
- Extended localnet smoke to create, revoke, then renew a SeedBot permission.

## Why It Matters

The previous single-PDA permission model allowed creation and revocation, but no owner-signed renewal path.

That would make revoked permissions terminal and would also make periodic permission refresh awkward. This change keeps the model self-custodial and revocable while allowing explicit wallet-approved renewal.

This does not enable live trading, agent signing, custody, or order broadcast.
