# Slice 123: Project Pause Controls

Project records now include a project-level participation pause flag.

This is an emergency control for blocking new participation without changing the broader project lifecycle status.

## Added

- `participation_paused` on `ProjectRecord`.
- `set_project_pause` admin instruction.
- `ProjectPauseUpdated` event.
- Participation guard that rejects participation while the project pause flag is active.
- TypeScript transaction planner support for project pause updates.
- Localnet smoke coverage for non-authority rejection and pause toggle persistence.

## Rules

- Only the protocol authority can toggle project pause state.
- Project pause blocks new participation.
- Project pause does not move funds.
- Project pause does not change lifecycle status.
- Project pause is separate from the global protocol pause.

## Deferred

- Separate project-operator pause authority.
- Per-project pause reason metadata.
- Admin Dashboard controls for project pause state.
