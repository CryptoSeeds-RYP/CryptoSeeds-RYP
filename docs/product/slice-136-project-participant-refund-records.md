# Slice 136: Project Participant Refund Records

## Purpose

Add per-wallet project refund traceability on top of the existing aggregate project refund accounting.

## Implemented

- Added `PROJECT_REFUND_RECORD_SEED`.
- Added `record_project_participant_refund`.
- Added `ProjectRefundRecord` with:
  - project,
  - wallet,
  - participation record,
  - refund amount,
  - refund metadata hash,
  - recorded timestamp.
- Added `ProjectParticipantRefundRecorded` event.
- Added participant refund validation:
  - project authority required,
  - project must already be cancelled through the existing aggregate accounting path,
  - metadata hash must be non-zero,
  - participation record must belong to the project,
  - per-wallet refund cannot exceed recorded participation,
  - aggregate refund pool cannot be exceeded.
- Added TypeScript transaction planning for the new instruction.
- Added instruction spec and account layout drift coverage.

## Boundaries

- This records refund evidence and accounting; it does not transfer tokens.
- Duplicate participant refund records are prevented by the deterministic refund PDA.
- Localnet smoke does not yet execute the new instruction because the current smoke path cannot create an approved project participation without advancing the 14-day governance rights delay.

## Verification

- `npm run protocol:build:wsl`
- `npm run protocol:test:win` passes with `50` Rust tests.
- `npm run protocol:idl:check` passes with `40` frontend instruction plans and `14` account layouts.
- `npm test -- --run src/solana/protocolTransactionPlan.test.ts` passes.
- `npm test -- --run` passes with `212` frontend/domain tests.
- `npm run build` passes.
- `npm run protocol:smoke:localnet:wsl` passes.
- `npm run copy:audit`, `npm run visual:audit`, and `npm run ops:check` pass.
- `npm audit` reports `0` vulnerabilities.

## Deferred

- Approved-project localnet fixture that can exercise project participation and participant refund records end to end.
- Token-moving refund claim path.
- Merkle/proof-backed project refund claims.
