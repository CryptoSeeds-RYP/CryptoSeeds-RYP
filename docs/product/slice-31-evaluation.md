# Slice 31 Evaluation: Hyperliquid Asset Lookup Readiness

Date: 2026-05-29

## Scope

This slice adds the first read-only market data layer needed before signed Hyperliquid testnet orders.

Implemented:

- `VITE_SEEDBOT_HYPERLIQUID_NETWORK` config with `TESTNET` default
- `VITE_SEEDBOT_SIGNED_EXECUTION=false` kill switch
- Hyperliquid `info/meta` fetch service
- parser for the perp `universe` response
- asset id resolution by `universe` index
- missing and delisted asset blocking before signing
- tests for parsing, lookup, missing assets, delisted assets, and endpoint selection

## Product Position

SeedBot can now model the part that has to happen before any Hyperliquid order is signable: map a strategy asset such as `SOL` or `ETH` to the venue's current numeric asset id. Signed execution remains off by default.

## Verification

Passed:

- `npm test` -- 13 files, 51 tests.
- `npm run build`.

## Next Step

Build the signed testnet order draft model:

- combine resolved asset ids with price and size inputs
- add nonce and `expiresAfter`
- keep signature as an external wallet/agent dependency
- add validation that refuses orders when the feature flag is off
- add cancel and order-status preview models before any broadcast path
