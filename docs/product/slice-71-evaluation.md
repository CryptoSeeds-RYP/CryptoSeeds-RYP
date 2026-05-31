# Slice 71 Evaluation - Devnet Readiness and Broadcast Gate

## Intent

Prepare the project for devnet without creating an accidental live broadcast path.

The product should remain simple: preview, simulate, sign exactly the simulated message, then stop until deployment and broadcast readiness are explicitly reviewed.

## Changes

- Added `VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT`.
- Added `VITE_SOLANA_BROADCAST_ENABLED`.
- Added `PLACEHOLDER_PROTOCOL_PROGRAM_ID` to central config.
- Added `src/solana/solanaBroadcastReadiness.ts`.
- Added broadcast-readiness state to transaction intents.
- Added a transaction-panel section that explains broadcast blockers after signature.
- Added `scripts/check-devnet-readiness.mjs`.
- Added `npm run devnet:readiness`.
- Changed `.env.example` to default to localnet, demo mode, placeholder deployment, and broadcast disabled.

## Verification

- `npm test -- src/solana/solanaBroadcastReadiness.test.ts src/solana/solanaTransactionBoundary.test.ts src/services/transactionIntentService.test.ts`
- `npm run build`
- `npm run devnet:readiness`

## Result

The readiness model blocks broadcast unless all core conditions are satisfied:

- verified signed wallet receipt
- non-placeholder program id
- deployment status matching the selected cluster
- demo mode disabled
- broadcast flag enabled
- prepared instruction program ids matching the configured protocol program id
- non-mainnet cluster for this stage

The repo-level readiness script currently reports `BLOCKED`, which is correct while the local `.env` still uses the placeholder program id.

## CTO Note

This is the right kind of simplicity. We did not add a sender yet. We added a clear answer to: "Why can't this broadcast?" That keeps the user experience transparent and keeps the protocol work honest while we prepare the real devnet deployment.

## Next Recommended Step

Create a controlled devnet deployment plan:

- generate a permanent program keypair outside git
- sync `declare_id!`, `Anchor.toml`, frontend env, and docs
- deploy to devnet
- initialize protocol config and vault
- run localnet, IDL, app, copy, visual, token, and devnet readiness checks
- only then review whether to add a send/broadcast boundary
