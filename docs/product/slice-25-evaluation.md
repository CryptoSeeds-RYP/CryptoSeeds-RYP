# Slice 25 Evaluation: RYP-Gated SeedBot Strategy Collection

Date: 2026-05-29

## Scope

This slice adds SeedBot strategy utility for RYP while keeping the flow self-custodial and performance-based.

Implemented:

- RYP holder access model for the public SeedBot strategy collection
- strategy cards with 7D, 30D, 90D, 180D, and 1Y historical performance windows
- disclaimer: past performance does not guarantee future results
- profit-only performance fee model, split between dev and treasury
- multi-asset strategies with Phantom and MetaMask route labels
- basket allocation and per-asset route buttons
- SeedBot allocation transaction preview intent
- tests for historical performance windows, RYP access, fee disclosure, and allocation previews

## Product Rules

- Do not show guaranteed ROI.
- Do not show projected ROI as a promise.
- Show historical strategy performance only.
- Fees are disclosed as performance fees on realized positive strategy PnL only.
- Funds remain self-custodial; allocations require wallet approval through Phantom, MetaMask, or another supported wallet route.

## Verification

Passed:

- `npm test` — 10 files, 39 tests.
- `npm run build`.

## Compliance Note

Self-custody reduces custody risk, but strategy access, performance reporting, and fee-on-profit mechanics still require careful jurisdictional review before public launch.
