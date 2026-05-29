# SeedBot Venue Router

Date: 2026-05-29

## Purpose

The SeedBot Venue Router converts a selected strategy into per-venue dry-run route previews.

Current adapters:

- Hyperliquid: first active strategy pilot.
- Jupiter: Solana/RYP spot route.
- GRVT: secondary pilot.
- Antarctic: blocked until venue due diligence is complete.

## Execution Modes

Current mode:

- `DRY_RUN`

Future mode:

- `WALLET_SIGNED`

No adapter should send live orders until the user has explicitly approved the route and the venue-specific signature flow is implemented.

## Hyperliquid Notes

The Hyperliquid adapter currently builds preview payloads shaped around the official exchange endpoint concept:

- endpoint: `https://api.hyperliquid.xyz/exchange`
- order action preview
- wallet or approved agent signature required
- no withdrawal action generated
- stale execution should use an expiry guard when signed

Live implementation still needs:

- official SDK or signature helper
- testnet environment
- agent-wallet approval flow
- nonce handling
- order status polling
- cancel/kill-switch flow
- max size, slippage, and position caps

## Safety Rules

- Never request seed phrases.
- Never store private keys.
- Never generate withdrawal actions from automation.
- Keep route previews visible before signing.
- Keep venue-specific blocked reasons visible.
- Keep historical-performance disclaimer visible.
- Use dry-run mode until venue adapter tests and legal review are complete.
