# Devnet Deployment Status

Date: 2026-06-20

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
- `npm run devnet:mint:test -- --env .env.devnet.example` is available to create the configured devnet test mint from ignored local keypairs.
- `npm run devnet:status -- --env .env.devnet.example` is available to inspect local keypair presence, reward-vault keypair readiness, deterministic protocol targets, authority SOL, mint status, program status, and next actions in one read-only report.
- `npm run devnet:vaults:prep -- --env .env.devnet.example` is available to create missing ignored reward-vault keypairs before funding/deployment, without RPC calls, signing, or broadcasting.
- `npm run devnet:program:check -- --env .env.devnet.example` is available to verify whether the configured program is deployed on devnet.
- `npm run devnet:deploy:wsl -- -EnvPath .env.devnet.example` is available to build, run strict prep, deploy the program, and inspect the deployed program account.
- `npm run devnet:init:protocol -- --env .env.devnet.example` is available to plan protocol initialization after devnet deploy.
- `npm run devnet:init:protocol -- --env .env.devnet.example --execute` initializes config, reward config, and reward vault states only after reviewed execution.

The status report now includes a `protocolTargets` block before funding/deployment. This lets the team review the deterministic config PDA, reward config PDA, staking vault ATA, treasury reward ATA, and reward-vault state PDAs before any transaction is sent. Program-controlled reward vault token accounts use ignored local keypairs under `target/devnet/reward-vaults`; `devnet:vaults:prep` creates those local keypairs early so their public addresses and metadata hashes can be reviewed before protocol initialization.

External blocker:

- Devnet faucet rejected airdrop requests for the generated authority wallet, including the latest attempt on 2026-06-20 with HTTP 429.
- Because the authority wallet has `0 SOL`, the devnet test RYP mint has not been created yet.
- `npm run devnet:status -- --env .env.devnet.example` currently reports this exact blocker.
- `npm run devnet:prep -- --env .env.devnet.example` is correctly blocked until the devnet test mint account exists.
- `npm run devnet:deploy:wsl -- -EnvPath .env.devnet.example` will also block until prep is clean.
- `npm run devnet:init:protocol -- --env .env.devnet.example` will block until the devnet mint and program accounts exist.

## Next Commands

After funding `Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe` on devnet, create the test mint with the local keypair.

Minimum funding to create the mint is `0.1 SOL`; `3 SOL` is recommended before program deployment.

```bash
npm run devnet:mint:test -- --env .env.devnet.example
```

Inspect all devnet blockers in one report:

```bash
npm run devnet:status -- --env .env.devnet.example
```

Prepare local reward-vault keypairs for the holder, staker, delivery-cost, and rollover vaults:

```bash
npm run devnet:vaults:prep -- --env .env.devnet.example
```

Then rerun the deployment prep gate:

```bash
npm run devnet:prep -- --env .env.devnet.example
```

Inspect current program deployment state:

```bash
npm run devnet:program:check -- --env .env.devnet.example
```

When prep is ready, deploy through WSL:

```bash
npm run devnet:deploy:wsl -- -EnvPath .env.devnet.example
```

Review the protocol initialization plan:

```bash
npm run devnet:init:protocol -- --env .env.devnet.example
```

After the derived accounts and vault custody are reviewed, initialize the protocol:

```bash
npm run devnet:init:protocol -- --env .env.devnet.example --execute
```

Only after protocol initialization and read-only account inspection pass should frontend transaction broadcast be reviewed. The Admin Dashboard now exposes protocol config, stake position, governance proposal/vote, project/participation, and reward account inspectors so the deployment state can be checked from decoded on-chain accounts before any signed frontend flow is enabled.
