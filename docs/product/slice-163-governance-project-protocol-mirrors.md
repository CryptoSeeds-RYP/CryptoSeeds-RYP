# Slice 163: Governance And Project Protocol Mirrors

## Scope

This slice exposes configured read-only governance and project account inspections in the user-facing Governance Hall and Explorer views.

## Changes

- Added shared state reads for the configured governance proposal ID and project ID when the app is on a real protocol deployment with demo mode disabled.
- Passed governance inspection into Governance Hall.
- Added a Protocol Proposal Mirror showing proposal PDA, proposal status, vote record status, tally, voting window, warnings, and blockers.
- Passed project inspection into Explorer.
- Added a Protocol Project Mirror showing project PDA, participation PDA, account statuses, project lifecycle, risk, funding model, participation record, limits, warnings, and blockers.

## Safety Position

The mirrors are read-only. They do not create proposals, cast votes, register projects, participate in projects, move funds, refund users, or broadcast transactions. Fixture project cards remain product previews unless matched by configured on-chain inspection state.

## Verification

- Protocol state inspection tests
- TypeScript production build
- Full app regression before push
