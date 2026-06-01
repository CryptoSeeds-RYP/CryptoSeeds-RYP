# Slice 91 Evaluation - Localnet Admin Fixture Readiness

## Goal

Move faster toward devnet by turning the localnet Admin reward fixture into a repeatable readiness gate instead of a manual JSON artifact.

## Issues Fixed

1. The Admin Dashboard always inspected reward epoch `0`.
   - Fixed by adding `VITE_REWARD_INSPECTION_EPOCH_ID` and wiring it through the Admin reward inspection flow.

2. The localnet smoke fixture did not export the epoch id needed by the app.
   - Fixed by writing `VITE_REWARD_INSPECTION_EPOCH_ID` into the fixture `appEnv`.

3. Admin reward inspection decoded account state without flagging unsafe decoded values.
   - Fixed by validating split totals, draft-only status, vault verification, user-fund receiver flags, epoch status, blocked execution, and epoch accounting.

4. The localnet reward smoke harness used a stale hardcoded snapshot timestamp.
   - Fixed by deriving a recent validator/host timestamp so reward epochs satisfy the protocol cadence guard.

5. The exported Admin fixture had no standalone readiness checker.
   - Fixed by adding `npm run protocol:admin:fixture:check`.

## Verification

- `npm test -- src/config/env.test.ts src/solana/rewardAccountInspection.test.ts`.
- `npm run build`.
- `npm run ops:check`.
- `npm run protocol:admin:fixture:wsl`.
- `npm run protocol:admin:fixture:check`.

## Safety Posture

- Broadcast remains disabled.
- The Admin Dashboard remains read-only for reward accounts.
- No claim, payout, vault movement, or admin execution path was added.
- The fixture uses a disposable local validator and generated local test mint.

## Next Step

Run the full app/protocol verification set, then proceed to a browser-level Admin localnet smoke or devnet deployment-key preparation.
