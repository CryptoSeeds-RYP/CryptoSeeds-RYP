# Slice 26 Evaluation: SeedBot Strategy Triangle Graphs

Date: 2026-05-29

## Scope

This slice turns the SeedBot public strategy collection into a three-strategy triangle with independent historical graph controls.

Implemented:

- three-strategy triangle layout
- independent performance window state per strategy
- toggles for 7D, 30D, 90D, 180D, and 1Y
- historical performance point series for each strategy/window
- SVG line graph per strategy
- selected-window return display
- tests for graph window selection and historical data shape

## Product Rules

- Graphs show historical performance only.
- No guaranteed ROI language.
- No projected return promise.
- Past performance disclaimer remains visible above the strategy collection.
- Allocation remains self-custodial through wallet-approved preview intents.

## Verification

Passed:

- `npm test` — 10 files, 40 tests.
- `npm run build`.
