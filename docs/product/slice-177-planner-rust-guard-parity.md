# Slice 177: Planner Rust Guard Parity

## Summary

Added frontend transaction-planner checks that mirror the current Anchor protocol guards before a wallet/admin preview is built.

## Changes

- Reward config previews now reject invalid cadence and split totals.
- Protocol fee config previews now reject base fees above the Rust cap and non-monotonic tier reductions.
- Project registration previews now reject unsupported escrow funding, invalid caps, closed windows, terminal initial statuses, and default receiving accounts.
- Value-move previews now reject zero platform fees, project participation amounts, refund pools, and refund amounts where Rust requires positive values.
- SeedBot permission previews now reject expired or overlong permissions, zero trade caps, daily-volume caps below trade caps, more than 50 daily trades, and slippage above 5%.
- SeedBot usage previews now reject zero trade amounts and slippage above the protocol-wide cap.

## Safety Notes

- No protocol ABI, account layout, or IDL change was made.
- No wallet signing, broadcast, live trading, funding, deployment, or project custody path was enabled.
- These checks fail earlier in TypeScript so future UI, admin, adapter, or AI-agent flows do not prepare plans the Rust program would reject.

## Verification

- `npm run test -- src/solana/protocolTransactionPlan.test.ts`
- `npm run build`
