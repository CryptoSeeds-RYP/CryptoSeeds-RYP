# Slice 195: Devnet Treasury Keypair Gate

## Change

- Added a default `target/devnet/independent-treasury.json` keypair check to `devnet:status`.
- Added `--treasury` as an override for the devnet treasury owner keypair path.
- Made missing `VITE_INDEPENDENT_TREASURY_ADDRESS` or admin/treasury address reuse a devnet status blocker.
- Updated docs and operator tests for the stronger treasury ownership gate.

## Reason

The protocol can derive the treasury ATA from a public owner address, but deployment rehearsal should also prove that the team controls the configured devnet treasury owner. Otherwise fee routing could be initialized toward an address that cannot be operated later.

## Safety Boundary

The status command reads only local ignored keypair files and prints public addresses. It does not print secret material, fund wallets, create accounts, deploy programs, initialize protocol state, sign transactions, or enable wallet broadcast.
