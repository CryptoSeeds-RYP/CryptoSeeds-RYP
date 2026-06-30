# Slice 155: Mint Funding Boundary

## Scope

This slice removes implicit faucet funding from the devnet mint creation path.

## Changes

- Updated `scripts/create-devnet-test-mint.mjs` so it fails closed when the authority has less than `0.1` devnet SOL.
- The mint command now points operators to `npm run devnet:funding:packet -- --env .env.devnet.example`.
- Added an ops regression test confirming the mint mutation path does not call `requestAirdrop`.
- Updated devnet deployment docs to document the funding boundary.

## Safety Position

Mint creation is a mutation command. It should create the configured devnet SPL mint only after funding is present. Faucet requests and manual funding handoff stay in the funding helper/packet layer.

## Current Expected Result

Until the devnet authority is funded, `npm run devnet:mint:test -- --env .env.devnet.example` should report `BLOCKED` instead of requesting an airdrop.

## Verification

- Syntax check for the mint script
- Focused mint-boundary test
- Full app regression and ops checks before push
