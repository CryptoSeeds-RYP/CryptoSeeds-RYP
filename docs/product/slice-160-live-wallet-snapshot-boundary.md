# Slice 160: Live Wallet Snapshot Boundary

## Scope

This slice prevents real connected wallets from inheriting fixture staking state while devnet protocol accounts are not live.

## Changes

- Split protocol services so tests can inject token-balance reads without RPC.
- Kept tier simulation available for the demo wallet only.
- Real wallets now show connected status and RYP balance, but no fabricated stake, Golden Key, Voting Rights, harvest, or governance state.
- SeedBot unlocks for real wallets only when they hold RYP or have active stake.
- Added service tests for demo simulation, real wallet no-stake state, and zero-RYP SeedBot locking.

## Safety Position

The frontend must not imply a real wallet has staked, earned NFTs, unlocked governance, or claimable rewards unless those states are backed by decoded protocol accounts. Until devnet stake accounts are live, real wallet state remains conservative.

## Verification

- Protocol snapshot service tests
- Full app regression before push
