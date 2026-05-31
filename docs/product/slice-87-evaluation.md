# Slice 87 Evaluation - Localnet Admin Fixture Export

## Goal

Create a reusable localnet fixture that bridges the Anchor smoke flow and the next browser-level Admin Dashboard verification.

## Completed

- Added optional `--admin-fixture` output support to `scripts/run-anchor-localnet-smoke.mjs`.
- Added optional bounded `--keep-alive-ms` support so future browser checks can keep the disposable validator alive briefly.
- Added `scripts/write-localnet-admin-fixture-wsl.ps1`.
- Added `npm run protocol:admin:fixture:wsl`.
- Fixture output includes:
  - local RPC URL,
  - local test mint,
  - program id,
  - app env values,
  - key protocol/reward accounts,
  - `adminRewardInspection`,
  - smoke checked list.

## Safety Posture

- Broadcast remains disabled in exported app env.
- The fixture uses a disposable local validator and generated test mint.
- No reward setup, payout, claim, or vault movement UI was added.
- `--keep-alive-ms` is bounded to 10 minutes.

## Next Step

Use the fixture script in a browser smoke harness that launches Vite with the exported localnet env and verifies the Admin Dashboard text against live decoded reward accounts.
