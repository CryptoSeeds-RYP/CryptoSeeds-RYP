# Slice 118: Governance Window Hardening

## Purpose

Governance proposals now have on-chain voting windows and minimum-vote thresholds.

This tightens the one-wallet governance model so proposals cannot be closed immediately after creation, votes can only be cast during the active voting window, and the final approved/rejected close result must match the recorded vote tally.

## Added

- `voting_window_seconds` argument on `create_governance_proposal`.
- `minimum_votes` argument on `create_governance_proposal`.
- `voting_starts_at`, `voting_ends_at`, and `minimum_votes` on `GovernanceProposal`.
- Vote casting now rejects before the window starts or after it ends.
- Proposal close now rejects before the voting window ends.
- Proposal close now requires the requested close result to match the deterministic tally result.
- TypeScript transaction planner support for voting window and minimum-vote arguments.
- Localnet smoke coverage for proposal window storage, early-close rejection, and deterministic rejected close.

## Rules

- Voting windows must be at least 1 second and no longer than 90 days.
- Minimum votes must be greater than zero and no more than 1,000,000.
- A proposal passes only when total votes meet `minimum_votes` and yes votes exceed no votes.
- Proposal execution remains separate from closing the vote result.
- Voting remains 1 wallet = 1 vote through one vote-record PDA per wallet and proposal.

## Deferred

- Governance cancellation/veto path for legal or emergency rejection after a passing vote.
- Successful-vote localnet path after a safe time-warp or test-only voting setup is added.
- Public governance UI for window countdowns and minimum-vote status.

## Verification

- `npm.cmd run protocol:check:win`
- `npm.cmd run protocol:test:win`
- `npm.cmd run protocol:build:wsl`
- `npm.cmd run protocol:idl:check`
- `npm.cmd test -- --run src/solana/protocolTransactionPlan.test.ts`
- `npm.cmd run protocol:smoke:localnet:wsl`
