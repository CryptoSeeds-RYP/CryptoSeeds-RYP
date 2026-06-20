# Slice 119: Project Governance Binding

## Purpose

Project registration and lifecycle updates now bind to a real on-chain `ProjectApproval` governance proposal.

This closes the gap where a project could store an arbitrary governance proposal pubkey without proving that the proposal account existed, had the right category, or had an approval state compatible with the requested project status.

## Added

- `register_project` now requires a `governance_proposal_account`.
- `update_project_status` now requires a `governance_proposal_account`.
- Project governance account keys must match the stored/requested project governance proposal.
- Public project statuses require an approved `ProjectApproval` proposal.
- Draft/review statuses can be registered against an open or approved `ProjectApproval` proposal.
- Rejected project status requires a rejected or cancelled `ProjectApproval` proposal.
- TypeScript transaction planner support for the additional governance proposal account.
- Localnet smoke coverage for rejected public project registration before governance approval.
- Localnet smoke coverage for draft project registration against an open ProjectApproval proposal.
- Localnet smoke coverage for rejected public status update and rejected participation before open status.

## Rules

- `ProjectStatus::Proposed`, `UnderReview`, and `GovernanceVote` require an open or approved `ProjectApproval` proposal.
- `ProjectStatus::Approved`, `Open`, `Active`, `MilestoneReached`, `HarvestAvailable`, `Completed`, and `Paused` require an approved `ProjectApproval` proposal.
- `ProjectStatus::Rejected` requires a rejected or cancelled `ProjectApproval` proposal.
- Project participation remains gated by project status and user tier.
- Project participation still does not custody funds.

## Deferred

- Successful project-open localnet path after a safe test-time voting-right activation path exists.
- Public UI countdown and readiness copy for project governance approval status.
- Governance cancellation/veto policy for legal or emergency review.

## Verification

- `npm.cmd run protocol:check:win`
- `npm.cmd run protocol:test:win`
- `npm.cmd run protocol:build:wsl`
- `npm.cmd run protocol:idl:check`
- `npm.cmd test -- --run src/solana/protocolTransactionPlan.test.ts`
- `npm.cmd run protocol:smoke:localnet:wsl`
