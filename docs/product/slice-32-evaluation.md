# Slice 32 Evaluation: Hyperliquid Signed-Order Draft Gate

Date: 2026-05-29

## Scope

This slice adds a signable-order draft model without adding live execution.

Implemented:

- unsigned Hyperliquid order request model
- feature-flag blocking while signed execution is disabled
- resolved asset id requirement
- price and size validation
- nonce and `expiresAfter` validation
- explicit `SIGNATURE_REQUIRED` placeholder
- tests for blocked, valid, and invalid order drafts

## Product Position

SeedBot can now model the exact point where a Hyperliquid order would become ready for wallet or approved-agent signing. The app still cannot sign, broadcast, or store keys. This is the right next layer because it lets us design the UX around review, approval, and rejection before integrating any SDK signer.

## Verification

Passed:

- `npm test` -- 14 files, 54 tests.
- `npm run build`.

## Next Step

Add order-status and cancel preview models:

- query status by order id or client order id
- model possible filled/canceled/rejected states
- build cancel and schedule-cancel draft requests
- keep emergency cancel controls visible before live execution
