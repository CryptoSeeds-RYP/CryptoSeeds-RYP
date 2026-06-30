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
- the next safe command or manual action.

It does not create wallets, create mints, deploy programs, initialize protocol accounts, broadcast wallet transactions, or mutate protocol state.

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

Then follow the reported `nextRecommendation.command` one step at a time.
