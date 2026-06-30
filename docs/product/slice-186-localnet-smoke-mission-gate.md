# Slice 186 - Localnet Smoke Mission Gate

## Scope

This slice makes the WSL Anchor/localnet smoke test part of the visible mission verification gate.

## Changes

- Added `protocol:smoke:localnet:wsl` to the mission status required-script set.
- Added the smoke command to the full local verification command shown by `npm run mission:status`.
- Added the same smoke command to Admin Mission Control's local verification phase.
- Updated mission/admin tests and mission-status documentation.

## Safety

The smoke command runs against a disposable local validator. It does not deploy to devnet, mutate mainnet, broadcast wallet actions, or use the production RYP mint.

## Verification

`npm run protocol:smoke:localnet:wsl` passed before this slice was committed, covering staking, reward vaults, platform fee routing, holder claims, governance, project records, refunds, SeedBot permission usage limits, pause controls, authority transfers, and stale-authority rejection.
