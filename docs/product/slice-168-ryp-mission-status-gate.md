# Slice 168: RYP Mission Status Gate

## Summary

Added a read-only mission-status command that maps the current RYP execution plan into a single operator report.

## Changes

- Added `npm run mission:status -- --env .env.devnet.example`.
- Added `scripts/check-ryp-mission-status.mjs`.
- Aggregates ops readiness, devnet next-action recommendation, and read-only public testnet readiness.
- Maps the ten mission phases to `LOCAL_READY`, `REVIEW_REQUIRED`, `READY_FOR_REVIEW`, `WAITING_ON_DEVNET`, or `BLOCKED`.
- Surfaces the current devnet funding blocker and the next safe command/manual action.
- Added mission-status to ops readiness and the operations runbook.
- Added unit coverage for funding-blocked, mutation-ready, read-only-ready, malformed child-output, and JSON parsing cases.
- Added operator documentation in `docs/setup/ryp-mission-status.md`.

## Safety Notes

- The mission-status command is read-only.
- It does not create keypairs, submit transactions, deploy programs, initialize accounts, or enable broadcast.
- Devnet mutation steps remain explicit next actions and require separate operator approval.

## Current Expected Result

Until the devnet authority receives SOL, the report should remain `MISSION_BLOCKED` with `fund_devnet_authority` as the active recommendation.
