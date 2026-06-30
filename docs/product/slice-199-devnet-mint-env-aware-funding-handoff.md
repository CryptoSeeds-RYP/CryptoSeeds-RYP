# Slice 199: Devnet Mint Env-Aware Funding Handoff

## Scope

This slice tightens the devnet test mint blocker output so it respects the env file selected by the operator.

## Changes

- Added a single `envSource` value to `scripts/create-devnet-test-mint.mjs`.
- Reused `envSource` in mint status output and the missing-funding handoff.
- Updated the mint CLI regression test to reject the old hard-coded `.env.devnet.example` funding hint.

## Safety Position

The mint command remains a mutation command and still refuses to request faucet airdrops. If the authority wallet has insufficient devnet SOL, it exits with `BLOCKED` and points to the read-only funding packet for the selected env file.

## Verification

- Focused mint CLI regression test
- Expected blocked output while the devnet authority remains unfunded
- Full local and CI verification before push
