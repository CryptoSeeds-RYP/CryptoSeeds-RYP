# Devnet Deployment Status

Date: 2026-06-01

## Public Devnet IDs

- Program id: `5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb`
- Devnet authority wallet: `Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe`
- Planned devnet RYP test mint: `B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7`

## Local Secret Files

These files are generated locally and ignored by git:

- `target/devnet/cryptoseeds_protocol-keypair.json`
- `target/devnet/devnet-authority.json`
- `target/devnet/ryp-test-mint-keypair.json`

Do not commit, paste, upload, or share these keypair files.

## Current Status

Repo-side devnet prep is partially complete:

- `Anchor.toml` localnet/devnet program id is synced.
- `declare_id!` is synced.
- `.env.example` uses the synced program id.
- `.env.devnet.example` contains the devnet prep values.
- Anchor build and IDL drift checks pass with the synced program id.
- Localnet smoke passes with the synced program id.

External blocker:

- Devnet faucet rejected airdrop requests for the generated authority wallet.
- Because the authority wallet has `0 SOL`, the devnet test RYP mint has not been created yet.
- `npm run devnet:prep -- --env .env.devnet.example` is correctly blocked until the devnet test mint account exists.

## Next Commands

After funding `Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe` on devnet, create the test mint with the local keypair:

```bash
wsl bash -lc "cd /mnt/c/Users/FiercePC/Desktop/crypto-seeds-microverse && spl-token create-token target/devnet/ryp-test-mint-keypair.json --decimals 6 --url devnet --fee-payer target/devnet/devnet-authority.json --mint-authority target/devnet/devnet-authority.json"
```

Then rerun:

```bash
npm run devnet:prep -- --env .env.devnet.example
```

Only after that should the devnet program deploy and protocol initialization steps proceed.
