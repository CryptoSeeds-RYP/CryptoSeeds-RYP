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
VITE_CRYPTOSEEDS_PROGRAM_ID=5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb
VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT=placeholder
VITE_SOLANA_BROADCAST_ENABLED=false
```

## Notes

- The RYP mint is public information and safe to store in frontend config.
- The current mint is owned by the legacy SPL Token program. A universal 1% transfer-fee mechanism cannot be silently added to this mint; that requires a reviewed wrapper, migration, or token-extension route.
- The localnet/devnet protocol program id is synced to `5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb`, but devnet deployment is still blocked until funding and test-mint creation are complete.
- Live balance reads require a connected Solana wallet and an RPC endpoint with access to mainnet token-account data.
- Devnet protocol testing must use a devnet test RYP mint. The mainnet RYP mint cannot be initialized on devnet.
- Planned devnet test RYP mint: `B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7`.
- The app now has a token trust profile that surfaces fixed supply, disabled mint authority, disabled freeze authority, self-custody, and the review-required fee-route status in the product layer.

## Verification

Run:

```bash
npm run token:check
```

This performs a read-only mint account check against Solana mainnet RPC.

Devnet deployment prep:

```bash
npm run devnet:prep
```

This checks devnet env posture, program id sync, admin authority config, devnet test mint config, compiled program output, and keeps broadcast disabled during deployment prep.
