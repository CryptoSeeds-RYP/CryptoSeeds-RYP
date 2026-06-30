# Slice 162: SeedBot Permission Inspection

## Scope

This slice exposes read-only SeedBot permission account inspection in the user-facing SeedBot Terminal.

## Changes

- Added live SeedBot permission inspection state to the MicroVerse state hook.
- Kept the read gated to real wallets on configured protocol deployments.
- Displayed the permission account status, lifecycle, cap snapshot, daily usage, expiry, warnings, and blockers in the SeedBot Terminal.
- Preserved MVP execution safety: order status, cancel, kill switch, allocation, signing, and automation remain disabled or explicitly wallet-approved through existing transaction previews.

## Safety Position

The SeedBot permission inspection is read-only. It does not request private keys, sign trades, broadcast orders, enable delegated execution, or infer permissions from demo state. Missing or failed reads leave the terminal conservative.

## Verification

- TypeScript build
- SeedBot/reward inspection tests
- Full app regression before push
