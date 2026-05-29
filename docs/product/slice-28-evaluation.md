# Slice 28 Evaluation: SeedBot Venue Router Scaffold

Date: 2026-05-29

## Scope

This slice adds the first execution-router scaffold for SeedBot.

Implemented:

- per-asset venue ids on SeedBot strategy assets
- dry-run venue route planner
- Hyperliquid adapter preview
- Jupiter adapter preview
- GRVT adapter preview
- Antarctic blocked adapter behavior
- allocation transaction previews now consume route-plan details
- tests for Hyperliquid, Jupiter, and blocked Antarctic behavior

## Product Position

This is still not live trading. It is the correct pre-live architecture: users can review strategy, venue, wallet route, assets, fees, and historical performance before anything becomes a signed route.

## Verification

Passed:

- `npm test` — 12 files, 45 tests.
- `npm run build`.

## Next Step

Start a Hyperliquid testnet adapter spike:

- SDK/signature helper selection
- testnet endpoint config
- agent-wallet approval UX
- dry-run to signed-order transition
- order status polling
- emergency cancel controls
