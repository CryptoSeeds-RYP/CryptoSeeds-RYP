# Slice 103 SeedBot Permission Hardening

Date: 2026-06-20

This slice strengthens the on-chain SeedBot permission record.

## Added

`create_seedbot_permission` now stores and validates:

- expiry timestamp,
- max trade amount,
- max daily volume amount,
- max daily trade count,
- max slippage bps,
- permission hash,
- revoke state.

## Bounds

- Permission expiry is capped at 30 days.
- Daily trade count is capped at 50.
- Slippage is capped at 500 bps.
- Daily volume must be at least the max single-trade amount.

## Updated

- Anchor account layout for `SeedBotPermission`.
- Frontend transaction planner serialization.
- Localnet smoke script parser and assertions.
- SeedBot venue router architecture note.

## Safety Boundary

This is permission-registry hardening only. It does not enable autonomous trading, custody, private-key storage, or live venue execution.
