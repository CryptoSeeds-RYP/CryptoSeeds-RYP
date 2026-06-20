# Slice 134: RYP Transfer Fee Protocol Coverage

## Purpose

Add Rust-side arithmetic coverage for the 1% RYP token-transfer fee target while keeping the existing mint limitations explicit.

## Implemented

- Added `RYP_TOKEN_TRANSFER_FEE_BPS` as a protocol constant set to `100` bps.
- Added `calculate_ryp_token_transfer_fee_amount` as a public protocol helper for future reviewed wrapper, migration, or program-controlled fee routes.
- Added Rust tests proving:
  - `1,000,000,000` base units produces a `10,000,000` base-unit fee.
  - The current holder, staker, and independent treasury split routes that fee as `3,334,000`, `3,333,000`, and `3,333,000`.
  - Tiny transfer quotes floor safely without overflow.

## Boundaries

- This does not make the legacy SPL RYP mint enforce transfer fees globally.
- This does not change account layouts or instruction signatures.
- `route_platform_fee` still routes a reviewed fee amount; raw wallet-to-wallet transfer enforcement requires a wrapper, migration, token-extension route, or app-controlled path.

## Verification

- `npm run protocol:test:win` passes with `49` Rust tests.

## Deferred

- Dedicated wrapper or Token-2022 migration design.
- User-facing transfer-fee preview inside a signed RYP transfer flow.
- On-chain route that computes the transfer fee from gross amount inside a reviewed transfer/wrapper instruction.
