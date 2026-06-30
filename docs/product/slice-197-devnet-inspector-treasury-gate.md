# Slice 197: Devnet Inspector Treasury Gate

## Change

- Removed the protocol-state inspector's implicit admin-authority treasury fallback.
- Made `devnet:inspect:protocol` require `VITE_INDEPENDENT_TREASURY_ADDRESS`.
- Added a blocker when the configured independent treasury address equals the admin authority wallet.
- Made protocol-inspection next actions respect the selected env file instead of hard-coding `.env.devnet.example`.

## Reason

Read-only inspection is part of the public-readiness gate. It should validate the same treasury separation policy as the deployment path, even though it does not need the treasury owner secret to inspect already-initialized accounts.

## Safety Boundary

The inspector remains read-only. It does not load or require the treasury owner secret, sign transactions, create accounts, initialize protocol state, move funds, or enable frontend wallet execution.
