# Slice 92 Evaluation - Devnet Prep And RYP Trust Surface

## Goal

Start implementing the ten-point project plan by improving deployment discipline and making RYP token trust visible in the app.

## Completed

- Added `npm run devnet:prep`.
- Added a devnet deployment-prep checker for:
  - devnet cluster/deployment env,
  - demo mode disabled,
  - broadcast still disabled during prep,
  - permanent non-placeholder program id,
  - `Anchor.toml` / `declare_id!` / env program id sync,
  - devnet test RYP mint requirement,
  - admin authority configuration,
  - Anchor IDL and compiled SBF output.
- Added the RYP trust profile in `src/domain/tokenTrust.ts`.
- Added token trust tests.
- Surfaced RYP trust state in the Protocol panel.
- Documented the devnet prep command and token trust posture.

## Current Prep Result

`npm run devnet:prep` is intentionally `BLOCKED` on the current local `.env` because it is still configured for mainnet/placeholder/demo inspection:

- cluster is not devnet,
- deployment is still placeholder,
- demo mode is enabled,
- program id is still the development placeholder,
- admin authority address is not configured.

## Safety Posture

- No broadcast path was added.
- No private key path was added.
- No live fee enforcement was added.
- Devnet is required to use a devnet test RYP mint, not the mainnet RYP mint.
- The RYP fee-route claim remains review-gated for a protocol route, wrapper, migration, or token-extension path.

## Next Step

Generate and approve a permanent devnet program keypair outside git, create a devnet test RYP mint, sync program ids, and rerun `npm run devnet:prep`.
