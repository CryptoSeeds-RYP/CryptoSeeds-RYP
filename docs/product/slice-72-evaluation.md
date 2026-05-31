# Slice 72 Evaluation: Self-Custody and Decentralization Guardrails

## Goal

Turn the latest product direction into build constraints: CryptoSeeds should be self-custodial and decentralized where practical, while avoiding claims that architecture alone eliminates legal obligations.

## Added

- Dedicated decentralization and self-custody compliance architecture note.
- Stronger compliance guardrails for non-custodial design, public copy, admin minimization, and review-gated features.
- Updated Web3/DeFi architecture guidance with a regulatory-surface reduction matrix.
- Updated SeedBot venue-router rules so discretionary automation and profit-based fees stay review-gated.
- Copy-audit patterns for public source text that would imply regulatory evasion.
- SeedBot fee disclosure now labels profit-based fees as review-gated and disabled for live use.

## CTO Call

The correct posture is not "self-custody means no law applies." The safer product posture is:

- self-custodial wallets
- user-directed transaction intents
- no custody of funds or keys
- objective routing parameters
- wallet-approved execution
- guarded automation disabled until reviewed
- profit-based fees disabled until reviewed
- no public claims that decentralization removes legal obligations

## Residual Risk

This is still a financial-adjacent product. Legal review is required before public launch, especially for SeedBot strategy fees, project participation mechanics, public financial promotions, fiat ramps, leverage/perps, or any real-world project rights.
