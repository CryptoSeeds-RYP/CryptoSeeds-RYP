# Slice 7 Evaluation - Staking Model and Tier Preview Bridge

## Built

- Added a staking domain model with Golden Key state, Voting Rights state, fee reduction, effective fee, next-tier gap, and project slots.
- Connected tier selection to staking transaction preview creation.
- Updated the protocol panel to show fee reduction, effective fee, next-tier RYP requirement, and voting timer.
- Updated staking transaction previews so the selected tier determines amount, fee tier, and expected result.

## Current Behavior

- The tier selector still drives demo protocol state for design review.
- Selecting a tier now also creates a structured staking transaction intent.
- The staking preview remains wallet-approved and self-custodial by design.
- Voting Rights state is shown as active, locked, or timer-based according to staking duration.

## Verification

- `npm run build` passes.
- `npm audit --audit-level=moderate` reports 0 vulnerabilities.
- `npm run token:check` confirms the live RYP mint remains fixed and non-mintable.

## Remaining Risks

- Stake and unstake are still preview intents, not Anchor transactions.
- Golden Key and Voting Rights are represented as protocol state, not minted NFTs.
- Tier thresholds are frontend constants and must later be enforced by the Solana program using base units.

## Recommended Next Slice

Write the Anchor account design before final Rust implementation:

- Protocol config account
- Stake position account
- Stake vault token account
- Tier threshold storage in base units
- Golden Key receipt state
- Voting eligibility state
- Pause authority and admin controls
- Events for stake, unstake, tier change, key state, and voting eligibility

