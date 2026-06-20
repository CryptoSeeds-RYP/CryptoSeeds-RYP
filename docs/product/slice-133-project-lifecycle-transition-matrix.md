# Slice 133: Project Lifecycle Transition Matrix

## Purpose

Replace loose project status updates with an explicit lifecycle transition matrix before devnet deployment.

## Implemented

- Added `project_status_transition_allowed` to enforce defined project status transitions.
- Kept direct `Cancelled` status updates blocked; cancellation must still use `cancel_project` so cancellation metadata and refund accounting are recorded.
- Preserved idempotent status retries for non-cancelled states.
- Allowed normal forward progression from proposal review through approved, open, active, milestone, harvest, paused, and completed states.
- Blocked unsafe shortcuts such as `Proposed -> HarvestAvailable`, `UnderReview -> Open`, `GovernanceVote -> Open`, `Approved -> Active`, and `Open -> HarvestAvailable`.
- Added Rust unit coverage for allowed transitions and blocked shortcut transitions.

## Boundaries

- This does not move funds.
- This does not change account layouts or instruction signatures.
- This does not implement per-wallet refund claims.
- `Paused` remains a lifecycle status and can resume into the active project states because the program does not store the previous lifecycle status.

## Verification

- `npm run protocol:test:win` passes with `47` Rust tests.
- `npm run protocol:smoke:localnet:wsl` passes, including IDL drift, staking, reward, project, governance, and SeedBot smoke coverage.

## Deferred

- Localnet smoke coverage for approved proposal status progression.
- Admin dashboard warnings that explain blocked lifecycle shortcuts before signing.
- Per-wallet refund claim records and proof-backed refund paths.
