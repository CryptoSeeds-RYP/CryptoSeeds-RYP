# Slice 175: Devnet Helper Next Actions

## Summary

Aligned remaining devnet helper next-action messages with the staged deployment path.

## Changes

- Made funding, status, and program inspection helper next actions use the selected env source.
- Replaced lower-level direct deploy handoff text with the reviewed bootstrap deploy/init-plan command.
- Kept helper output pointed at the dedicated test mint command and reviewed protocol initialization command.
- Added regression coverage for env-aware operator handoff text.

## Safety Notes

- This slice changes helper reports only.
- It does not fund accounts, create mints, deploy programs, initialize protocol accounts, or enable wallet broadcast.
