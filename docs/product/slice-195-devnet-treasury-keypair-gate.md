# Slice 195: Devnet Treasury Keypair Gate

## Change

- Added a default `target/devnet/independent-treasury.json` keypair check to `devnet:status`.
- Added `--treasury` as an override for the devnet treasury owner keypair path.
- Made missing `VITE_INDEPENDENT_TREASURY_ADDRESS` or admin/treasury address reuse a devnet status blocker.
- Extended the same explicit treasury owner requirement into vault prep and protocol initialization.
- Updated docs and operator tests for the stronger treasury ownership gate.

## Reason

The protocol can derive the treasury ATA from a public owner address, but deployment rehearsal should also prove that the team controls the configured devnet treasury owner. Otherwise fee routing could be initialized toward an address that cannot be operated later.

## Safety Boundary

The status and vault-prep commands read only local ignored keypair files and print public addresses. The initializer also reads the treasury owner keypair before planning or executing protocol setup. None of these paths print secret material or enable frontend wallet broadcast.
