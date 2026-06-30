# Slice 164: Harvest Reward Protocol Mirror

## Scope

This slice exposes configured read-only reward account inspection in the user-facing Harvest Ledger.

## Changes

- Added shared reward account inspection state for the configured reward epoch.
- Passed reward inspection into Harvest Ledger.
- Added a Reward Protocol Mirror showing reward config status, epoch status, split bps, reward pool, net distribution, delivery reserve, claimed amount, rollover, and reward vault states.
- Kept fixture ledger rows as product preview items until live claim surfaces are explicitly enabled.

## Safety Position

The mirror is read-only. It does not create epochs, review epochs, create claim records, claim rewards, move vault funds, or expose reward execution. Missing or blocked accounts remain visible as inspection status instead of being inferred from fixture data.

## Verification

- Reward inspection tests
- TypeScript production build
- Full app regression before push
