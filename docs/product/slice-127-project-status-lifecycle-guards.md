# Slice 127: Project Status Lifecycle Guards

## Purpose

Prevent project lifecycle state from bypassing cancellation and completion rules.

## Implemented

- Added an initial project status guard that blocks projects from being registered directly as `Completed` or `Cancelled`.
- Added a status transition guard for authority and operator project status updates.
- Blocked normal status updates into `Cancelled`; cancellation must use `cancel_project` so cancellation metadata and refund accounting are recorded.
- Blocked reopening terminal `Completed` and `Cancelled` projects through normal status updates.
- Added Rust unit coverage for initial status and terminal transition rules.

## Boundaries

- This does not move funds.
- This does not implement per-wallet refund claims.
- Aggregate refund accounting remains under `record_project_refund`.
- `Completed` can still be reached through normal status progression, but cannot be reopened afterward.

## Deferred

- Per-wallet project refund records.
- Refund claim Merkle proofs.
- Project lifecycle transition matrix for every allowed adjacent state.
- Admin dashboard warnings for terminal project actions.
