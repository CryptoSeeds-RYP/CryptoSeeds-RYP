# Slice 115: SeedBot Usage Accounting

## Purpose

SeedBot permissions now include on-chain usage accounting before any DEX execution route is exposed.

The permission record still does not custody funds, store private keys, or execute trades. It records wallet-signed usage against explicit caps so a later reviewed trading executor can compose against the same guardrail.

## Added

- `record_seedbot_usage` Anchor instruction.
- Owner-signed usage recording only.
- Permission checks for revoked, expired, current stake, trade size, daily volume, daily trade count, and slippage.
- Daily usage window reset after 24 hours.
- Lifetime usage totals and last execution timestamp.
- `SeedBotUsageRecorded` event.
- TypeScript transaction planner for `record_seedbot_usage`.
- SeedBot permission account inspection fields for usage counters.
- Localnet smoke coverage for allowed usage and rejected daily-cap breach.

## Not Added

- No DEX integration.
- No autonomous trading executor.
- No delegated bot authority.
- No backend custody or private-key handling.

## Verification

- `npm.cmd run protocol:check:win`
- `npm.cmd run protocol:test:win`
- `npm.cmd run protocol:build:wsl`
- `npm.cmd run protocol:idl:check`
- `npm.cmd run protocol:smoke:localnet:wsl`
- `npm.cmd test -- --run`
- `npm.cmd run build`
- `npm.cmd run ops:check`
- `npm.cmd audit`
- `npm.cmd run copy:audit`
- `npm.cmd run visual:audit`
- `npm.cmd run protocol:admin:fixture:check`

## Devnet Status

The code is ready for devnet deployment once the devnet authority is funded, the devnet RYP test mint is created, and `devnet:prep` passes.
