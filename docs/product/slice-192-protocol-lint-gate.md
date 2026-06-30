# Slice 192: Protocol Lint Gate

## Change

- Added `npm run protocol:lint`.
- Wired GitHub protocol CI to install `clippy` and run it with warnings denied.
- Registered protocol lint in ops readiness and the operations runbook.
- Included protocol lint in `verify:local` so the full local gate cannot skip Rust warnings.
- Modernized the reward Merkle proof index check with `is_multiple_of`.

## Anchor Boundary

The program allows two clippy lints at crate level:

- `clippy::diverging_sub_expression` because Anchor's `#[program]` macro emits divergent paths that are not authored business logic.
- `clippy::too_many_arguments` because instruction ABI handlers intentionally expose explicit on-chain arguments.

Other clippy warnings remain denied by the protocol lint gate.

## Verification

`npm run protocol:lint` must pass before protocol-facing work is merged. `npm run verify:local` also runs it before IDL drift and WSL localnet smoke checks.
