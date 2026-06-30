# Slice 200: Admin Ops Env File

## Scope

This slice makes Admin Mission Control and the Devnet Deployment Inspector use a single configured ops env file when displaying local operator commands.

## Changes

- Added `VITE_OPS_ENV_FILE` to the app config with `.env.devnet.example` as the default.
- Restricted `VITE_OPS_ENV_FILE` to safe file-path characters before rendering copyable commands.
- Routed Admin Mission Control devnet commands through the configured ops env file.
- Routed Devnet Deployment Inspector next actions and operator handoff commands through the configured ops env file.
- Added regression coverage for default and custom ops env command output.

## Safety Position

This is a display/readiness-layer change only. It does not sign, broadcast, deploy, create keypairs, initialize accounts, or change protocol transaction plans.

## Verification

- Config reader tests
- Admin mission-control tests
- Devnet deployment-inspection tests
- Full local and CI verification before push
