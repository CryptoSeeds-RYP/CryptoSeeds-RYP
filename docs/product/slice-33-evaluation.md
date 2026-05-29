# Slice 33 Evaluation: Hyperliquid Order Controls Preview

Date: 2026-05-29

## Scope

This slice adds order-status and cancel-control models for the Hyperliquid SeedBot path.

Implemented:

- order-status query draft for the Hyperliquid `info` endpoint
- EVM address and order-id validation
- cancel-order draft with signature gate
- schedule-cancel draft with five-second venue guard
- tests for ready and blocked status queries
- tests for cancel and schedule-cancel drafts

## Product Position

SeedBot now has the control-plane models it needs before testnet execution: review an order status, cancel a known order, and schedule a cancel-all style safety action. These are still unsigned drafts only. No broadcast path exists.

## Verification

Passed:

- `npm test` -- 14 files, 58 tests.
- `npm run build`.

## Next Step

Connect these models into the SeedBot UI as a disabled-by-default control panel:

- show route environment and signed-execution status
- show order-status preview form
- show cancel and schedule-cancel preview cards
- keep controls disabled until testnet signing is explicitly enabled
