# Slice 63 Evaluation - Source Copy Guardrails

## Intent

Add an automated source-copy audit so UI language stays conservative as the SeedBot and DeFi surfaces expand.

## Changes

- Added a source scanner for risky Web3/trading phrases.
- Allowed negative safety contexts such as "not guaranteed returns".
- Added `npm run copy:audit`.
- Added the copy audit to GitHub Actions CI.

## Verification

- `npm run copy:audit`
- `npm test`
- `npm run build`

## Notes

The scanner intentionally checks app source rather than all docs because architecture and compliance docs need to mention prohibited phrases while explaining what not to ship.
