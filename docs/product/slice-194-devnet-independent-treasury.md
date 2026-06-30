# Slice 194: Devnet Independent Treasury

## Change

- Set `VITE_INDEPENDENT_TREASURY_ADDRESS` in `.env.devnet.example`.
- Generated the matching local-only devnet treasury keypair under ignored `target/devnet/independent-treasury.json`.
- Updated devnet deployment docs so the treasury owner is explicit and separate from the admin authority.

## Reason

The previous devnet configuration allowed treasury reward routing to fall back to the admin authority. That was acceptable as an early warning state, but it is too loose for deployment rehearsal because CryptoSeeds policy requires treasury separation.

## Safety Boundary

Only the public treasury owner address is tracked. The treasury keypair secret remains local-only and ignored by git.
