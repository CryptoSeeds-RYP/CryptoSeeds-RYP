# Slice 189: Devnet Funding Fallbacks

## Change

- Extended the read-only devnet funding packet with explicit rate-limit fallback instructions.
- Added staged CLI airdrop, existing devnet wallet transfer, and proof-of-work faucet discovery options.
- Kept the packet read-only: it does not request airdrops, sign, broadcast, create mints, deploy programs, or initialize protocol state.

## Reason

The public devnet faucet has repeatedly rate-limited the generated authority wallet. Operators need a clear handoff that distinguishes:

- safe balance/status checks,
- devnet-only funding options,
- fallback commands,
- post-funding deployment sequence.

## Operator Boundary

All fallback options are devnet-only. Production funds, mainnet SOL, seed phrases, and private keys must not be used for this devnet authority funding path.
