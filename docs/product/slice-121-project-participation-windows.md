# Slice 121: Project Participation Windows

Project records now enforce per-wallet participation caps and explicit allocation windows.

This keeps project participation self-custodial while giving the protocol stronger guardrails for when participation can happen and how much one wallet can record.

## Added

- `max_wallet_participation_amount` argument on `register_project`.
- `participation_starts_at` argument on `register_project`.
- `participation_ends_at` argument on `register_project`.
- Matching fields on `ProjectRecord`.
- Registration rejection for invalid allocation windows.
- Participation rejection when the current timestamp is outside the allocation window.
- Participation rejection when a wallet records more than the project wallet cap.
- TypeScript transaction planner support for the new project fields.
- Localnet smoke coverage for invalid allocation windows and stored project cap/window accounting.

## Rules

- Project minimum participation must be greater than zero.
- Project wallet cap must be greater than or equal to the minimum.
- Project total allocation cap must be greater than or equal to the wallet cap.
- Participation end timestamp must be greater than the start timestamp.
- A wallet participation amount must be within the project minimum and wallet cap.
- Total recorded project participation cannot exceed the project allocation cap.
- This is accounting only; project participation still does not custody funds.

## Deferred

- Positive public project participation smoke path after approved-governance execution wiring exists.
- Wallet-approved project funding transfer composition.
- User top-up or partial-withdraw participation records.
- Project cancellation and refund accounting.
