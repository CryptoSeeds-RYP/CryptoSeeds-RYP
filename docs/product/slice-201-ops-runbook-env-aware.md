# Slice 201: Ops Runbook Env-Aware Commands

## Scope

This slice makes the Governance Hall ops runbook render devnet commands from the configured ops env file.

## Changes

- Added `buildMaintenanceRunbook` so runbook command text can use a selected ops env file.
- Kept the default exported runbook pointed at `.env.devnet.example`.
- Updated Governance Hall to render the runbook from `appConfig.opsEnvFile`.
- Reused the safe ops env-file reader so unsafe command text falls back to `.env.devnet.example`.
- Added regression tests for default, custom, and unsafe env values.

## Safety Position

This is an operator-display change. It does not sign, broadcast, deploy, create keypairs, move funds, initialize protocol accounts, or change any transaction planner.

## Verification

- Operations model tests
- App build
- Full local and CI verification before push
