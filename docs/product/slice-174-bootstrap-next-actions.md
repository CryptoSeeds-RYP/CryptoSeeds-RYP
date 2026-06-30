# Slice 174: Bootstrap Next Actions

## Summary

Aligned the devnet bootstrap wrapper's operator-facing next actions with the staged deployment lane.

## Changes

- Kept existing bootstrap flags available for compatibility.
- Updated next-action text to recommend the dedicated mint command, reviewed protocol initialization command, read-only readiness gate, and env-aware commands.
- Added a regression test to prevent old shortcut recommendations from returning to the bootstrap handoff.

## Safety Notes

- This slice changes recommendation text only.
- It does not remove existing bootstrap flags, sign transactions, deploy programs, initialize protocol accounts, or enable wallet broadcast.
