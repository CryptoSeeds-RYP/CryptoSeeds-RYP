# Slice 198: Devnet No Treasury Fallback

## Change

- Removed the remaining admin-authority fallback from devnet treasury address derivation.
- Kept `devnet:status`, `devnet:vaults:prep`, `devnet:init:protocol`, and `devnet:inspect:protocol` aligned on explicit `VITE_INDEPENDENT_TREASURY_ADDRESS`.
- Made reward-vault prep and protocol initialization next actions respect the selected env file.

## Reason

The deployment path should fail closed. A missing independent treasury address must never silently derive or display admin-owned treasury targets.

## Safety Boundary

This is deployment-readiness hardening only. It does not create keypairs, sign transactions, deploy programs, initialize protocol state, move funds, or enable frontend wallet execution.
