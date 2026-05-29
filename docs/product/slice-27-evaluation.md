# Slice 27 Evaluation: SeedBot Venue Decision Layer

Date: 2026-05-29

## Scope

This slice adds the first venue decision layer for SeedBot client execution.

Implemented:

- SeedBot venue model
- Hyperliquid as recommended first pilot
- GRVT as secondary pilot
- Jupiter as Solana/RYP spot route
- Antarctic blocked until official API and venue due diligence are complete
- strategy preferred venue ids
- transaction preview risk summaries now include preferred venue
- UI displays preferred venue/status on strategy cards
- architecture decision note for venue routing

## Recommendation

Use Hyperliquid first for active strategy execution, GRVT second, and keep Jupiter for Solana spot/RYP routing.

Do not use Antarctic for client trading until official API docs, custody model, liquidity, fee schedule, and jurisdiction support are verified.

## Verification

Passed:

- `npm test` — 11 files, 42 tests.
- `npm run build`.
