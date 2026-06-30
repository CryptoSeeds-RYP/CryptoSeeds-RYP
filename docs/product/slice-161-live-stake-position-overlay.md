# Slice 161: Live Stake Position Overlay

## Scope

This slice prepares the frontend to use decoded protocol stake-position accounts once devnet/localnet protocol state exists.

## Changes

- Added a pure protocol snapshot overlay for decoded `StakePosition` inspections.
- Converted staked RYP base units into UI RYP amounts using configured decimals.
- Updated snapshot source handling to include `LIVE_PROTOCOL_ACCOUNT`.
- Wired `useMicroVerseState` to run read-only stake-position inspection for real wallets when protocol deployment is not placeholder.
- Kept missing, blocked, or unsafe stake-position inspections conservative: the real wallet remains in live read-only/no-stake state.
- Added tests for clean decoded stake overlays, blocked overlays, unknown tiers, and base-unit conversion.

## Safety Position

The overlay is read-only. It does not sign, broadcast, create stake state, mint NFTs, or infer wallet rights from fixtures. Stake, Golden Key, voting, governance, harvest, and project-slot state only move from conservative live-wallet state to active protocol state when decoded account inspection is clean.

## Verification

- Protocol snapshot overlay tests
- Full app regression before push
