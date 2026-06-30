# RYP Mission Status

The mission status command is the read-only operator cockpit for the current ten-point RYP execution plan.

```bash
npm run mission:status -- --env .env.devnet.example
```

It aggregates:

- ops readiness,
- devnet next-action recommendation,
- read-only public testnet readiness,
- the ten mission phases,
- the current blocker,
- the next safe command or manual action,
- `nextOperatorHandoff`, which preserves whether the next step is read-only, requires external funding, or needs explicit approval before a devnet/local-key mutation.

The devnet deployment lane is split into separate phases so the terminal report and Admin Dashboard advance through the same sequence:

- authority funding,
- devnet test mint creation,
- devnet program deployment,
- protocol initialization,
- read-only frontend/public preview readiness.

It does not create wallets, create mints, deploy programs, initialize protocol accounts, broadcast wallet transactions, or mutate protocol state.

The full local verification phase includes the WSL localnet smoke gate:

```bash
npm run protocol:smoke:localnet:wsl
```

This is intentionally included because the Rust program must be proven against a disposable local validator before any devnet mutation is treated as release-reviewable.

Use strict mode when a blocked mission should fail automation:

```bash
npm run mission:status -- --env .env.devnet.example --strict
```

## Current Expected Blocker

Until the devnet authority is funded, the expected mission status is `MISSION_BLOCKED`.

Authority:

```text
Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe
```

Minimum devnet funding for mint creation is `0.1 SOL`; `3 SOL` is recommended before deployment.

After funding, rerun:

```bash
npm run mission:status -- --env .env.devnet.example
```

Then follow the reported `nextOperatorHandoff.operatorRule` and `nextRecommendation.command` one step at a time.
