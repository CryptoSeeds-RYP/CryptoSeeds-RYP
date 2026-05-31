# Slice 85 Evaluation - Localnet Smoke Layout Alignment

## Goal

Make the Anchor localnet smoke flow validate live reward accounts against the same layout manifest used by the frontend inspector.

## Completed

- Loaded `src/solana/protocolAccountLayouts.json` inside `scripts/run-anchor-localnet-smoke.mjs`.
- Added reward account discriminator and minimum-length checks to localnet reward account parsing.
- Switched localnet reward parsers to manifest offsets for reward config, vault state, and epoch accounts.
- Documented that the localnet smoke path and frontend inspector now share the reward layout manifest.

## Safety Posture

- No on-chain reward execution path changed.
- No payout, claim, or vault movement path was added.
- Localnet smoke now catches mismatched live Anchor account discriminators.

## Next Step

Add a browser-level localnet Admin smoke once the app can be launched with temporary localnet inspection env vars during the validator flow.
