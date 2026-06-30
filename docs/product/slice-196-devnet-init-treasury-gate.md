# Slice 196: Devnet Init Treasury Gate

## Change

- Made `devnet:init:protocol` require `VITE_INDEPENDENT_TREASURY_ADDRESS`.
- Added a default `target/devnet/independent-treasury.json` owner keypair requirement to protocol initialization.
- Added `--treasury` overrides to protocol initialization and reward-vault prep.
- Made reward-vault prep block on missing treasury env, admin/treasury reuse, missing treasury keypair, or treasury keypair mismatch.

## Reason

Protocol initialization creates the independent treasury reward ATA from the configured owner address. The deployment path should prove local devnet control of that owner before deriving or registering treasury reward routing.

## Safety Boundary

The scripts print only public addresses and relative keypair paths. They do not print secret key material. Reward-vault prep remains local-only and non-broadcasting. Protocol initialization still requires `--execute` before any on-chain writes.
