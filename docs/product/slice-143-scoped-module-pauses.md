# Slice 143 - Scoped Protocol Module Pauses

## Goal

Reduce operational blast radius by adding module-level pause flags alongside the existing global protocol pause.

## Implemented Direction

- Global pause remains available for broad incidents.
- Protocol authority can independently pause staking, governance, projects, SeedBot permission usage, or fee routing.
- Scoped pause state is stored on `ProtocolConfig` as `module_pause_flags`.
- Frontend transaction planning exposes `set_module_pause` with validated module flags.
- Read-only protocol config inspection now reports active module pause flags.

## Safety Notes

- New errors are appended to preserve existing custom error codes.
- Scoped pauses do not move funds or bypass wallet approval.
- Project safety operations such as operator revocation, project-level pause, cancellation, and refund accounting should remain available where practical.
- Devnet deployment remains blocked until the devnet authority wallet is funded.

## Verification Target

- Rust unit tests cover valid/invalid module flags and scoped pause checks.
- Localnet smoke covers setting/clearing the staking module pause and blocking `unstake_ryp` while active.
- IDL/spec/layout checks must pass before commit.
