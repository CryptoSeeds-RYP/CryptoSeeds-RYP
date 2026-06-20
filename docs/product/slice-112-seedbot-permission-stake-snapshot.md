# Slice 112 - SeedBot Permission Stake Snapshot

Added stake-state snapshots to the on-chain SeedBot permission record.

## What Changed

`SeedBotPermission` now stores:

- `tier_at_creation`,
- `staked_amount_at_creation`,
- `staking_start_ts_at_creation`.

`SeedBotPermissionCreated` now emits:

- permission position,
- created timestamp,
- tier at creation,
- staked amount at creation.

The localnet smoke parser and tracked account layout were updated to verify the new fields.

## Why It Matters

SeedBot guarded automation must stay permission-scoped and revocable.

The permission record now captures the stake state that justified permission creation. Future execution checks can compare the current stake position against this snapshot before allowing any guarded automation path.

This does not enable live trading, custody, signing, or broadcast. It only strengthens the permission registry before any execution layer exists.
