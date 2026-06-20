# Slice 139: Reward Merkle CLI Verification

## Implemented

- Hardened `scripts/prepare-reward-claim-merkle.mjs`.
- Added strict u64 parsing for epoch ids and proof leaf indexes.
- Added missing-value checks for CLI options.
- Added local verification for every emitted Merkle proof before the export is considered valid.
- Added CLI regression tests for the actual reward claim Merkle export command.

## Security Boundary

- The Merkle export command remains proof-only.
- It does not sign, broadcast, create claim records, or move reward tokens.
- Generated proof packets now fail closed if any emitted record cannot reconstruct the exported claim root.

## Verification

- Focused Merkle CLI tests pass.
- The real two-step operator flow passes:
  1. `prepare-holder-reward-epoch.mjs`
  2. `prepare-reward-claim-merkle.mjs`
