# Slice 145 - Readable Module Pause Inspection

## Goal

Make scoped protocol pause state readable in admin inspection instead of exposing only raw bit flags.

## Implemented Direction

- Protocol config decoding now maps module pause flags to named modules.
- Admin inspection displays named module pause state, or `None` when clear.
- Unknown module pause bits are treated as blockers because they indicate ABI drift or corrupted state.
- Tests cover named pause warnings and unknown-bit blocking.

## Safety Notes

- This is read-only inspection; no signing, broadcast, or protocol mutation was added.
- The raw `modulePauseFlags` value remains available for audit tooling.
