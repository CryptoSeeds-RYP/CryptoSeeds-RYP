# Slice 36 Evaluation: Hyperliquid Signing Boundary

Date: 2026-05-30

## Scope

This slice adds a signing-intent boundary for Hyperliquid without adding any live signing or broadcast path.

Implemented:

- L1 action signing intent model
- approved-agent versus master-wallet route separation
- master-wallet agent approval signing intent
- read-only status intent that requires no signature
- mainnet signing block by default
- placeholder agent address blocking
- signer/account address normalization
- tests for blocked drafts, ready testnet drafts, mainnet blocking, agent approval, placeholder agents, and read-only status

## Product Position

SeedBot now has a clear line between route preview, signable draft, and signing intent. The app still cannot sign, store keys, or broadcast. This follows Hyperliquid's own warning that integrations should use an SDK rather than manually generating signatures.

## Verification

Passed:

- `npm test` -- 15 files, 65 tests.
- `npm run build`.

## Next Step

Add a UI-only signing readiness panel:

- show whether a control draft is signature-free, master-wallet approval, or approved-agent signing
- show the SDK method required
- keep signing buttons disabled until testnet signing support is deliberately enabled
