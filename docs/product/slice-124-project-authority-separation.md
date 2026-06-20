# Slice 124: Project Authority Separation

Project administration now has its own authority path.

This reduces god-wallet concentration by separating project registry and project emergency controls from core protocol configuration.

## Added

- `project_authority` on `ProtocolConfig`.
- `pending_project_authority` on `ProtocolConfig`.
- `transfer_project_authority` instruction.
- `accept_project_authority` instruction.
- Two-step project authority rotation events.
- Project admin validation helper separate from protocol authority validation.
- TypeScript transaction planners for project authority transfer and acceptance.
- Localnet smoke coverage for project authority transfer, acceptance, and stale project authority rejection.

## Project Authority Controls

The project authority now controls:

- project registration,
- project lifecycle status updates,
- project participation pause toggles,
- project cancellation accounting,
- project refund accounting.

The main protocol authority still controls:

- protocol fee config,
- global pause,
- governance proposal creation and closing,
- reward config initialization,
- protocol authority rotation.

## Rules

- Project authority starts as the protocol authority during config initialization.
- Current project authority nominates a pending project authority.
- Pending project authority must sign acceptance.
- Protocol authority rotation does not silently overwrite project authority.
- No project authority path custodies or transfers user funds.

## Deferred

- Admin Dashboard project-authority inspection and proposal controls.
- Production multisig/timelock configuration.
- Project-operator sub-authority roles.
