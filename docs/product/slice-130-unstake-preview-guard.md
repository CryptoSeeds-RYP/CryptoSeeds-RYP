# Slice 130: Unstake Preview Guard

## Purpose

Mirror the protocol unstake remainder guard in frontend previews so invalid partial unstake requests are blocked before wallet signing.

## Implemented

- Added a staking-domain unstake preview validator.
- Added direct Solana transaction-plan validation when the current staked amount is supplied.
- Updated unstake transaction intents to return a blocked preview with a clear reason when the request would leave below-Seed stake dust.
- Kept backward compatibility for preview builders that do not yet have live stake-position data.
- Added unit coverage for full exit, valid Seed remainder, over-balance unstake, and below-Seed remainder blocking.

## Boundaries

- This is a preview/client guard; the Anchor program remains the final authority.
- Existing preview callers without current stake data still build as before.
- No transaction is signed or broadcast by this change.

## Deferred

- Read live stake-position data into the unstake UI control.
- Add a visible unstake amount input in the Homestead/Protocol panel.
- Add an indexer check for any legacy below-tier positions before mainnet.
