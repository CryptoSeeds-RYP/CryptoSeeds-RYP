# Slice 178 - Planner Admin Claim And Operator Guards

## Scope

This slice extends TypeScript transaction planner parity with Rust protocol validation for governance proposals, reward claim records, and project operator grants.

## Changes

- Reject reward claim records with zero gross allocation before encoding.
- Reject reward claim records where delivery cost, net claim, and roll-forward amounts do not balance to gross allocation.
- Reject admin-created reward claim records for the default public key.
- Bound governance voting windows to the Rust protocol minimum and 90-day maximum.
- Bound governance minimum vote counts to the Rust protocol range.
- Bound project operator grants to future expiries no more than 90 days out.
- Reject project operator grants where the operator is the default public key or the authority wallet.

## Verification

- `npm run test -- src/solana/protocolTransactionPlan.test.ts`

## Devnet Status

No devnet transaction was submitted in this slice. Devnet remains blocked until the authority wallet receives devnet SOL.
