# Slice 120: Project Participation Accounting

## Purpose

Project records now enforce participation minimums and total allocation caps.

This keeps project participation self-custodial while preventing the protocol record from accepting arbitrary, below-minimum, or over-cap participation amounts.

## Added

- `min_participation_amount` argument on `register_project`.
- `max_total_participation_amount` argument on `register_project`.
- `min_participation_amount` on `ProjectRecord`.
- `max_total_participation_amount` on `ProjectRecord`.
- `total_participation_amount` on `ProjectRecord`.
- Participation recording now increments both wallet count and total participation amount.
- Rejection for invalid project participation bounds.
- Rejection for below-minimum participation amounts.
- Rejection for over-cap participation amounts.
- TypeScript transaction planner support for project min/max participation inputs.
- Localnet smoke coverage for invalid bounds and initial cap/accounting fields.

## Rules

- Project minimum participation must be greater than zero.
- Project max total participation must be greater than or equal to the minimum.
- Each participation amount must meet the project minimum.
- Total recorded participation cannot exceed the project cap.
- This is accounting only; project participation still does not custody funds.

## Deferred

- Positive project participation cap update in localnet after a safe approved-governance test path exists.
- Wallet-approved project funding transfer composition.
- Participation top-up or withdrawal accounting.

## Verification

- `npm.cmd run protocol:check:win`
- `npm.cmd run protocol:test:win`
- `npm.cmd run protocol:build:wsl`
- `npm.cmd run protocol:idl:check`
- `npm.cmd test -- --run src/solana/protocolTransactionPlan.test.ts`
- `npm.cmd run protocol:smoke:localnet:wsl`
