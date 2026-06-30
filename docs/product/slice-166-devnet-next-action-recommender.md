# Slice 166: Devnet Next-Action Recommender

## Scope

This slice adds a read-only deployment operator helper for resuming devnet work without interpreting the full status and receipt reports manually.

## Changes

- Added `npm run devnet:next -- --env .env.devnet.example`.
- The helper runs existing read-only status checks and, when appropriate, protocol/readiness checks.
- It emits one recommended next command, the reason, risk level, and any manual funding action.
- It is included in ops readiness checks and the devnet deployment runbook.

## Safety Position

The recommender is read-only. It does not request airdrops, create keypairs, create the mint, deploy the program, initialize protocol state, sign transactions, or enable frontend broadcast.

## Verification

- `devnet:next` local run
- Ops readiness
- TypeScript/app regression before push
