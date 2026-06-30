# Devnet Deployment Status

Date: 2026-06-30

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
- `npm run devnet:bootstrap -- --env .env.devnet.example` is available as a safe orchestration wrapper. By default it runs strict read-only funding/status/prep/program checks and prints the blockers without creating accounts, deploying, or initializing protocol state.
- `npm run devnet:mint:test -- --env .env.devnet.example` is available to create the configured devnet test mint from ignored local keypairs after the authority wallet is already funded. It does not request faucet airdrops from the mint mutation path.
- `npm run devnet:fund:authority -- --env .env.devnet.example` is available to check authority balance and try staged devnet airdrops before mint/deploy steps.
- `npm run devnet:funding:packet -- --env .env.devnet.example` is available to create a read-only funding handoff packet with the public authority address, minimum/recommended devnet SOL amounts, faucet/manual transfer options, and post-funding command sequence.
- `npm run devnet:next -- --env .env.devnet.example` is available as a read-only operator recommender. It inspects devnet status and, when useful, protocol/readiness status, then prints the single next command plus the reason and risk level.
- `npm run devnet:status -- --env .env.devnet.example` is available to inspect local keypair presence, reward-vault keypair readiness, deterministic protocol targets, authority SOL, mint status, program status, and next actions in one read-only report.
- The devnet status report includes the compiled program `.so` relative path, SHA-256 checksum, and byte size for pre-deployment artifact review.
- `npm run devnet:vaults:prep -- --env .env.devnet.example` is available to create missing ignored reward-vault keypairs before funding/deployment, without RPC calls, signing, or broadcasting.
- `npm run devnet:program:check -- --env .env.devnet.example` is available to verify whether the configured program is deployed on devnet.
- `npm run devnet:deploy:wsl -- -EnvPath .env.devnet.example` remains available as a low-level maintainer tool, but the normal operator route is `npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan`.
- `npm run devnet:init:protocol -- --env .env.devnet.example` is available to plan protocol initialization after devnet deploy.
- `npm run devnet:init:protocol -- --env .env.devnet.example --execute` initializes config, reward config, and reward vault states only after reviewed execution.
- `npm run devnet:inspect:protocol -- --env .env.devnet.example` is available to read and validate the deployed program, protocol config, reward config, and reward vault state accounts before any public preview or wallet execution review.

The status report now includes a `protocolTargets` block before funding/deployment. This lets the team review the deterministic config PDA, reward config PDA, staking vault ATA, treasury reward ATA, and reward-vault state PDAs before any transaction is sent. Program-controlled reward vault token accounts use ignored local keypairs under `target/devnet/reward-vaults`; `devnet:vaults:prep` creates those local keypairs early so their public addresses and metadata hashes can be reviewed before protocol initialization.

External blocker:

- Devnet faucet rejected airdrop requests for the generated authority wallet, including 2026-06-20 attempts for `3 SOL`, `0.5 SOL`, and `0.1 SOL` with rate-limit errors.
- Devnet faucet also rejected 2026-06-30 attempts for `3 SOL`, `1 SOL`, and `0.1 SOL` with rate-limit errors.
- Because the authority wallet has `0 SOL`, the devnet test RYP mint has not been created yet.
- `npm run devnet:status -- --env .env.devnet.example` currently reports this exact blocker.
- `npm run devnet:prep -- --env .env.devnet.example` is correctly blocked until the devnet test mint account exists.
- Program deployment should use `npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan`; the wrapper runs the required prep before deploying.
- `npm run devnet:init:protocol -- --env .env.devnet.example` will block until the devnet mint and program accounts exist.

## Next Commands

After funding `Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe` on devnet, create the test mint with the local keypair.

Minimum funding to create the mint is `0.1 SOL`; `3 SOL` is recommended before program deployment.

Run the safe read-only bootstrap check:

```bash
npm run devnet:bootstrap -- --env .env.devnet.example
```

Ask the operator recommender for the single next command:

```bash
npm run devnet:next -- --env .env.devnet.example
```

Check balance and try staged devnet airdrops:

```bash
npm run devnet:fund:authority -- --env .env.devnet.example
```

Prepare a funding handoff packet without requesting airdrops:

```bash
npm run devnet:funding:packet -- --env .env.devnet.example
```

For a read-only balance check without requesting airdrops:

```bash
npm run devnet:fund:authority -- --env .env.devnet.example --check-only
```

After funding, create the test mint with the dedicated mint command:

```bash
npm run devnet:mint:test -- --env .env.devnet.example
```

The mint command requires the devnet authority to already hold at least `0.1 SOL`. If funding is missing, use:

```bash
npm run devnet:funding:packet -- --env .env.devnet.example
```

Inspect all devnet blockers in one report:

```bash
npm run devnet:status -- --env .env.devnet.example
```

Prepare local reward-vault keypairs for the holder, staker, delivery-cost, and rollover vaults:

```bash
npm run devnet:vaults:prep -- --env .env.devnet.example
```

If you need a standalone preflight report, run the deployment prep gate:

```bash
npm run devnet:prep -- --env .env.devnet.example
```

Inspect current program deployment state:

```bash
npm run devnet:program:check -- --env .env.devnet.example
```

When status is clean, deploy through the bootstrap wrapper and print the initialization plan:

```bash
npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan
```

Review the protocol initialization plan:

```bash
npm run devnet:init:protocol -- --env .env.devnet.example
```

After the derived accounts and vault custody are reviewed, initialize the protocol:

```bash
npm run devnet:init:protocol -- --env .env.devnet.example --execute
```

Inspect initialized protocol state directly:

```bash
npm run devnet:inspect:protocol -- --env .env.devnet.example
```

Run the read-only public testnet readiness gate directly:

```bash
npm run testnet:readiness -- --profile read-only --env .env.devnet.example
```

Prepare a read-only deployment receipt for release review:

```bash
npm run devnet:deployment:receipt -- --profile read-only --env .env.devnet.example
```

The receipt aggregates devnet status, program inspection, protocol-state inspection, public-readiness status, and the local program artifact hash. It is an audit handoff artifact only; it does not authorize frontend broadcast or public launch.

Only after protocol initialization and read-only account inspection pass should frontend transaction broadcast be reviewed. The Admin Dashboard now exposes protocol config, stake position, governance proposal/vote, project/participation, and reward account inspectors so the deployment state can be checked from decoded on-chain accounts before any signed frontend flow is enabled.
