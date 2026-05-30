# Slice 52 Evaluation - Phantom Protocol Transaction Plan

## Intent

Move the dApp beyond generic wallet previews by adding a Phantom-first Solana protocol action planning layer for the existing Anchor staking program.

## Changes

- Added `src/solana/protocolTransactionPlan.ts`.
- Derived the CryptoSeeds config PDA, stake position PDA, owner RYP ATA, and protocol RYP vault ATA.
- Built Anchor instruction data previews for:
  - `stake_ryp`
  - `unstake_ryp`
  - `activate_voting_rights`
- Attached prepared Solana transaction plans to staking and unstaking intents.
- Added a Transaction Preview section showing prepared action, instruction, fee payer, base units, data hex, and safety warning.
- Replaced the pseudo demo wallet label with a valid demo Solana public key so local demo mode can derive real PDA/ATA previews.
- Added tests for PDA/ATA derivation, base-unit conversion, instruction data, account ordering, staking intent wiring, and unstaking intent wiring.
- Added a review hardening pass for u64 token amount bounds, multichain SeedBot route labeling, and multi-warning transaction previews.

## Guardrails

- No transaction is signed.
- No transaction is broadcast.
- No private keys or seed phrases are requested.
- The plan assumes the protocol config and RYP vault are initialized on the selected cluster.
- RYP UI amounts are rejected if their base-unit value exceeds Solana's u64 token amount range.
- Project participation remains preview-only because the project pool program is still deferred.

## Follow-Up

The next protocol step should be a signing boundary that turns a prepared plan into a Solana `Transaction` only when a connected Phantom/Solana wallet is available. After that, wire simulation or dry-run validation before any mainnet broadcast path.
