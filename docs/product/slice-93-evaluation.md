# Slice 93 Evaluation - Devnet Program ID Sync

## Goal

Advance from devnet planning into concrete devnet deployment preparation without committing private keys or enabling broadcast.

## Completed

- Generated ignored local devnet keypairs:
  - `target/devnet/cryptoseeds_protocol-keypair.json`
  - `target/devnet/devnet-authority.json`
  - `target/devnet/ryp-test-mint-keypair.json`
- Synced the public program id through:
  - `Anchor.toml`
  - `programs/cryptoseeds_protocol/src/lib.rs`
  - `.env.example`
  - `.env.devnet.example`
- Added `.env.devnet.example` as the public devnet prep template.
- Updated devnet prep to accept `--env` and verify that the devnet test RYP mint exists on RPC.
- Rebuilt Anchor output and passed IDL drift checks with the synced program id.
- Ran localnet smoke successfully with the synced program id.
- Documented current devnet deployment status and the funding blocker.

## Public Devnet IDs

- Program id: `5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb`
- Devnet authority wallet: `Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe`
- Planned devnet RYP test mint: `B2Q92Qns3cukkNhtG4kbE1PVcUyjcKMs79HJtCJT9Eq7`

## Blocker

The Solana devnet faucet rejected both `2 SOL` and `0.5 SOL` airdrop requests, so the generated devnet authority wallet still has no funding. Because of that, the devnet test RYP mint has not been created yet.

`npm run devnet:prep -- --env .env.devnet.example` correctly remains blocked with:

- Devnet test RYP mint account was not found on the selected devnet RPC.

## Verification

- `npm run protocol:build:wsl`.
- `npm run protocol:idl:check`.
- `npm run protocol:smoke:localnet:wsl`.
- `npm run devnet:prep -- --env .env.devnet.example`.
- `npm run build`.

## Safety Posture

- No secret keypair was committed.
- No broadcast path was added.
- No devnet deployment happened without funded authority and test mint verification.
- Mainnet remains untouched.

## Next Step

Fund the devnet authority wallet, create the devnet test RYP mint, rerun `npm run devnet:prep -- --env .env.devnet.example`, then deploy the program to devnet.
