# Slice 99 Admin Project and Governance Builders

Date: 2026-06-20

This slice expands the frontend Solana transaction planner for admin-side governance and project registry actions.

## Added

- `buildCreateGovernanceProposalTransactionPlan`
- `buildCloseGovernanceProposalTransactionPlan`
- `buildRegisterProjectTransactionPlan`
- `buildUpdateProjectStatusTransactionPlan`
- Typed enum encoders for:
  - governance proposal categories,
  - project risk levels,
  - project lifecycle statuses,
  - staking tier gates.

## Safety Boundaries

- These builders prepare transaction previews only.
- Admin actions require the configured authority as fee payer/signer.
- Project registration records receiving accounts but does not custody project funds.
- Proposal closing records approval or rejection only; execution remains separate.
- Project status updates should match reviewed milestone, disclosure, or governance evidence.

## Verification

- Added exact data-hex tests for proposal creation, proposal close, project registration, and project status updates.
- Account ordering is checked against `protocolInstructionSpecs.json`, which is drift-checked against the generated Anchor IDL.
