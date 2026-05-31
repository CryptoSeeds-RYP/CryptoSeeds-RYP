# Slice 60 Evaluation - Repository CI Baseline

## Intent

Add automated repository checks so app and protocol regressions are caught before visual, wallet, and Solana work stacks up.

## Changes

- Added a push and pull-request CI workflow.
- Added deterministic app checks for visual assets, unit tests, and production build.
- Added host-side protocol formatting and Rust unit tests on Ubuntu.
- Added a scheduled/manual external audit workflow for the public RYP mint authority checks.
- Documented local and CI checks in the README.

## Verification

- `npm run visual:audit`
- `npm test`
- `npm run build`
- `npm run protocol:check:win`
- `npm run protocol:test:win`

## Notes

The RYP mint check is separated from normal CI because it depends on public Solana RPC availability. Full Anchor validator tests are still deferred until a Linux Solana/Anchor environment is available.
