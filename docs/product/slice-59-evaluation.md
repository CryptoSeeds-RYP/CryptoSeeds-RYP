# Slice 59 Evaluation - Protocol Rule Unit Tests

## Intent

Add contract-side unit coverage for the staking tier and fee validation rules now that Windows Rust checks are available.

## Changes

- Added Rust unit tests for `StakeTier::from_amount`.
- Added Rust unit tests for strict non-zero tier thresholds.
- Added Rust unit tests that block fee reductions above the configured base fee.
- Added `scripts/test-anchor-windows.ps1`.
- Added `npm run protocol:test:win`.
- Updated Windows protocol-check docs.

## Verification

- `npm run protocol:check:win`
- `npm run protocol:test:win`

## Notes

These are host-side Rust tests. Full Anchor validator tests still require a Linux Solana/Anchor environment.
