# Slice 35 Evaluation: SeedBot Order-Control Preview Flow

Date: 2026-05-30

## Scope

This slice turns the Hyperliquid order-control models into a read-only SeedBot UI flow.

Implemented:

- mock order id input in the SeedBot execution guard
- mock asset id input for cancel previews
- generated order-status query preview
- generated cancel-order draft preview
- generated schedule-cancel kill-switch draft preview
- blocked/ready status badges for each preview
- visible validation blockers for wallet, order id, asset id, and signed-execution state
- safe-integer validation for numeric order and asset identifiers

## Product Position

Users can now see what SeedBot would prepare for order review and emergency controls before any live trading exists. All control actions remain disabled and signed execution remains off by default.

## Verification

Passed:

- `npm test` -- 14 files, 59 tests.
- `npm run build`.

Note:

- Browser screenshot QA depends on local browser tooling. The UI is compile-verified in this slice.

## Next Step

Add a testnet-only signing abstraction:

- no private key storage
- MetaMask or approved-agent signature boundary
- explicit user review step
- disabled mainnet path until testnet signing, status polling, and cancel controls are proven
