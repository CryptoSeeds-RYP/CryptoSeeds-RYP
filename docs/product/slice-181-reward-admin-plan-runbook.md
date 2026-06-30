# Slice 181 - Reward Admin Plan Runbook

## Scope

This slice wires the reward epoch admin plan command into the typed operations runbook.

## Changes

- Added `reward-epoch-admin-plan` to `maintenanceRunbook`.
- Marked the item `DRAFT_ONLY` and approval-gated.
- Documented that agents may prepare the plan-only packet but must not sign, broadcast, create epochs, review epochs, cancel epochs, create claim records, or move reward tokens.
- Updated operations tests to assert the runbook sequence and safety boundary.
- Updated the operations model document.

## Devnet Status

No devnet transaction was submitted in this slice. Devnet remains blocked until the authority wallet receives devnet SOL.
