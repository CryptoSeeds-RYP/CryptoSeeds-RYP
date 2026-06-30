# Slice 193: Local Verification Protocol Lint

## Change

- Added `npm run protocol:lint` to `verify:local`.
- Updated Mission Status and Admin Mission Control so the Rust safety phase shows both protocol lint and IDL drift checks.
- Made Mission Status report missing required scripts explicitly when ops readiness is otherwise parseable.
- Updated regression coverage for the stronger Rust safety command.

## Operator Rule

`npm run verify:local` is the pre-deployment local gate. It now fails if Rust clippy reports any non-allowed protocol warning.

This does not deploy the program, create the devnet mint, initialize protocol state, fund wallets, sign transactions, or enable frontend broadcast.
