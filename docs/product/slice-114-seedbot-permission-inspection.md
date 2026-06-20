# Slice 114 - SeedBot Permission Inspection

Added read-only SeedBot permission inspection for the app/admin layer.

## What Changed

- Added SeedBot permission PDA derivation.
- Added `decodeSeedBotPermissionAccount`.
- Added `buildSeedBotPermissionInspectionPreview`.
- Added `readSeedBotPermissionInspection`.
- Added `validateSeedBotPermissionInspection`.
- Added lifecycle states:
  - `PREVIEW_ONLY`,
  - `MISSING`,
  - `ACTIVE`,
  - `REVOKED`,
  - `EXPIRED`,
  - `DECODE_ERROR`.

## Safety Rules

The inspector is read-only and does not expose signing, custody, or order broadcast.

Validation blocks malformed or unsafe permission state, including:

- owner mismatch,
- blank permission hash,
- missing active tier snapshot,
- zero stake snapshot,
- invalid trade cap,
- daily volume below trade cap,
- daily trade count outside protocol bounds,
- slippage above protocol bounds.

Revoked and expired permissions are surfaced as lifecycle warnings so the UI can clearly show that guarded automation is unavailable until renewal.

## Why It Matters

SeedBot now has contract state for permission creation, renewal, revocation, and stake snapshots. The app also needs a safe way to inspect that state before any future execution adapter can treat a permission as usable.

This does not enable live trading.
