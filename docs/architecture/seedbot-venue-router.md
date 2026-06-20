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

No adapter should send live orders until the user has explicitly approved the route and the venue-specific signature flow is implemented. No adapter should add discretionary automation until capped permissions, revoke controls, objective route parameters, security review, and jurisdictional legal review are complete.

The Anchor permission record now stores the minimum live-automation guardrails on-chain:

- permission hash,
- expiry timestamp,
- max trade amount,
- max daily volume amount,
- max daily trade count,
- max slippage bps,
- revoked flag.

These fields are still not enough to enable autonomous trading by themselves. Venue adapters must also enforce the matching off-chain strategy packet, wallet signature policy, and execution venue controls before any live route is allowed.

SeedBot allocation transaction previews should label mixed Solana and EVM route sets as `MULTICHAIN` so Phantom-only, MetaMask-only, and combined approval paths are not misrepresented.

## Hyperliquid Notes

The Hyperliquid adapter now has an explicit testnet-first boundary in `src/services/hyperliquidAdapter.ts`.

Current preview configuration:

- default network: `TESTNET`
- environment key: `VITE_SEEDBOT_HYPERLIQUID_NETWORK`
- signed execution flag: `VITE_SEEDBOT_SIGNED_EXECUTION=false`
- testnet exchange endpoint: `https://api.hyperliquid-testnet.xyz/exchange`
- mainnet exchange endpoint: `https://api.hyperliquid.xyz/exchange`
- order action draft with pending asset id, price, and size resolution
- wallet or approved agent signature required before any executable request
- agent approval preview for wallet-owned API/agent authorization
- no withdrawal action generated
- stale execution should use an expiry guard when signed

The adapter intentionally does not create a fully valid order body yet. Hyperliquid orders require numeric asset ids from the `info/meta` universe, a resolved price, a derived size, a nonce, and a signature. The app must resolve those immediately before signing.

Asset lookup is handled by `src/services/hyperliquidMarketDataService.ts`:

- fetches `info` with `{ "type": "meta" }`
- parses the `universe` array
- resolves perp asset ids by array index
- blocks missing or delisted assets before signing
- leaves strategy route assets immutable

Unsigned order draft modeling is handled in `src/services/hyperliquidAdapter.ts`:

- refuses to create a signable request while `VITE_SEEDBOT_SIGNED_EXECUTION=false`
- requires a resolved numeric asset id
- requires positive decimal price and size strings
- requires `expiresAfter` to be after `nonce`
- outputs `SIGNATURE_REQUIRED` rather than a signature
- does not broadcast or store signing material

Order controls are modeled before live execution:

- order-status query drafts use the `info` endpoint with `orderStatus`
- cancel drafts require asset id, order id, nonce, expiry, and signature
- schedule-cancel drafts enforce Hyperliquid's five-second minimum delay
- all signed control drafts are still blocked while signed execution is disabled

Signing is modeled by `src/services/hyperliquidSigningBoundary.ts`:

- never stores or requests private keys
- keeps read-only status queries signature-free
- requires the official SDK signing path for L1 actions
- separates master-wallet agent approval from approved-agent order signing
- lowercases signer and account addresses in signing intents
- blocks mainnet signing unless explicitly allowed by code
- blocks placeholder agent addresses

Live implementation still needs:

- official SDK or signature helper
- agent-wallet approval UX
- nonce source and signing UX
- order status polling UI
- cancel/kill-switch transaction signing
- position caps and venue-specific order validation

## Safety Rules

- Never request seed phrases.
- Never store private keys.
- Never generate withdrawal actions from automation.
- Keep route previews visible before signing.
- Keep venue-specific blocked reasons visible.
- Keep historical-performance disclaimer visible.
- Keep success-fee, profit-fee, and performance-fee mechanics review-gated before live use.
- Keep route choice based on objective, pre-disclosed parameters.
- Use dry-run mode until venue adapter tests and legal review are complete.
- Default new execution work to venue testnets before mainnet.
