# Slice 158: Ops Runbook Receipt Alignment

## Scope

This slice aligns the in-app/domain operations runbook with the new devnet deployment receipt command.

## Changes

- Added `Devnet Deployment Receipt` to `src/domain/operations.ts`.
- Kept the receipt as `DRAFT_ONLY` and approval-gated.
- Updated operations model tests to expect the receipt in the scripted runbook sequence.
- Removed the arbitrary Ops Console six-item cap so all runbook gates are visible.

## Safety Position

The receipt remains read-only. It records deployment/release-review evidence but does not approve launch, enable broadcast, mutate protocol state, or authorize wallet execution.

## Verification

- Operations domain tests
- Full app regression before push
