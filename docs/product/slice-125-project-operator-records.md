# Slice 125: Project Operator Records

## Purpose

Add project-scoped operator records so a reviewed project can delegate limited operational actions without sharing protocol authority, reward authority, treasury authority, or project-owner wallets.

## Implemented

- Added a `ProjectOperatorRecord` PDA derived from `project-operator + project + operator`.
- Added permission bits for project status updates and project pause toggles.
- Added mandatory expiry timestamps for operator records.
- Added `grant_project_operator` and `revoke_project_operator` instructions controlled by the separated project authority.
- Added operator-only project pause and project status instructions.
- Blocked inactive/revoked operators.
- Blocked operators from cancellation/rejection/governance-transition status paths.
- Added TypeScript transaction-plan builders, instruction specs, layout metadata, and localnet smoke coverage.

## Boundaries

- Operators do not receive protocol authority.
- Operators do not receive project authority.
- Operators cannot move funds.
- Operators cannot change reward vaults, fee settings, treasury routing, staking state, or SeedBot permissions.
- Operators cannot cancel projects or record refund accounting.
- Operator grants must expire within the bounded project-operator permission window and must be renewed deliberately.

## Deferred

- Operator dashboard controls.
- Operator multisig support.
- Operator metadata/disclosure records.
- Operator event indexing for admin audit views.
