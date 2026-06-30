# Slice 188: Local Verification Command

## Change

- Added `verify:local` as the single full local release gate.
- Wired Mission Status and Admin Mission Control to show `npm run verify:local` instead of a long chained command.
- Added the full local verification gate to the operations runbook while keeping granular scripts available for targeted debugging.

## Verification Scope

`npm run verify:local` covers:

- unit and domain tests,
- production build,
- operations readiness,
- tracked-secret audit,
- copy and visual audits,
- protocol IDL drift check,
- WSL localnet smoke gate,
- npm audit at moderate severity,
- whitespace diff check.

## Operator Rule

Passing `verify:local` proves local review readiness only. It does not approve devnet deployment, enable wallet broadcast, move treasury funds, or make SeedBot execution live.
