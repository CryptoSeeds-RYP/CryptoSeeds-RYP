# CTO Build Sequence

Date: 2026-05-30

## Current Decision

Prioritize the framework that makes high-end visuals usable before producing a large batch of final art.

Reason:

- final assets need stable state slots
- runtime paths need to be registered
- file dimensions and byte budgets need quality gates
- wallet, staking, SeedBot, governance, and project risk surfaces must remain clear
- replacing procedural visuals should be incremental, not a rewrite

This does not mean visuals wait. It means visual work now focuses on production foundations, concept direction, asset specifications, and QA gates.

## Build Order

1. Visual framework and quality gates.
2. Production asset batch for core landmarks.
3. Project tile state assets.
4. Visual QA and compression pass.
5. Wallet and staking flow polish.
6. Anchor/Solana protocol implementation once the frontend state model and user flow are stable.
7. SeedBot Terminal UI and self-custodial execution modules.
8. Selective Three.js cinematic rooms after Pixi world and React DeFi shell are proven.

## Active Visual Standard

All visuals must meet the CryptoSeeds visual bible:

- premium regenerative strategy world
- Arcane-inspired atmosphere
- Civilization-style readability
- futuristic nature-tech materials
- no casino styling
- no meme-token styling
- no childish farming clone tone

## Asset Gate

Before an asset becomes part of the runtime:

- register it in `src/visual/microverseAssets.ts`
- define role, state, dimensions, byte budget, and production readiness
- run `npm run visual:audit`
- verify desktop and mobile composition
- keep procedural fallback behavior intact

## Next Implementation Slice

Create the first production asset batch:

- Homestead: locked, idle, active
- SeedBot Terminal: locked, signal-only, execution-ready
- Governance Hall: inactive, vote-active
- Project tiles: open, active, milestone, harvest, completed, paused

Then integrate them as sprites while keeping the current procedural renderer as fallback.
