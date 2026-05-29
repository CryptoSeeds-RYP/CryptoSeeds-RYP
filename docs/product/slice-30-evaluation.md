# Slice 30 Evaluation: Hyperliquid Testnet Adapter Boundary

Date: 2026-05-29

## Scope

This slice adds the first Hyperliquid-specific adapter boundary for SeedBot.

Implemented:

- explicit Hyperliquid mainnet and testnet endpoint configuration
- testnet as the default SeedBot execution environment
- unsigned order-preview payloads with pending asset id, price, size, nonce, expiry, and signature resolution
- wallet-owned agent approval preview metadata
- router integration for Hyperliquid preview routes
- tests for endpoint config, testnet route plans, and agent approval previews

## Product Position

This keeps SeedBot on the right side of the line: we now have enough structure to design the signed-order flow, but the app still cannot send live orders. The next work should stay on Hyperliquid testnet until signing, asset lookup, order polling, and emergency cancel controls are proven.

## Verification

Passed:

- `npm test` -- 12 files, 47 tests.
- `npm run build`.

## Next Step

Build the signed testnet order spike behind a disabled-by-default feature flag:

- resolve asset ids from Hyperliquid `info/meta`
- derive size from mock account equity and strategy allocation
- generate a testnet order draft with nonce and `expiresAfter`
- wire a signing abstraction without storing keys
- add order status polling and cancel preview models
