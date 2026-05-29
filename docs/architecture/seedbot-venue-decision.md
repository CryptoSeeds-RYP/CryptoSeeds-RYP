# SeedBot Venue Decision

Date: 2026-05-29

## Recommendation

Use a modular venue adapter system instead of hard-wiring one exchange.

Recommended first public pilot:

- Hyperliquid for active strategy execution.
- GRVT as the second pilot candidate.
- Jupiter for Solana/RYP spot routing.
- Antarctic Exchange remains blocked until official API and venue due diligence are complete.

## Why Hyperliquid First

Hyperliquid has official API documentation, supports exchange actions, and has an API/agent-wallet model suitable for automation without giving the platform withdrawal authority.

Use it first for:

- active multi-asset strategy execution
- EVM wallet flows
- perps/spot-style strategy testing
- dynamic allocation pilots

## Why GRVT Second

GRVT has official trading API documentation and supports API Key and EIP-712 wallet-login authentication. It is attractive for a later venue because of its self-custodial/ZK execution posture, but the integration is more complex and should come after the first venue adapter is proven.

## Why Antarctic Is Blocked

Do not use Antarctic for client trading until we have:

- official API documentation
- custody and permission model
- supported jurisdictions
- liquidity data
- fee schedule
- rate limits
- security disclosures

## Architecture

SeedBot should route through an internal adapter interface:

```txt
Strategy Engine
  -> Venue Router
      -> Hyperliquid Adapter
      -> GRVT Adapter
      -> Jupiter Adapter
      -> Future Venue Adapter
```

The UI should keep showing:

- selected venue
- wallet route
- historical performance windows
- past-performance disclaimer
- fee-on-positive-PnL disclosure
- wallet approval requirement

No adapter should request seed phrases or custody user funds.
