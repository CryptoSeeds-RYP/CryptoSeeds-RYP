# Slice 190: Secret Material Audit

## Change

- Added `npm run secrets:audit`.
- The audit scans Git-tracked files for committed Solana keypair JSON arrays, tracked target/keypair/env files, private-key blocks, and real-looking service tokens.
- Wired the audit into CI, ops readiness, the operations runbook, and `npm run verify:local`.

## Safety Position

The audit does not read ignored local devnet keypairs unless they are accidentally tracked by Git. It reports file paths and finding categories only; it does not print secret values.

## Operator Rule

Passing this audit does not prove the absence of every possible secret, but it blocks the common deployment-critical mistakes before commit, push, or public preview review.
