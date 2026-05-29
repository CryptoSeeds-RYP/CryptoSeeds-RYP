# Slice 29 Evaluation: SeedBot Route Plan UI

Date: 2026-05-29

## Scope

This slice surfaces the dry-run SeedBot venue router in the strategy cards.

Implemented:

- route-plan preview per SeedBot strategy
- venue grouping for each strategy basket
- dry-run mode label in the strategy UI
- per-asset venue labels replacing generic wallet-route labels
- compact route-plan styling for desktop and mobile card layouts

## Product Position

The SeedBot area now explains where a strategy would route before any live execution exists. This keeps the product self-custodial and transparent: strategy, venue, asset basket, historical performance, fees, and disclaimers are visible before a user prepares a wallet-approved action.

## Verification

Passed:

- `npm test` -- 12 files, 45 tests.
- `npm run build`.

## Next Step

Start the Hyperliquid testnet adapter spike:

- identify the official SDK or signing helper path
- add endpoint configuration for testnet versus production
- model agent-wallet approval without custody
- convert dry-run previews into wallet-signed test orders
- add order status polling and emergency cancel previews
