# Slice 191: CI Verification Command

## Change

- Added `npm run verify:ci` as the portable GitHub Actions gate.
- Replaced the individual app CI steps with the single verification command.
- Registered the CI gate in ops readiness and the operations runbook.

## CI Coverage

`verify:ci` runs:

- ops readiness,
- tracked-secret audit,
- copy audit,
- visual audit,
- dependency audit,
- app/domain tests,
- production build,
- whitespace diff check.

## Boundary

`verify:ci` is portable and does not require WSL, Solana validator, Anchor CLI, devnet funds, or generated local IDL artifacts. It does not replace `verify:local` before deployment because `verify:local` also runs the generated Anchor IDL drift check and WSL localnet smoke gate.
