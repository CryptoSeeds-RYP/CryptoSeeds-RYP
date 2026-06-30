# Slice 147: SeedBot Strategy Validation Gate

## Scope

This slice hardens the SeedBot v1 strategy collection before live route execution exists.

## Changes

- SeedBot route planning now runs full strategy validation before building venue routes.
- Invalid strategy metadata fails closed with no route previews.
- Allocation transaction intents now use a `BLOCKED` status when route checks fail.
- The transaction lifecycle blocks wallet signature, broadcast, and confirmation for blocked SeedBot previews.
- The SeedBot UI now shows a catalog validation status and per-strategy route blockers.
- Allocation buttons are disabled when a strategy is inaccessible or route-blocked.

## Safety Rules Preserved

- Strategy performance remains historical only.
- Past performance disclaimer remains visible.
- SeedBot remains preview-only and self-custodial.
- No private keys, custody, hidden broadcast, live automation, or live profit-fee execution was enabled.

## Verification

- Focused SeedBot and transaction-intent tests passed.
- Full Vitest suite passed.
- Production app build passed.
- Copy guardrail audit passed.
- Visual asset audit passed.
- Ops readiness check passed.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.
- `git diff --check` passed.
- Mainnet RYP mint check passed.
- Read-only devnet bootstrap still reports blocked until the devnet authority is funded.
