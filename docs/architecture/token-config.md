# Token Configuration

## RYP Mint

Mainnet RYP mint:

`CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD`

Explorer:

https://solscan.io/token/CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD

## Current App Use

The dApp uses this mint for SPL token-account balance reads once a Solana wallet is connected.

Live mainnet RPC sanity check:

- Decimals: `6`
- Supply: `49,999,999.429327 RYP`
- Owner program: `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`
- Mint authority: `null`
- Freeze authority: `null`

Current environment keys:

```bash
VITE_SOLANA_CLUSTER=localnet
VITE_SOLANA_RPC_URL=http://127.0.0.1:8899
VITE_RYP_MINT_ADDRESS=CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD
VITE_RYP_DECIMALS=6
VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT=placeholder
VITE_SOLANA_BROADCAST_ENABLED=false
```

## Notes

- The RYP mint is public information and safe to store in frontend config.
- The current mint is owned by the legacy SPL Token program. A universal 1% transfer-fee mechanism cannot be silently added to this mint; that requires a reviewed wrapper, migration, or token-extension route.
- The protocol program id is still a placeholder until the Anchor program has a real deployed address.
- Live balance reads require a connected Solana wallet and an RPC endpoint with access to mainnet token-account data.

## Verification

Run:

```bash
npm run token:check
```

This performs a read-only mint account check against Solana mainnet RPC.
