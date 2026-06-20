# Slice 128: Terminal Project Mutation Guards

## Purpose

Keep terminal project records stable after rejection, completion, or cancellation.

## Implemented

- Added a terminal project status helper for `Rejected`, `Completed`, and `Cancelled`.
- Blocked disclosure revision creation after a project reaches a terminal state.
- Blocked new project operator grants after a project reaches a terminal state.
- Blocked admin and operator pause toggles after a project reaches a terminal state.
- Prevented normal status updates from reopening a rejected project.
- Added Rust unit coverage for terminal project mutation guards.

## Boundaries

- Cancellation refund accounting remains available only through the dedicated refund path.
- Direct cancellation remains blocked through normal status updates.
- Existing operator records are not deleted or modified by this guard.

## Deferred

- Full project lifecycle transition matrix.
- Explicit completed-project report records.
- Per-wallet refund claim records.
- Admin dashboard terminal-state warnings.
