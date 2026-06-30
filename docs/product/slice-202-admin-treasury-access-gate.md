# Slice 202 - Admin Treasury Access Gate

## Summary

This slice lets the Admin Dashboard unlock for either the configured admin authority or the independent treasury owner wallet during local/devnet testing.

## Changes

- Added explicit admin access roles:
  - `ADMIN_AUTHORITY`
  - `INDEPENDENT_TREASURY`
  - `NONE`
- Kept all Admin Dashboard actions proposal-only with `canExecuteActions=false`.
- Added dashboard visibility for the configured treasury owner and connected access role.
- Added a warning when the admin authority and independent treasury owner reuse the same wallet.
- Updated architecture docs to clarify that treasury-owner dashboard access does not replace protocol signing authority.

## Security Boundary

The independent treasury wallet can open the operator cockpit for review, readiness checks, labels, and proposal packets. It cannot execute protocol actions from the UI, move funds, bypass wallet approval, or act as the protocol authority unless the protocol itself is configured that way.

## Verification

- Focused admin access tests cover admin unlock, treasury unlock, wrong-wallet blocking, and same-wallet warnings.
- Full verification should still run before this slice is pushed.
