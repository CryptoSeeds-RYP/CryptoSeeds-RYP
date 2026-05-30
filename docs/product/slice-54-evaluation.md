# Slice 54 Evaluation - Solana Wallet Boundary

## Intent

Move from static Solana protocol previews toward wallet-approved execution by adding a safe boundary before any signature request.

## Changes

- Added `src/solana/solanaTransactionBoundary.ts`.
- Converts prepared staking and unstaking instruction plans into unsigned Solana transactions.
- Builds serialized message previews for wallet-review surfaces.
- Blocks disconnected/demo wallets, wallets without Solana transaction signing, and fee-payer mismatches.
- Adds an RPC simulation path that uses `sigVerify: false` and never requests a wallet signature.
- Wires a `Run Wallet Simulation` action into the transaction panel.
- Shows boundary status, blockhash, instruction count, signer count, compute units, simulation messages, and recent logs.
- Added focused tests for transaction construction, boundary preview, mismatch blocking, and disconnected/demo blocking.

## Guardrails

- No wallet signature is requested.
- No transaction is broadcast.
- No private keys or seed phrases are requested.
- Demo mode cannot pass as a real signing wallet.
- Simulation failure does not move funds and does not advance to broadcast.

## Follow-Up

The next step is a signature-only UX path behind this boundary. It should request `signTransaction` only after simulation review, then keep broadcast as a separate disabled/reviewed stage until cluster and program deployment checks are complete.
