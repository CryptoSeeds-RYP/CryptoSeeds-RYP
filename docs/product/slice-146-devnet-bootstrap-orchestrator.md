# Slice 146 - Devnet Bootstrap Orchestrator

## Goal

Make the devnet deployment path easier for an operator or agent to run without memorizing the full command sequence.

## Implemented Direction

- Added `npm run devnet:bootstrap`.
- Default mode is read-only and strict: authority funding check, devnet status, deployment prep, and program inspection.
- Mutating actions require explicit flags:
  - `--fund` tries staged devnet airdrops.
  - `--mint` creates the configured devnet test mint.
  - `--deploy` deploys the Anchor program through WSL.
  - `--init-plan` prints the protocol initialization plan.
  - `--execute-init` executes protocol initialization.
- The wrapper prints a final step summary and next actions.

## Safety Notes

- No devnet account creation, deployment, or initialization happens in the default mode.
- Required mutating steps stop immediately on failure.
- Existing direct commands remain available for manual operation and debugging.
