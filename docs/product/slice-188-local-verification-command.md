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
- protocol lint with Rust warnings denied,
- tracked-secret audit,
- copy and visual audits,
- protocol IDL drift check,
- WSL localnet smoke gate,
- npm audit at moderate severity,
- whitespace diff check.

## Operator Rule

Passing `verify:local` proves local review readiness only. It does not approve devnet deployment, enable wallet broadcast, move treasury funds, or make SeedBot execution live.

GitHub CI uses `verify:ci` as a portable subset. It does not replace `verify:local` before deployment because it does not run the generated Anchor IDL drift check, protocol lint, or WSL localnet smoke gate.
