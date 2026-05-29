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

The Hyperliquid adapter now has an explicit testnet-first boundary in `src/services/hyperliquidAdapter.ts`.

Current preview configuration:

- default network: `TESTNET`
- testnet exchange endpoint: `https://api.hyperliquid-testnet.xyz/exchange`
- mainnet exchange endpoint: `https://api.hyperliquid.xyz/exchange`
- order action draft with pending asset id, price, and size resolution
- wallet or approved agent signature required before any executable request
- agent approval preview for wallet-owned API/agent authorization
- no withdrawal action generated
- stale execution should use an expiry guard when signed

The adapter intentionally does not create a fully valid order body yet. Hyperliquid orders require numeric asset ids from the `info/meta` universe, a resolved price, a derived size, a nonce, and a signature. The app must resolve those immediately before signing.

Live implementation still needs:

- official SDK or signature helper
- signed testnet order spike
- agent-wallet approval UX
- nonce handling
- info/meta asset-id lookup
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
- Default new execution work to venue testnets before mainnet.
