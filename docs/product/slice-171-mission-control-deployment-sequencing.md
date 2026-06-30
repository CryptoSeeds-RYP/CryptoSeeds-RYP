# Slice 171: Mission Control Deployment Sequencing

## Summary

Aligned Admin Mission Control with the read-only devnet deployment inspector so the dashboard follows the real deployment sequence instead of treating all missing devnet state as one generic blocker.

## Changes

- Mission Control now consumes deployment inspection state.
- Split devnet progress into separate phases:
  - Devnet Funding,
  - Devnet Test Mint,
  - Devnet Program,
  - Devnet Protocol.
- The next action now advances through:
  - funding packet,
  - test mint creation,
  - bootstrap/deploy/init plan,
  - protocol initialization and inspection.
- Added tests for:
  - current unfunded authority state,
  - funded authority with missing test mint,
  - deployed program with protocol initialization still pending.

## Safety Notes

- This is still dashboard/readiness logic only.
- No transaction broadcast, mint creation, deployment, or protocol initialization path was enabled.
- Devnet mutations remain explicit command-line steps with separate review.

## Current Expected State

With the authority still unfunded, the dashboard should show Devnet Funding as the active blocker and keep mint/program/protocol work waiting behind that state.
