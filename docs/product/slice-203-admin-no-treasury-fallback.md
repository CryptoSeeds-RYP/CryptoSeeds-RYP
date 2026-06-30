# Slice 203 - Admin No Treasury Fallback

## Summary

This slice aligns the Admin Dashboard with the devnet deployment scripts by removing the admin-authority fallback from treasury reward-vault previews and public testnet readiness.

## Changes

- Treasury reward-vault previews now require `VITE_INDEPENDENT_TREASURY_ADDRESS`.
- Public testnet readiness now blocks when `VITE_INDEPENDENT_TREASURY_ADDRESS` is missing.
- Public testnet readiness now blocks when the independent treasury address reuses the admin authority wallet.
- Admin tests now cover the no-fallback preview path and the stricter readiness gate.

## Security Boundary

The admin authority must not silently become the treasury owner. This preserves treasury separation, keeps fee routing reviewable, and matches the devnet status, vault-prep, protocol-initialization, and protocol-inspection scripts.

## Verification

- Focused admin tests cover ready previews with an explicit treasury owner and blocked treasury vault previews without one.
- Full verification should run before this slice is pushed.
